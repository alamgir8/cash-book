import React, { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { ImportItem, ImportRecord } from "@/services/imports";

// ─── Item Update Payload ──────────────────────────────────────────────────────

export type ItemUpdatePayload = {
  itemId: string;
  type?: "debit" | "credit";
  status?: "pending" | "skipped";
  amount?: number;
  date?: string;
  description?: string;
  counterparty?: string;
};

// ─── Edit Item Modal ──────────────────────────────────────────────────────────

function EditItemModal({
  item,
  visible,
  onClose,
  onSave,
  colors,
}: {
  item: ImportItem | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updates: ItemUpdatePayload) => void;
  colors: any;
}) {
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCounterparty, setEditCounterparty] = useState("");
  const [editType, setEditType] = useState<"debit" | "credit">("debit");

  // Sync local state when item changes
  React.useEffect(() => {
    if (item) {
      setEditAmount(item.amount?.toString() || "");
      setEditDate(
        item.date
          ? new Date(item.date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : item.raw_date || "",
      );
      setEditDescription(item.description || item.raw_description || "");
      setEditCounterparty(item.counterparty || item.raw_counterparty || "");
      setEditType(item.type || "debit");
    }
  }, [item]);

  if (!item) return null;

  const handleSave = () => {
    const updates: ItemUpdatePayload = { itemId: item._id };
    let hasChanges = false;

    // Amount
    const newAmount = parseFloat(editAmount);
    if (!isNaN(newAmount) && newAmount !== item.amount) {
      updates.amount = newAmount;
      hasChanges = true;
    }

    // Type
    if (editType !== item.type) {
      updates.type = editType;
      hasChanges = true;
    }

    // Description
    const origDesc = item.description || item.raw_description || "";
    if (editDescription.trim() !== origDesc) {
      updates.description = editDescription.trim();
      hasChanges = true;
    }

    // Counterparty
    const origCp = item.counterparty || item.raw_counterparty || "";
    if (editCounterparty.trim() !== origCp) {
      updates.counterparty = editCounterparty.trim();
      hasChanges = true;
    }

    // Date — try to parse DD/MM/YYYY
    if (editDate.trim()) {
      const parts = editDate.trim().split(/[\/\-\.]/);
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (d > 0 && m > 0 && y > 0) {
          const fullYear = y < 100 ? 2000 + y : y;
          const dateObj = new Date(fullYear, m - 1, d);
          if (!isNaN(dateObj.getTime())) {
            const origDate = item.date
              ? new Date(item.date).toISOString()
              : null;
            const newDateISO = dateObj.toISOString();
            if (newDateISO !== origDate) {
              updates.date = newDateISO;
              hasChanges = true;
            }
          }
        }
      }
    }

    if (hasChanges) {
      onSave(updates);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.bg.primary,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "85%",
            }}
          >
            {/* Handle bar */}
            <View className="items-center pt-3 pb-1">
              <View
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: colors.border }}
              />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pb-3">
              <Text
                style={{ color: colors.text.primary }}
                className="text-lg font-bold"
              >
                Edit Transaction
              </Text>
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
              {/* Row info */}
              <View
                className="flex-row items-center gap-2 mb-4 px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.info + "10" }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={14}
                  color={colors.info}
                />
                <Text
                  style={{ color: colors.info }}
                  className="text-xs font-medium"
                >
                  Row {item.row_index + 1}
                </Text>
                {item.account_name && (
                  <>
                    <Text
                      style={{ color: colors.text.tertiary }}
                      className="text-xs"
                    >
                      •
                    </Text>
                    <Text
                      style={{ color: colors.info }}
                      className="text-xs font-medium"
                    >
                      {item.account_name}
                    </Text>
                  </>
                )}
              </View>

              {/* Amount */}
              <View className="mb-4">
                <Text
                  style={{ color: colors.text.secondary }}
                  className="text-xs font-semibold mb-1.5 uppercase tracking-wider"
                >
                  Amount
                </Text>
                <TextInput
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.text.tertiary}
                  style={{
                    backgroundColor: colors.input,
                    color: colors.text.primary,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                />
                {item.raw_amount && (
                  <Text
                    style={{ color: colors.text.tertiary }}
                    className="text-xs mt-1"
                  >
                    Original: {item.raw_amount}
                  </Text>
                )}
              </View>

              {/* Type */}
              <View className="mb-4">
                <Text
                  style={{ color: colors.text.secondary }}
                  className="text-xs font-semibold mb-1.5 uppercase tracking-wider"
                >
                  Type
                </Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setEditType("debit")}
                    className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl"
                    style={{
                      backgroundColor:
                        editType === "debit"
                          ? colors.error + "15"
                          : "transparent",
                      borderWidth: 1.5,
                      borderColor:
                        editType === "debit" ? colors.error : colors.border,
                    }}
                  >
                    <Ionicons
                      name="arrow-down"
                      size={16}
                      color={
                        editType === "debit"
                          ? colors.error
                          : colors.text.tertiary
                      }
                    />
                    <Text
                      style={{
                        color:
                          editType === "debit"
                            ? colors.error
                            : colors.text.tertiary,
                      }}
                      className="text-sm font-bold"
                    >
                      Debit (Expense)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEditType("credit")}
                    className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl"
                    style={{
                      backgroundColor:
                        editType === "credit"
                          ? colors.success + "15"
                          : "transparent",
                      borderWidth: 1.5,
                      borderColor:
                        editType === "credit" ? colors.success : colors.border,
                    }}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={16}
                      color={
                        editType === "credit"
                          ? colors.success
                          : colors.text.tertiary
                      }
                    />
                    <Text
                      style={{
                        color:
                          editType === "credit"
                            ? colors.success
                            : colors.text.tertiary,
                      }}
                      className="text-sm font-bold"
                    >
                      Credit (Income)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date */}
              <View className="mb-4">
                <Text
                  style={{ color: colors.text.secondary }}
                  className="text-xs font-semibold mb-1.5 uppercase tracking-wider"
                >
                  Date (DD/MM/YYYY)
                </Text>
                <TextInput
                  value={editDate}
                  onChangeText={setEditDate}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={colors.text.tertiary}
                  style={{
                    backgroundColor: colors.input,
                    color: colors.text.primary,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 15,
                  }}
                />
                {item.raw_date && (
                  <Text
                    style={{ color: colors.text.tertiary }}
                    className="text-xs mt-1"
                  >
                    Original: {item.raw_date}
                  </Text>
                )}
              </View>

              {/* Description */}
              <View className="mb-4">
                <Text
                  style={{ color: colors.text.secondary }}
                  className="text-xs font-semibold mb-1.5 uppercase tracking-wider"
                >
                  Description
                </Text>
                <TextInput
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Transaction description"
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  numberOfLines={2}
                  style={{
                    backgroundColor: colors.input,
                    color: colors.text.primary,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 15,
                    minHeight: 56,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              {/* Counterparty */}
              <View className="mb-6">
                <Text
                  style={{ color: colors.text.secondary }}
                  className="text-xs font-semibold mb-1.5 uppercase tracking-wider"
                >
                  Counterparty / Party
                </Text>
                <TextInput
                  value={editCounterparty}
                  onChangeText={setEditCounterparty}
                  placeholder="Person or company name"
                  placeholderTextColor={colors.text.tertiary}
                  style={{
                    backgroundColor: colors.input,
                    color: colors.text.primary,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 15,
                  }}
                />
              </View>

              {/* Buttons */}
              <View className="flex-row gap-3 mb-8">
                <TouchableOpacity
                  onPress={onClose}
                  className="flex-1 py-3.5 rounded-xl items-center"
                  style={{
                    backgroundColor: colors.bg.tertiary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{ color: colors.text.secondary }}
                    className="text-sm font-semibold"
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  className="flex-1 py-3.5 rounded-xl items-center"
                  style={{ backgroundColor: colors.info }}
                >
                  <Text
                    style={{ color: "#FFFFFF" }}
                    className="text-sm font-bold"
                  >
                    Save Changes
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Import Item Card ─────────────────────────────────────────────────────────

function ImportItemCard({
  item,
  index,
  colors,
  onToggleSkip,
  onEditType,
  onEdit,
}: {
  item: ImportItem;
  index: number;
  colors: any;
  onToggleSkip: (itemId: string) => void;
  onEditType: (itemId: string, type: "debit" | "credit") => void;
  onEdit: (item: ImportItem) => void;
}) {
  const isSkipped = item.status === "skipped";
  const isImported = item.status === "imported";
  const isFailed = item.status === "failed";

  const statusColor = isImported
    ? colors.success
    : isFailed
      ? colors.error
      : isSkipped
        ? colors.warning
        : colors.text.secondary;

  const statusIcon = isImported
    ? "checkmark-circle"
    : isFailed
      ? "close-circle"
      : isSkipped
        ? "remove-circle"
        : "ellipse-outline";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => !isImported && onEdit(item)}
      style={{
        backgroundColor: isSkipped
          ? colors.bg.tertiary + "40"
          : colors.bg.secondary,
        borderColor: isFailed ? colors.error + "40" : colors.border,
        opacity: isSkipped ? 0.7 : 1,
      }}
      className="rounded-xl p-3.5 mb-2.5 border"
    >
      {/* Row Header */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <View
            style={{ backgroundColor: colors.info + "20" }}
            className="w-7 h-7 rounded-full items-center justify-center"
          >
            <Text style={{ color: colors.info }} className="text-xs font-bold">
              {index + 1}
            </Text>
          </View>
          <Ionicons name={statusIcon as any} size={16} color={statusColor} />
          {item.status !== "pending" && (
            <Text
              style={{ color: statusColor }}
              className="text-xs font-medium"
            >
              {item.status === "imported"
                ? "Imported"
                : item.status === "failed"
                  ? "Failed"
                  : "Skipped"}
            </Text>
          )}
        </View>

        {/* Skip toggle (only for pending/skipped) */}
        {!isImported && !isFailed && (
          <TouchableOpacity
            onPress={() => onToggleSkip(item._id)}
            className="px-3 py-1 rounded-full"
            style={{
              backgroundColor: isSkipped
                ? colors.success + "20"
                : colors.warning + "20",
            }}
          >
            <Text
              style={{
                color: isSkipped ? colors.success : colors.warning,
              }}
              className="text-xs font-semibold"
            >
              {isSkipped ? "Include" : "Skip"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date & Amount Row */}
      <View className="flex-row items-center justify-between mb-1.5">
        <View className="flex-row items-center gap-1.5">
          <Ionicons
            name="calendar-outline"
            size={14}
            color={colors.text.tertiary}
          />
          <Text style={{ color: colors.text.secondary }} className="text-sm">
            {item.date
              ? new Date(item.date).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : item.raw_date || "No date"}
          </Text>
        </View>

        <Text
          style={{
            color: item.type === "credit" ? colors.success : colors.error,
          }}
          className="text-base font-bold"
        >
          {item.type === "credit" ? "+" : "-"}
          {item.amount?.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) || "0.00"}
        </Text>
      </View>

      {/* Description */}
      {(item.description || item.raw_description) && (
        <Text
          style={{ color: colors.text.primary }}
          className="text-sm mb-1"
          numberOfLines={2}
        >
          {item.description || item.raw_description}
        </Text>
      )}

      {/* Counterparty */}
      {(item.counterparty || item.raw_counterparty) && (
        <View className="flex-row items-center gap-1 mb-1.5">
          <Ionicons
            name="person-outline"
            size={12}
            color={colors.text.tertiary}
          />
          <Text
            style={{ color: colors.text.secondary }}
            className="text-xs"
            numberOfLines={1}
          >
            {item.counterparty || item.raw_counterparty}
          </Text>
        </View>
      )}

      {/* Account Name Badge (ledger mode) */}
      {item.account_name && (
        <View className="flex-row items-center gap-1 mb-1.5">
          <Ionicons name="wallet-outline" size={12} color={colors.info} />
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: colors.info + "15" }}
          >
            <Text
              style={{ color: colors.info }}
              className="text-xs font-medium"
              numberOfLines={1}
            >
              {item.account_name}
            </Text>
          </View>
        </View>
      )}

      {/* Notes (ledger mode) */}
      {item.notes && (
        <View className="flex-row items-center gap-1 mb-1.5">
          <Ionicons
            name="document-text-outline"
            size={12}
            color={colors.text.tertiary}
          />
          <Text
            style={{ color: colors.text.tertiary }}
            className="text-xs italic"
            numberOfLines={1}
          >
            {item.notes}
          </Text>
        </View>
      )}

      {/* Type Toggle */}
      {!isImported && (
        <View className="flex-row items-center gap-2 mt-1">
          <TouchableOpacity
            onPress={() => onEditType(item._id, "debit")}
            className="px-3 py-1.5 rounded-lg flex-row items-center gap-1"
            style={{
              backgroundColor:
                item.type === "debit" ? colors.error + "20" : "transparent",
              borderWidth: 1,
              borderColor: item.type === "debit" ? colors.error : colors.border,
            }}
          >
            <Ionicons
              name="arrow-down"
              size={12}
              color={
                item.type === "debit" ? colors.error : colors.text.tertiary
              }
            />
            <Text
              style={{
                color:
                  item.type === "debit" ? colors.error : colors.text.tertiary,
              }}
              className="text-xs font-semibold"
            >
              Debit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onEditType(item._id, "credit")}
            className="px-3 py-1.5 rounded-lg flex-row items-center gap-1"
            style={{
              backgroundColor:
                item.type === "credit" ? colors.success + "20" : "transparent",
              borderWidth: 1,
              borderColor:
                item.type === "credit" ? colors.success : colors.border,
            }}
          >
            <Ionicons
              name="arrow-up"
              size={12}
              color={
                item.type === "credit" ? colors.success : colors.text.tertiary
              }
            />
            <Text
              style={{
                color:
                  item.type === "credit"
                    ? colors.success
                    : colors.text.tertiary,
              }}
              className="text-xs font-semibold"
            >
              Credit
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error message */}
      {item.error_message && (
        <View
          className="flex-row items-center gap-1 mt-1.5 px-2 py-1 rounded"
          style={{ backgroundColor: colors.error + "10" }}
        >
          <Ionicons name="warning-outline" size={12} color={colors.error} />
          <Text style={{ color: colors.error }} className="text-xs">
            {item.error_message}
          </Text>
        </View>
      )}

      {/* Edit hint for non-imported items */}
      {!isImported && !isFailed && (
        <View className="flex-row items-center justify-end mt-1.5">
          <Ionicons
            name="create-outline"
            size={11}
            color={colors.text.tertiary + "80"}
          />
          <Text
            style={{ color: colors.text.tertiary + "80" }}
            className="text-[10px] ml-1"
          >
            Tap to edit
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Import Preview Component ────────────────────────────────────────────

type ImportPreviewProps = {
  importData: ImportRecord;
  onUpdateItems: (items: ItemUpdatePayload[]) => void;
  isUpdating?: boolean;
};

export function ImportPreview({
  importData,
  onUpdateItems,
  isUpdating,
}: ImportPreviewProps) {
  const { colors } = useTheme();
  const [editingItem, setEditingItem] = useState<ImportItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Summary stats
  const stats = useMemo(() => {
    let pending = 0;
    let skipped = 0;
    let imported = 0;
    let failed = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    for (const item of importData.items) {
      switch (item.status) {
        case "pending":
          pending++;
          if (item.type === "debit") totalDebit += item.amount || 0;
          if (item.type === "credit") totalCredit += item.amount || 0;
          break;
        case "skipped":
          skipped++;
          break;
        case "imported":
          imported++;
          break;
        case "failed":
          failed++;
          break;
      }
    }
    return { pending, skipped, imported, failed, totalDebit, totalCredit };
  }, [importData.items]);

  const handleToggleSkip = useCallback(
    (itemId: string) => {
      const item = importData.items.find((i) => i._id === itemId);
      if (!item) return;
      const newStatus = item.status === "skipped" ? "pending" : "skipped";
      onUpdateItems([{ itemId, status: newStatus }]);
    },
    [importData.items, onUpdateItems],
  );

  const handleEditType = useCallback(
    (itemId: string, type: "debit" | "credit") => {
      onUpdateItems([{ itemId, type }]);
    },
    [onUpdateItems],
  );

  const handleEditItem = useCallback((item: ImportItem) => {
    setEditingItem(item);
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(
    (updates: ItemUpdatePayload) => {
      onUpdateItems([updates]);
    },
    [onUpdateItems],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ImportItem; index: number }) => (
      <ImportItemCard
        item={item}
        index={index}
        colors={colors}
        onToggleSkip={handleToggleSkip}
        onEditType={handleEditType}
        onEdit={handleEditItem}
      />
    ),
    [colors, handleToggleSkip, handleEditType, handleEditItem],
  );

  return (
    <View className="flex-1">
      {/* Edit Item Modal */}
      <EditItemModal
        item={editingItem}
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
        }}
        onSave={handleSaveEdit}
        colors={colors}
      />

      {/* Items List with inline stats header */}
      {importData.items.length > 0 ? (
        <FlatList
          data={importData.items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListHeaderComponent={
            <View className="pb-2">
              {/* Compact Stats Row */}
              <View
                className="flex-row items-center rounded-xl px-3 py-2.5 mb-2"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <View className="flex-row items-center gap-1 flex-1">
                  <Text
                    style={{ color: colors.info }}
                    className="text-sm font-bold"
                  >
                    {importData.total_rows}
                  </Text>
                  <Text
                    style={{ color: colors.text.tertiary }}
                    className="text-[11px]"
                  >
                    rows
                  </Text>
                </View>
                <View
                  style={{
                    width: 1,
                    height: 16,
                    backgroundColor: colors.border,
                  }}
                />
                <View className="flex-row items-center gap-1 flex-1 justify-center">
                  <Text
                    style={{ color: colors.success }}
                    className="text-sm font-bold"
                  >
                    {stats.pending}
                  </Text>
                  <Text
                    style={{ color: colors.text.tertiary }}
                    className="text-[11px]"
                  >
                    ready
                  </Text>
                </View>
                {stats.skipped > 0 && (
                  <>
                    <View
                      style={{
                        width: 1,
                        height: 16,
                        backgroundColor: colors.border,
                      }}
                    />
                    <View className="flex-row items-center gap-1 flex-1 justify-center">
                      <Text
                        style={{ color: colors.warning }}
                        className="text-sm font-bold"
                      >
                        {stats.skipped}
                      </Text>
                      <Text
                        style={{ color: colors.text.tertiary }}
                        className="text-[11px]"
                      >
                        skip
                      </Text>
                    </View>
                  </>
                )}
                <View
                  style={{
                    width: 1,
                    height: 16,
                    backgroundColor: colors.border,
                  }}
                />
                <View className="flex-row items-center gap-1 flex-1 justify-end">
                  <Ionicons name="arrow-down" size={10} color={colors.error} />
                  <Text
                    style={{ color: colors.error }}
                    className="text-[11px] font-bold"
                  >
                    {stats.totalDebit > 0
                      ? (stats.totalDebit / 1000).toFixed(0) + "k"
                      : "0"}
                  </Text>
                  <Text
                    style={{ color: colors.text.tertiary }}
                    className="text-[10px]"
                  >
                    /
                  </Text>
                  <Ionicons name="arrow-up" size={10} color={colors.success} />
                  <Text
                    style={{ color: colors.success }}
                    className="text-[11px] font-bold"
                  >
                    {stats.totalCredit > 0
                      ? (stats.totalCredit / 1000).toFixed(0) + "k"
                      : "0"}
                  </Text>
                </View>
              </View>

              {/* Import result stats (only after import) */}
              {(stats.imported > 0 || stats.failed > 0) && (
                <View className="flex-row gap-2 mb-2">
                  <View
                    className="flex-1 flex-row items-center gap-1.5 rounded-lg px-3 py-2"
                    style={{ backgroundColor: colors.success + "12" }}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={colors.success}
                    />
                    <Text
                      style={{ color: colors.success }}
                      className="text-sm font-bold"
                    >
                      {stats.imported}
                    </Text>
                    <Text
                      style={{ color: colors.text.secondary }}
                      className="text-xs"
                    >
                      imported
                    </Text>
                  </View>
                  {stats.failed > 0 && (
                    <View
                      className="flex-1 flex-row items-center gap-1.5 rounded-lg px-3 py-2"
                      style={{ backgroundColor: colors.error + "12" }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={14}
                        color={colors.error}
                      />
                      <Text
                        style={{ color: colors.error }}
                        className="text-sm font-bold"
                      >
                        {stats.failed}
                      </Text>
                      <Text
                        style={{ color: colors.text.secondary }}
                        className="text-xs"
                      >
                        failed
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-8 py-12">
          <Ionicons
            name="file-tray-outline"
            size={40}
            color={colors.text.tertiary}
          />
          <Text
            style={{ color: colors.text.secondary }}
            className="text-base font-medium mt-3 text-center"
          >
            No transactions to display
          </Text>
          <Text
            style={{ color: colors.text.tertiary }}
            className="text-xs mt-1 text-center"
          >
            The parser could not extract any rows from this file.
          </Text>
        </View>
      )}
    </View>
  );
}
