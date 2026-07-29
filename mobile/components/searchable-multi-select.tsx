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
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../hooks/use-theme";
import type { SelectOption } from "./searchable-select";

type SearchableMultiSelectProps = {
  values: string[];
  placeholder?: string;
  options: SelectOption[];
  onChange: (values: string[], options: SelectOption[]) => void;
  disabled?: boolean;
  label?: string;
  /** Soft limit — selecting beyond this is allowed only if caller trims the other field */
  maxCount?: number;
  fetchOptions?: (search: string) => Promise<SelectOption[]>;
  onAddNew?: (name: string) => Promise<SelectOption | null>;
  addNewLabel?: string;
  /** Called when user tries to add while at maxCount */
  onMaxReached?: () => void;
  /** Called when the options sheet is opened */
  onOpen?: () => void;
};

type RenderItem =
  | { type: "GROUP"; id: string; title: string }
  | { type: "OPTION"; id: string; option: SelectOption };

export function SearchableMultiSelect({
  values,
  placeholder = "Select",
  options,
  onChange,
  disabled,
  label,
  maxCount,
  fetchOptions,
  onAddNew,
  addNewLabel,
  onMaxReached,
  onOpen,
}: SearchableMultiSelectProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [asyncOptions, setAsyncOptions] = useState<SelectOption[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [labelCache, setLabelCache] = useState<Record<string, string>>({});
  const [localExtras, setLocalExtras] = useState<SelectOption[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // Keep the full list loaded while the sheet is open.
  // Empty search → full list; typing → filtered results. Never wipe the list on clear.
  useEffect(() => {
    if (!visible || !fetchOptions) return;
    let cancelled = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const run = async (query: string) => {
      setIsFetching(true);
      try {
        const results = await fetchOptions(query);
        if (!cancelled) setAsyncOptions(results);
      } catch {
        if (!cancelled) setAsyncOptions([]);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };

    const trimmed = search.trim();
    if (!trimmed) {
      void run("");
      return () => {
        cancelled = true;
      };
    }

    debounceRef.current = setTimeout(() => {
      void run(trimmed);
    }, 300);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [visible, search, fetchOptions]);

  // When parent resolves __new__: temp ids to real party ids, refresh local extras
  useEffect(() => {
    setLocalExtras((prev) => {
      if (!prev.length) return prev;
      let changed = false;
      const next = prev.map((extra) => {
        if (!extra.value.startsWith("__new__:")) return extra;
        const resolved = options.find(
          (o) =>
            !o.value.startsWith("__new__:") &&
            o.label.toLowerCase() === extra.label.toLowerCase(),
        );
        if (resolved) {
          changed = true;
          return resolved;
        }
        return extra;
      });
      return changed ? next : prev;
    });
  }, [options]);

  // Also swap label-cache keys when values replace a temp id
  useEffect(() => {
    setLabelCache((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const v of values) {
        if (v.startsWith("__new__:") || next[v]) continue;
        const fromExtra = localExtras.find((e) => e.value === v);
        if (fromExtra) {
          next[v] = fromExtra.label;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [values, localExtras]);

  // Reset ephemeral extras when the sheet closes
  useEffect(() => {
    if (!visible) {
      setLocalExtras([]);
      setIsAdding(false);
    }
  }, [visible]);

  const mergedOptions = useMemo(() => {
    const byValue = new Map<string, SelectOption>();
    for (const o of options) byValue.set(o.value, o);
    for (const o of asyncOptions) {
      if (!byValue.has(o.value)) byValue.set(o.value, o);
    }
    for (const o of localExtras) {
      byValue.set(o.value, o);
    }
    // Keep selected items visible even if the current fetch page omitted them
    for (const v of values) {
      if (!byValue.has(v)) {
        const label = labelCache[v];
        if (label) byValue.set(v, { value: v, label });
      }
    }
    return Array.from(byValue.values());
  }, [options, asyncOptions, localExtras, values, labelCache]);

  const selectedOptions = useMemo(() => {
    return values.map((v) => {
      const found = mergedOptions.find((o) => o.value === v);
      if (found) return found;
      const cached = labelCache[v];
      return { value: v, label: cached || v } as SelectOption;
    });
  }, [values, mergedOptions, labelCache]);

  const { filteredItems, hasMore, totalCount } = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const isSearching = normalizedSearch.length > 0;

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

    // Keep a generous visible list so bulk pickers feel fully populated
    const LIST_LIMIT = 100;
    if (!isSearching && filtered.length > LIST_LIMIT) {
      hasMore = true;
      const selectedSet = new Set(values);
      const selected = filtered.filter((o) => selectedSet.has(o.value));
      const rest = filtered.filter((o) => !selectedSet.has(o.value));
      filtered = [
        ...selected,
        ...rest.slice(0, Math.max(0, LIST_LIMIT - selected.length)),
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
  }, [mergedOptions, search, values]);

  const closeModal = () => {
    setVisible(false);
    setSearch("");
  };

  const searchMatchesExisting = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return true;
    return mergedOptions.some(
      (option) => option.label.toLowerCase() === normalizedSearch,
    );
  }, [mergedOptions, search]);

  const resolveOptionList = (nextValues: string[], known: SelectOption[]) => {
    const byValue = new Map<string, SelectOption>();
    for (const o of [...mergedOptions, ...known, ...selectedOptions]) {
      byValue.set(o.value, o);
    }
    return nextValues.map(
      (v) => byValue.get(v) || { value: v, label: labelCache[v] || v },
    );
  };

  const toggleOption = (option: SelectOption) => {
    setLabelCache((prev) => ({ ...prev, [option.value]: option.label }));
    const exists = values.includes(option.value);
    if (exists) {
      const next = values.filter((v) => v !== option.value);
      onChange(next, resolveOptionList(next, [option]));
      return;
    }
    if (maxCount != null && values.length >= maxCount) {
      onMaxReached?.();
      return;
    }
    const next = [...values, option.value];
    onChange(next, resolveOptionList(next, [option]));
  };

  const removeValue = (value: string) => {
    const next = values.filter((v) => v !== value);
    onChange(next, resolveOptionList(next, []));
  };

  const handleAddCustom = async () => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch || !onAddNew || isAdding) return;
    if (maxCount != null && valuesRef.current.length >= maxCount) {
      onMaxReached?.();
      return;
    }

    // If an option with the same label already exists, select it instead of creating
    const existing = mergedOptions.find(
      (o) => o.label.toLowerCase() === trimmedSearch.toLowerCase(),
    );
    if (existing) {
      setLabelCache((prev) => ({ ...prev, [existing.value]: existing.label }));
      if (!valuesRef.current.includes(existing.value)) {
        const next = [...valuesRef.current, existing.value];
        onChange(next, resolveOptionList(next, [existing]));
      }
      setSearch("");
      return;
    }

    setIsAdding(true);
    try {
      const newOption = await onAddNew(trimmedSearch);
      if (!newOption?.value) return;

      setLabelCache((prev) => ({
        ...prev,
        [newOption.value]: newOption.label,
      }));
      setLocalExtras((prev) => {
        if (prev.some((p) => p.value === newOption.value)) return prev;
        return [...prev, newOption];
      });

      const current = valuesRef.current;
      const next = current.includes(newOption.value)
        ? current
        : [...current, newOption.value];
      onChange(next, resolveOptionList(next, [newOption]));
      setSearch("");
    } catch {
      // Parent / API error — keep search so user can retry
    } finally {
      setIsAdding(false);
    }
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
        onPress={() => {
          if (disabled) return;
          onOpen?.();
          setVisible(true);
        }}
        activeOpacity={0.85}
      >
        {selectedOptions.length > 0 ? (
          <View style={styles.chipWrap}>
            {selectedOptions.map((opt) => (
              <View
                key={opt.value}
                style={{
                  ...styles.chip,
                  backgroundColor: colors.info + "22",
                  borderColor: colors.info + "55",
                }}
              >
                <Text
                  style={{ ...styles.chipText, color: colors.info }}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => !disabled && removeValue(opt.value)}
                >
                  <Ionicons name="close-circle" size={16} color={colors.info} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text
            style={{
              color: colors.text.tertiary,
              ...styles.valueText,
            }}
            numberOfLines={1}
          >
            {placeholder}
          </Text>
        )}
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
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              closeModal();
            }}
          />

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
              <TouchableOpacity
                onPress={closeModal}
                style={{
                  ...styles.doneBtn,
                  backgroundColor: colors.info + "22",
                }}
              >
                <Text style={{ color: colors.info, fontWeight: "700" }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            {selectedOptions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.selectedStrip}
                contentContainerStyle={styles.selectedStripContent}
              >
                {selectedOptions.map((opt) => (
                  <View
                    key={opt.value}
                    style={{
                      ...styles.chip,
                      backgroundColor: colors.info + "22",
                      borderColor: colors.info + "55",
                    }}
                  >
                    <Text
                      style={{ ...styles.chipText, color: colors.info }}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() => removeValue(opt.value)}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={colors.info}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}

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
                placeholder="Search or type to add"
                placeholderTextColor={colors.text.tertiary}
                style={{
                  color: colors.text.primary,
                  ...styles.searchInput,
                }}
                autoFocus
                onSubmitEditing={() => {
                  if (
                    onAddNew &&
                    search.trim() &&
                    !searchMatchesExisting &&
                    !isAdding
                  ) {
                    void handleAddCustom();
                  }
                }}
                returnKeyType={
                  onAddNew && search.trim() && !searchMatchesExisting
                    ? "done"
                    : "search"
                }
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

            {onAddNew && search.trim() && !searchMatchesExisting ? (
              <TouchableOpacity
                style={{
                  ...styles.addNewRow,
                  backgroundColor: colors.info + "15",
                  borderBottomColor: colors.border,
                  opacity: isAdding ? 0.6 : 1,
                }}
                disabled={isAdding}
                onPress={() => void handleAddCustom()}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color={colors.info} />
                ) : (
                  <Ionicons name="pricetag" size={20} color={colors.info} />
                )}
                <Text style={{ ...styles.addNewText, color: colors.info }}>
                  {isAdding
                    ? `Adding "${search.trim()}"…`
                    : addNewLabel
                      ? `+ Add "${search.trim()}" as ${addNewLabel}`
                      : `+ Add "${search.trim()}"`}
                </Text>
              </TouchableOpacity>
            ) : null}

            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              style={styles.list}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={7}
              removeClippedSubviews={false}
              ListHeaderComponent={null}
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
                      Showing 100 of {totalCount}. Type to search for more.
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                isFetching ? (
                  <View style={styles.emptyState}>
                    <ActivityIndicator size="small" color={colors.info} />
                    <Text
                      style={{
                        ...styles.emptyStateText,
                        color: colors.text.secondary,
                      }}
                    >
                      Loading…
                    </Text>
                  </View>
                ) : filteredItems.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name={
                        search.trim()
                          ? "search-outline"
                          : "folder-open-outline"
                      }
                      size={32}
                      color={colors.text.tertiary}
                    />
                    <Text
                      style={{
                        ...styles.emptyStateText,
                        color: colors.text.secondary,
                      }}
                    >
                      {search.trim()
                        ? onAddNew
                          ? `No match for "${search.trim()}". Add it as a new tag above.`
                          : `No match for "${search.trim()}"`
                        : "No options available"}
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
                const isSelected = values.includes(item.option.value);
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
                    onPress={() => toggleOption(item.option)}
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
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={22}
                      color={isSelected ? colors.info : colors.text.tertiary}
                    />
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
}

const styles = StyleSheet.create({
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
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  valueText: {
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  chipWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginRight: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 160,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
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
    maxHeight: "85%",
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
    flex: 1,
    marginRight: 12,
  },
  doneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  selectedStrip: {
    maxHeight: 44,
    marginBottom: 10,
  },
  selectedStripContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 8,
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

export default SearchableMultiSelect;
