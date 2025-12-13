import { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
}: SearchableSelectProps) => {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const { filteredItems, hasMore, totalCount } = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const isSearching = normalizedSearch.length > 0;

    // Filter options based on search
    let filtered = options.filter((option) => {
      if (!isSearching) return true;
      return (
        option.label.toLowerCase().includes(normalizedSearch) ||
        option.subtitle?.toLowerCase().includes(normalizedSearch) ||
        option.group?.toLowerCase().includes(normalizedSearch)
      );
    });

    const totalCount = filtered.length;
    let hasMore = false;

    // Limit to 50 when not searching, show all when searching
    if (!isSearching && filtered.length > 50) {
      hasMore = true;
      filtered = filtered.slice(0, 50);
    }

    const items: RenderItem[] = [];
    let previousGroup: string | undefined;
    let fallbackCounter = 0;

    filtered.forEach((option) => {
      if (option.group && option.group !== previousGroup) {
        items.push({
          type: "GROUP",
          id: `group-${option.group}`,
          title: option.group,
        });
        previousGroup = option.group;
      }
      const id =
        option.value && option.value.length > 0
          ? option.value
          : `option-empty-${fallbackCounter++}`;
      items.push({ type: "OPTION", id, option });
    });

    return { filteredItems: items, hasMore, totalCount };
  }, [options, search]);

  const handleSelect = (option: SelectOption) => {
    onSelect(option.value, option);
    closeModal();
  };

  const closeModal = () => {
    setVisible(false);
    setSearch("");
  };

  // For custom values, show the customDisplayValue if provided and no option matches
  const displayText = useMemo(() => {
    if (selectedOption) return selectedOption.label;
    if (allowCustomValue && customDisplayValue) return customDisplayValue;
    return null;
  }, [selectedOption, allowCustomValue, customDisplayValue]);

  // Check if search text matches any existing option
  const searchMatchesExisting = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return true;
    return options.some(
      (option) => option.label.toLowerCase() === normalizedSearch
    );
  }, [options, search]);

  const handleAddCustom = () => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) return;
    const customOption: SelectOption = {
      value: trimmedSearch,
      label: trimmedSearch,
    };
    onSelect(trimmedSearch, customOption);
    closeModal();
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.85}
      >
        <Text
          style={displayText ? styles.valueText : styles.placeholderText}
          numberOfLines={1}
        >
          {displayText ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeModal}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheet}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label ?? placeholder}</Text>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#6b7280" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search"
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              allowCustomValue && search.trim() && !searchMatchesExisting ? (
                <TouchableOpacity
                  style={styles.addNewRow}
                  onPress={handleAddCustom}
                >
                  <Ionicons name="add-circle" size={20} color="#2563eb" />
                  <Text style={styles.addNewText}>
                    Add &quot;{search.trim()}&quot;
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            ListFooterComponent={
              hasMore ? (
                <View style={styles.moreHint}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color="#6b7280"
                  />
                  <Text style={styles.moreHintText}>
                    Showing 50 of {totalCount}. Type to search for more.
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              allowCustomValue && !search.trim() ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={32} color="#9ca3af" />
                  <Text style={styles.emptyStateText}>
                    Type to search or add new
                  </Text>
                </View>
              ) : !allowCustomValue && filteredItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="folder-open-outline"
                    size={32}
                    color="#9ca3af"
                  />
                  <Text style={styles.emptyStateText}>
                    No options available
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              if (item.type === "GROUP") {
                return <Text style={styles.groupLabel}>{item.title}</Text>;
              }
              const isSelected = item.option.value === value;
              return (
                <TouchableOpacity
                  style={[
                    styles.optionRow,
                    isSelected && styles.optionSelected,
                  ]}
                  onPress={() => handleSelect(item.option)}
                >
                  <View>
                    <Text style={styles.optionLabel}>{item.option.label}</Text>
                    {item.option.subtitle ? (
                      <Text style={styles.optionSubtitle}>
                        {item.option.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={18} color="#2563eb" />
                  ) : null}
                </TouchableOpacity>
              );
            }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 100 }}
          />
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
    color: "#374151",
    marginBottom: 6,
    fontWeight: "600",
  },
  trigger: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    backgroundColor: "#f9fafb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  valueText: {
    color: "#111827",
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  placeholderText: {
    color: "#9ca3af",
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
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
    color: "#111827",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    backgroundColor: "#f9fafb",
  },
  searchInput: {
    marginLeft: 8,
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    marginTop: 8,
    marginBottom: 4,
  },
  optionRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionSelected: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  optionLabel: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  optionSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  addNewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  addNewText: {
    fontSize: 15,
    color: "#2563eb",
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
    color: "#9ca3af",
    textAlign: "center",
  },
  moreHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  moreHintText: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
  },
});

export default SearchableSelect;
