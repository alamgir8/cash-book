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
}: SearchableSelectProps) => {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const filteredItems = useMemo<RenderItem[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = options.filter((option) => {
      if (normalizedSearch.length === 0) return true;
      return (
        option.label.toLowerCase().includes(normalizedSearch) ||
        option.subtitle?.toLowerCase().includes(normalizedSearch) ||
        option.group?.toLowerCase().includes(normalizedSearch)
      );
    });

    const items: RenderItem[] = [];
    let previousGroup: string | undefined;

    filtered.forEach((option) => {
      if (option.group && option.group !== previousGroup) {
        items.push({ type: "GROUP", id: `group-${option.group}`, title: option.group });
        previousGroup = option.group;
      }
      items.push({ type: "OPTION", id: option.value, option });
    });

    return items;
  }, [options, search]);

  const handleSelect = (option: SelectOption) => {
    onSelect(option.value, option);
    setVisible(false);
    setSearch("");
  };

  const closeModal = () => {
    setVisible(false);
    setSearch("");
  };

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.85}
      >
        <Text
          style={selectedOption ? styles.valueText : styles.placeholderText}
          numberOfLines={1}
        >
          {selectedOption?.label ?? placeholder}
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
        <View style={styles.sheet}>
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
            renderItem={({ item }) => {
              if (item.type === "GROUP") {
                return <Text style={styles.groupLabel}>{item.title}</Text>;
              }
              const isSelected = item.option.value === value;
              return (
                <TouchableOpacity
                  style={[styles.optionRow, isSelected && styles.optionSelected]}
                  onPress={() => handleSelect(item.option)}
                >
                  <View>
                    <Text style={styles.optionLabel}>{item.option.label}</Text>
                    {item.option.subtitle ? (
                      <Text style={styles.optionSubtitle}>{item.option.subtitle}</Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={18} color="#2563eb" />
                  ) : null}
                </TouchableOpacity>
              );
            }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </View>
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
});

export default SearchableSelect;
