import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { ImportListItem } from "@/services/imports";

type ImportHistoryCardProps = {
  item: ImportListItem;
  onPress: () => void;
  onDelete?: () => void;
};

const FILE_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pdf: "document-text",
  xlsx: "grid",
  xls: "grid",
  csv: "list",
};

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: "#ef4444",
  xlsx: "#10b981",
  xls: "#10b981",
  csv: "#f59e0b",
};

export function ImportHistoryCard({
  item,
  onPress,
  onDelete,
}: ImportHistoryCardProps) {
  const { colors } = useTheme();

  const statusConfig = {
    parsing: { label: "Parsing...", color: colors.warning, icon: "hourglass" },
    parsed: {
      label: "Ready to Import",
      color: colors.info,
      icon: "checkmark-circle",
    },
    mapping: { label: "Mapping", color: colors.info, icon: "options" },
    importing: { label: "Importing...", color: colors.warning, icon: "sync" },
    completed: {
      label: "Completed",
      color: colors.success,
      icon: "checkmark-done-circle",
    },
    failed: { label: "Failed", color: colors.error, icon: "close-circle" },
    cancelled: { label: "Cancelled", color: colors.text.tertiary, icon: "ban" },
  };

  const status = statusConfig[item.status] || statusConfig.failed;
  const fileIcon = FILE_TYPE_ICONS[item.file_type] || "document";
  const fileColor = FILE_TYPE_COLORS[item.file_type] || colors.info;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="rounded-xl p-4 mb-3 border"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-start gap-3">
        {/* File Type Icon */}
        <View
          className="w-11 h-11 rounded-xl items-center justify-center"
          style={{ backgroundColor: fileColor + "18" }}
        >
          <Ionicons name={fileIcon as any} size={22} color={fileColor} />
        </View>

        {/* Content */}
        <View className="flex-1">
          {/* Filename & Status */}
          <View className="flex-row items-start justify-between mb-1.5">
            <Text
              style={{ color: colors.text.primary }}
              className="text-sm font-bold flex-1 mr-2"
              numberOfLines={1}
            >
              {item.original_filename}
            </Text>
            <View
              className="px-2 py-0.5 rounded-full flex-row items-center gap-1"
              style={{ backgroundColor: status.color + "18" }}
            >
              <Ionicons
                name={status.icon as any}
                size={12}
                color={status.color}
              />
              <Text
                style={{ color: status.color }}
                className="text-xs font-semibold"
              >
                {status.label}
              </Text>
            </View>
          </View>

          {/* Stats Row */}
          <View className="flex-row items-center gap-3 mb-1.5">
            <View className="flex-row items-center gap-1">
              <Ionicons
                name="layers-outline"
                size={13}
                color={colors.text.tertiary}
              />
              <Text
                style={{ color: colors.text.secondary }}
                className="text-xs"
              >
                {item.total_rows} rows
              </Text>
            </View>

            {item.imported_count > 0 && (
              <View className="flex-row items-center gap-1">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={13}
                  color={colors.success}
                />
                <Text style={{ color: colors.success }} className="text-xs">
                  {item.imported_count} imported
                </Text>
              </View>
            )}

            {item.failed_count > 0 && (
              <View className="flex-row items-center gap-1">
                <Ionicons
                  name="close-circle-outline"
                  size={13}
                  color={colors.error}
                />
                <Text style={{ color: colors.error }} className="text-xs">
                  {item.failed_count} failed
                </Text>
              </View>
            )}
          </View>

          {/* Amounts */}
          {(item.total_debit > 0 || item.total_credit > 0) && (
            <View className="flex-row items-center gap-3">
              {item.total_debit > 0 && (
                <Text style={{ color: colors.error }} className="text-xs">
                  ↓{" "}
                  {item.total_debit.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              )}
              {item.total_credit > 0 && (
                <Text style={{ color: colors.success }} className="text-xs">
                  ↑{" "}
                  {item.total_credit.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              )}
            </View>
          )}

          {/* Date */}
          <Text
            style={{ color: colors.text.tertiary }}
            className="text-xs mt-1"
          >
            {new Date(item.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        {/* Delete button */}
        {onDelete && item.status !== "importing" && (
          <TouchableOpacity
            onPress={onDelete}
            className="p-1.5"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}
