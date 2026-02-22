import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { ColumnMapping } from "@/services/imports";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldConfig = {
  key: keyof ColumnMapping;
  label: string;
  icon: string;
  description: string;
  required?: boolean;
};

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: "date",
    label: "Date",
    icon: "calendar-outline",
    description: "Transaction date column",
    required: true,
  },
  {
    key: "description",
    label: "Description",
    icon: "document-text-outline",
    description: "Transaction description/narration",
  },
  {
    key: "counterparty",
    label: "Counterparty",
    icon: "person-outline",
    description: "Payee/Payer name",
  },
  {
    key: "debit",
    label: "Debit Amount",
    icon: "arrow-down-outline",
    description: "Withdrawal/Debit column",
  },
  {
    key: "credit",
    label: "Credit Amount",
    icon: "arrow-up-outline",
    description: "Deposit/Credit column",
  },
  {
    key: "amount",
    label: "Amount (Combined)",
    icon: "cash-outline",
    description: "Single amount column (if no separate debit/credit)",
  },
  {
    key: "type",
    label: "Type",
    icon: "swap-horizontal-outline",
    description: "Transaction type (Debit/Credit)",
  },
  {
    key: "balance",
    label: "Balance",
    icon: "wallet-outline",
    description: "Running balance (for reference only)",
  },
];

// ─── Column Picker Modal ─────────────────────────────────────────────────────

function ColumnPickerModal({
  visible,
  onClose,
  columns,
  selectedColumn,
  onSelect,
  fieldLabel,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  columns: string[];
  selectedColumn?: string;
  onSelect: (column: string | undefined) => void;
  fieldLabel: string;
  colors: any;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: colors.modalOverlay }}
      >
        <View
          className="rounded-t-3xl max-h-[70%]"
          style={{ backgroundColor: colors.bg.primary }}
        >
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: colors.border }}
          >
            <Text
              style={{ color: colors.text.primary }}
              className="text-lg font-bold"
            >
              Map: {fieldLabel}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons
                name="close-circle"
                size={28}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>

          {/* Clear option */}
          <TouchableOpacity
            onPress={() => {
              onSelect(undefined);
              onClose();
            }}
            className="flex-row items-center px-5 py-3.5 border-b"
            style={{
              borderColor: colors.border,
              backgroundColor: !selectedColumn
                ? colors.info + "10"
                : "transparent",
            }}
          >
            <Ionicons
              name="close-outline"
              size={20}
              color={colors.text.tertiary}
            />
            <Text
              style={{ color: colors.text.secondary }}
              className="ml-3 text-base"
            >
              None (unmapped)
            </Text>
          </TouchableOpacity>

          {/* Column options */}
          <FlatList
            data={columns}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                className="flex-row items-center px-5 py-3.5 border-b"
                style={{
                  borderColor: colors.border,
                  backgroundColor:
                    selectedColumn === item
                      ? colors.info + "10"
                      : "transparent",
                }}
              >
                <Ionicons
                  name={
                    selectedColumn === item
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={20}
                  color={selectedColumn === item ? colors.info : colors.border}
                />
                <Text
                  style={{
                    color:
                      selectedColumn === item
                        ? colors.info
                        : colors.text.primary,
                  }}
                  className="ml-3 text-base font-medium"
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ColumnMappingEditorProps = {
  detectedColumns: string[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
};

export function ColumnMappingEditor({
  detectedColumns,
  mapping,
  onMappingChange,
}: ColumnMappingEditorProps) {
  const { colors } = useTheme();
  const [pickerField, setPickerField] = useState<keyof ColumnMapping | null>(
    null,
  );

  const activeField = FIELD_CONFIGS.find((f) => f.key === pickerField);

  return (
    <View className="px-4 py-3">
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons name="grid-outline" size={18} color={colors.info} />
        <Text
          style={{ color: colors.text.primary }}
          className="text-base font-bold"
        >
          Column Mapping
        </Text>
      </View>
      <Text style={{ color: colors.text.secondary }} className="text-sm mb-4">
        Map your file columns to the correct fields. The system auto-detected
        some mappings — adjust as needed.
      </Text>

      {/* Detected Columns Chips */}
      <View className="mb-4">
        <Text
          style={{ color: colors.text.tertiary }}
          className="text-xs font-semibold mb-2 uppercase tracking-wider"
        >
          Detected Columns
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {detectedColumns.map((col, idx) => (
            <View
              key={`${col}-${idx}`}
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: colors.bg.tertiary }}
            >
              <Text
                style={{ color: colors.text.secondary }}
                className="text-xs font-medium"
              >
                {col}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Field Mapping List */}
      {FIELD_CONFIGS.map((field) => {
        const mappedColumn = mapping[field.key];
        const isMapped = Boolean(mappedColumn);

        return (
          <TouchableOpacity
            key={field.key}
            onPress={() => setPickerField(field.key)}
            className="flex-row items-center p-3.5 rounded-xl mb-2 border"
            style={{
              backgroundColor: isMapped
                ? colors.info + "08"
                : colors.bg.secondary,
              borderColor: isMapped ? colors.info + "30" : colors.border,
            }}
          >
            <View
              className="w-9 h-9 rounded-lg items-center justify-center mr-3"
              style={{
                backgroundColor: isMapped
                  ? colors.info + "20"
                  : colors.bg.tertiary,
              }}
            >
              <Ionicons
                name={field.icon as any}
                size={18}
                color={isMapped ? colors.info : colors.text.tertiary}
              />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-1">
                <Text
                  style={{ color: colors.text.primary }}
                  className="text-sm font-semibold"
                >
                  {field.label}
                </Text>
                {field.required && (
                  <Text style={{ color: colors.error }} className="text-xs">
                    *
                  </Text>
                )}
              </View>
              <Text
                style={{ color: colors.text.tertiary }}
                className="text-xs"
                numberOfLines={1}
              >
                {isMapped ? `→ ${mappedColumn}` : field.description}
              </Text>
            </View>

            <View
              className="px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: isMapped
                  ? colors.success + "20"
                  : colors.bg.tertiary,
              }}
            >
              <Text
                style={{
                  color: isMapped ? colors.success : colors.text.tertiary,
                }}
                className="text-xs font-medium"
              >
                {isMapped ? "Mapped" : "Set"}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Column Picker Modal */}
      <ColumnPickerModal
        visible={pickerField !== null}
        onClose={() => setPickerField(null)}
        columns={detectedColumns}
        selectedColumn={pickerField ? mapping[pickerField] : undefined}
        onSelect={(column) => {
          if (pickerField) {
            onMappingChange({ ...mapping, [pickerField]: column });
          }
        }}
        fieldLabel={activeField?.label || ""}
        colors={colors}
      />
    </View>
  );
}
