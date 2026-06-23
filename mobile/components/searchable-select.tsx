import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../hooks/use-theme";

export type SelectOption = {
  value: string;
  label: string;
  subtitle?: string;
  group?: string;
};

type SearchableSelectProps = {
  value?: string;
  placeholder?: string;
  options: SelectOption[];
  onSelect: (value: string, option: SelectOption) => void;
  disabled?: boolean;
  label?: string;
  allowCustomValue?: boolean;
  customDisplayValue?: string;
  /** Called with the current search text; results are merged with `options`. */
  fetchOptions?: (search: string) => Promise<SelectOption[]>;
  /** If provided, called when user taps "Add new". On success returns the new SelectOption. */
  onAddNew?: (name: string) => Promise<SelectOption | null>;
  /** Label shown in the "+ Add" button, e.g. "customer" → '+ Add "Alamgir" as customer' */
  addNewLabel?: string;
};

type RenderItem =
  | { type: "GROUP"; id: string; title: string }
  | { type: "OPTION"; id: string; option: SelectOption };

export const SearchableSelect = ({
  value,
  placeholder = "Select",
  options,
  onSelect,
  disabled,
  label,
  allowCustomValue = false,
  customDisplayValue,
  fetchOptions,
  onAddNew,
  addNewLabel,
}: SearchableSelectProps) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [asyncOptions, setAsyncOptions] = useState<SelectOption[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cache selected labels by value so display doesn't go blank after asyncOptions are cleared
  const [labelCache, setLabelCache] = useState<Record<string, string>>({});

  // Debounced async search whenever search text changes
  useEffect(() => {
    if (!fetchOptions) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) {
      setAsyncOptions([]);
      setIsFetching(false);
      return;
    }
    setIsFetching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchOptions(search.trim());
        setAsyncOptions(results);
      } catch {
        setAsyncOptions([]);
      } finally {
        setIsFetching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, fetchOptions]);

  // Pre-load first 50 options every time the sheet opens (fresh server data merged with static options)
  useEffect(() => {
    if (!visible || !fetchOptions) return;
    let cancelled = false;
    setIsFetching(true);
    fetchOptions("")
      .then((results) => {
        if (!cancelled) setAsyncOptions(results);
      })
      .catch(() => {
        if (!cancelled) setAsyncOptions([]);
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Merge prop options + async results, deduplicating by value
  const mergedOptions = useMemo(() => {
    if (!asyncOptions.length) return options;
    const seen = new Set(options.map((o) => o.value.toLowerCase()));
    const extra = asyncOptions.filter((o) => !seen.has(o.value.toLowerCase()));
    return [...options, ...extra];
  }, [options, asyncOptions]);

  const selectedOption = useMemo(
    () => mergedOptions.find((option) => option.value === value),
    [mergedOptions, value],
  );

  const { filteredItems, hasMore, totalCount } = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const isSearching = normalizedSearch.length > 0;

    // Filter options based on search
    let filtered = mergedOptions.filter((option) => {
      if (!isSearching) return true;
      return (
        option.label.toLowerCase().includes(normalizedSearch) ||
        option.subtitle?.toLowerCase().includes(normalizedSearch) ||
        option.group?.toLowerCase().includes(normalizedSearch)
      );
    });

    const totalCount = filtered.length;
    let hasMore = false;

    // Limit to 50 when not searching; always keep the selected value visible
    if (!isSearching && filtered.length > 50) {
      hasMore = true;
      const selected =
        value != null && value !== ""
          ? filtered.find((option) => option.value === value)
          : undefined;
      const rest = selected
        ? filtered.filter((option) => option.value !== value)
        : filtered;
      filtered = [
        ...(selected ? [selected] : []),
        ...rest.slice(0, selected ? 49 : 50),
      ];
    }

    const items: RenderItem[] = [];
    let previousGroup: string | undefined;
    let fallbackCounter = 0;
    let groupCounter = 0;

    filtered.forEach((option, index) => {
      if (option.group && option.group !== previousGroup) {
        items.push({
          type: "GROUP",
          id: `__group__${groupCounter++}__${option.group}`,
          title: option.group,
        });
        previousGroup = option.group;
      }
      const id =
        option.value && option.value.length > 0
          ? `__opt__${index}__${option.value}`
          : `__opt__empty__${fallbackCounter++}`;
      items.push({ type: "OPTION", id, option });
    });

    return { filteredItems: items, hasMore, totalCount };
  }, [mergedOptions, search]);

  const handleSelect = (option: SelectOption) => {
    // Cache label so the trigger can display it even after asyncOptions are cleared
    setLabelCache((prev) => ({ ...prev, [option.value]: option.label }));
    onSelect(option.value, option);
    closeModal();
  };

  const closeModal = () => {
    setVisible(false);
    setSearch("");
  };

  // Resolve display label: matched option → cached label → customDisplayValue fallback
  const displayText = useMemo(() => {
    if (selectedOption) return selectedOption.label;
    if (value && labelCache[value]) return labelCache[value];
    if (customDisplayValue) return customDisplayValue;
    return null;
  }, [selectedOption, value, labelCache, customDisplayValue]);

  // Check if search text matches any existing option
  const searchMatchesExisting = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return true;
    return mergedOptions.some(
      (option) => option.label.toLowerCase() === normalizedSearch,
    );
  }, [mergedOptions, search]);

  const handleAddCustom = async () => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) return;
    if (onAddNew) {
      // onAddNew resolves immediately (deferred creation) — no spinner needed
      const newOption = await onAddNew(trimmedSearch);
      if (newOption) {
        // handleSelect caches the label so the trigger keeps showing the name
        handleSelect(newOption);
      }
      return;
    }
    const customOption: SelectOption = {
      value: trimmedSearch,
      label: trimmedSearch,
    };
    onSelect(trimmedSearch, customOption);
    closeModal();
  };

  return (
    <View>
      {label ? (
        <Text style={{ color: colors.text.primary, ...styles.label }}>
          {label}
        </Text>
      ) : null}
      <TouchableOpacity
        style={{
          backgroundColor: colors.bg.tertiary,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
          ...styles.trigger,
        }}
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.85}
      >
        <Text
          style={{
            color: displayText ? colors.text.primary : colors.text.tertiary,
            ...styles.valueText,
          }}
          numberOfLines={1}
        >
          {displayText ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.text.secondary} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          style={styles.modalContainer}
        >
          {/* Backdrop */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              closeModal();
            }}
          />

          {/* Bottom Sheet */}
          <View
            style={{
              ...styles.sheet,
              backgroundColor: colors.bg.primary,
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <View style={{ ...styles.sheetHeader, borderColor: colors.border }}>
              <Text
                style={{ color: colors.text.primary, ...styles.sheetTitle }}
              >
                {label ?? placeholder}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons
                  name="close"
                  size={22}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>

            <View
              style={{
                backgroundColor: colors.bg.secondary,
                borderColor: colors.border,
                ...styles.searchContainer,
              }}
            >
              <Ionicons name="search" size={18} color={colors.text.secondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search"
                placeholderTextColor={colors.text.tertiary}
                style={{
                  color: colors.text.primary,
                  ...styles.searchInput,
                }}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              )}
              {isFetching && (
                <ActivityIndicator
                  size="small"
                  color={colors.info}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>

            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              style={styles.list}
              ListHeaderComponent={
                (allowCustomValue || onAddNew) &&
                search.trim() &&
                !searchMatchesExisting ? (
                  <TouchableOpacity
                    style={{
                      ...styles.addNewRow,
                      backgroundColor: colors.info + "15",
                      borderBottomColor: colors.border,
                    }}
                    onPress={handleAddCustom}
                  >
                    <Ionicons name="add-circle" size={20} color={colors.info} />
                    <Text style={{ ...styles.addNewText, color: colors.info }}>
                      {addNewLabel
                        ? `+ Add "${search.trim()}" as ${addNewLabel}`
                        : `Add "${search.trim()}"`}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
              ListFooterComponent={
                hasMore ? (
                  <View
                    style={{
                      ...styles.moreHint,
                      backgroundColor: colors.bg.tertiary,
                    }}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={colors.text.secondary}
                    />
                    <Text
                      style={{
                        ...styles.moreHintText,
                        color: colors.text.secondary,
                      }}
                    >
                      Showing 50 of {totalCount}. Type to search for more.
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                allowCustomValue && !search.trim() ? (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="search-outline"
                      size={32}
                      color={colors.text.tertiary}
                    />
                    <Text
                      style={{
                        ...styles.emptyStateText,
                        color: colors.text.secondary,
                      }}
                    >
                      Type to search or add new
                    </Text>
                  </View>
                ) : !allowCustomValue && filteredItems.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="folder-open-outline"
                      size={32}
                      color={colors.text.tertiary}
                    />
                    <Text
                      style={{
                        ...styles.emptyStateText,
                        color: colors.text.secondary,
                      }}
                    >
                      No options available
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                if (item.type === "GROUP") {
                  return (
                    <Text
                      style={{
                        ...styles.groupLabel,
                        color: colors.text.secondary,
                      }}
                    >
                      {item.title}
                    </Text>
                  );
                }
                const isSelected = item.option.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      {
                        ...styles.optionRow,
                        borderBottomColor: colors.border,
                      },
                      isSelected && {
                        ...styles.optionSelected,
                        backgroundColor: colors.info + "15",
                      },
                    ]}
                    onPress={() => handleSelect(item.option)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          ...styles.optionLabel,
                          color: colors.text.primary,
                        }}
                      >
                        {item.option.label}
                      </Text>
                      {item.option.subtitle ? (
                        <Text
                          style={{
                            ...styles.optionSubtitle,
                            color: colors.text.secondary,
                          }}
                        >
                          {item.option.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.info}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={{ paddingBottom: 16 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "600",
  },
  trigger: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  valueText: {
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  placeholderText: {
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.35)",
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    maxHeight: "80%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  list: {
    flexGrow: 0,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    marginLeft: 8,
    flex: 1,
    fontSize: 15,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
  },
  optionRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionSelected: {
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  optionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  addNewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  addNewText: {
    fontSize: 15,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: "center",
  },
  moreHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  moreHintText: {
    fontSize: 13,
    textAlign: "center",
  },
});

export default SearchableSelect;
