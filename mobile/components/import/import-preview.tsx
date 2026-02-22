import React, { useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { ImportItem, ImportRecord } from "@/services/imports";

// ─── Import Item Card ─────────────────────────────────────────────────────────

function ImportItemCard({
  item,
  index,
  colors,
  onToggleSkip,
  onEditType,
}: {
  item: ImportItem;
  index: number;
  colors: any;
  onToggleSkip: (itemId: string) => void;
  onEditType: (itemId: string, type: "debit" | "credit") => void;
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
    <View
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
    </View>
  );
}

// ─── Main Import Preview Component ────────────────────────────────────────────

type ImportPreviewProps = {
  importData: ImportRecord;
  onUpdateItems: (
    items: {
      itemId: string;
      type?: "debit" | "credit";
      status?: "pending" | "skipped";
    }[],
  ) => void;
  isUpdating?: boolean;
};

export function ImportPreview({
  importData,
  onUpdateItems,
  isUpdating,
}: ImportPreviewProps) {
  const { colors } = useTheme();

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

  const renderItem = useCallback(
    ({ item, index }: { item: ImportItem; index: number }) => (
      <ImportItemCard
        item={item}
        index={index}
        colors={colors}
        onToggleSkip={handleToggleSkip}
        onEditType={handleEditType}
      />
    ),
    [colors, handleToggleSkip, handleEditType],
  );

  return (
    <View className="flex-1">
      {/* Summary Stats */}
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row gap-2 mb-3">
          <View
            className="flex-1 rounded-xl p-3"
            style={{ backgroundColor: colors.info + "15" }}
          >
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Total Rows
            </Text>
            <Text style={{ color: colors.info }} className="text-lg font-bold">
              {importData.total_rows}
            </Text>
          </View>
          <View
            className="flex-1 rounded-xl p-3"
            style={{ backgroundColor: colors.success + "15" }}
          >
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Ready
            </Text>
            <Text
              style={{ color: colors.success }}
              className="text-lg font-bold"
            >
              {stats.pending}
            </Text>
          </View>
          <View
            className="flex-1 rounded-xl p-3"
            style={{ backgroundColor: colors.warning + "15" }}
          >
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Skipped
            </Text>
            <Text
              style={{ color: colors.warning }}
              className="text-lg font-bold"
            >
              {stats.skipped}
            </Text>
          </View>
        </View>

        {/* Debit/Credit Summary */}
        <View className="flex-row gap-2 mb-2">
          <View
            className="flex-1 rounded-xl p-3"
            style={{ backgroundColor: colors.error + "15" }}
          >
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Total Debit
            </Text>
            <Text
              style={{ color: colors.error }}
              className="text-base font-bold"
            >
              {stats.totalDebit.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
          <View
            className="flex-1 rounded-xl p-3"
            style={{ backgroundColor: colors.success + "15" }}
          >
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Total Credit
            </Text>
            <Text
              style={{ color: colors.success }}
              className="text-base font-bold"
            >
              {stats.totalCredit.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>

        {/* Import result stats */}
        {(stats.imported > 0 || stats.failed > 0) && (
          <View className="flex-row gap-2 mb-2">
            <View
              className="flex-1 rounded-xl p-3"
              style={{ backgroundColor: colors.success + "15" }}
            >
              <Text
                style={{ color: colors.text.secondary }}
                className="text-xs"
              >
                Imported
              </Text>
              <Text
                style={{ color: colors.success }}
                className="text-lg font-bold"
              >
                {stats.imported}
              </Text>
            </View>
            {stats.failed > 0 && (
              <View
                className="flex-1 rounded-xl p-3"
                style={{ backgroundColor: colors.error + "15" }}
              >
                <Text
                  style={{ color: colors.text.secondary }}
                  className="text-xs"
                >
                  Failed
                </Text>
                <Text
                  style={{ color: colors.error }}
                  className="text-lg font-bold"
                >
                  {stats.failed}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Items List */}
      {importData.items.length > 0 ? (
        <FlatList
          data={importData.items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
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
