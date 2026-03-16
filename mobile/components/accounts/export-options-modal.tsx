import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";

export type ExportType = "pdf" | "by-category" | "by-counterparty";

type ExportOption = {
  type: ExportType;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
};

type ExportOptionsModalProps = {
  visible: boolean;
  onClose: () => void;
  onExport: (type: ExportType) => void;
  exporting: boolean;
  exportingType?: ExportType | null;
  accountName?: string;
  hasDateFilter?: boolean;
};

const EXPORT_OPTIONS: ExportOption[] = [
  {
    type: "pdf",
    icon: "document-text-outline",
    title: "Export All Transactions",
    subtitle: "Full transaction list with running balance",
    color: "#3b82f6",
    bgColor: "#eff6ff",
  },
  {
    type: "by-category",
    icon: "pricetags-outline",
    title: "Export by Category",
    subtitle: "Transactions grouped by category with totals",
    color: "#8b5cf6",
    bgColor: "#f5f3ff",
  },
  {
    type: "by-counterparty",
    icon: "people-outline",
    title: "Export by Counterparty",
    subtitle: "Transactions grouped by counterparty with totals",
    color: "#f59e0b",
    bgColor: "#fffbeb",
  },
];

export function ExportOptionsModal({
  visible,
  onClose,
  onExport,
  exporting,
  exportingType,
  accountName,
  hasDateFilter,
}: ExportOptionsModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handleExport = (type: ExportType) => {
    if (exporting) return;
    onExport(type);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />

        {/* Sheet */}
        <View
          style={{
            backgroundColor: colors.bg.primary,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 20,
          }}
        >
          {/* Handle */}
          <View
            style={{
              alignItems: "center",
              paddingVertical: 10,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.text.primary,
                }}
              >
                Export Options
              </Text>
              {accountName && (
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.text.secondary,
                    marginTop: 2,
                  }}
                >
                  {accountName}
                  {hasDateFilter ? " · Filtered by date" : " · All time"}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.bg.tertiary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Export Options */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
            {EXPORT_OPTIONS.map((option) => {
              const isCurrentExporting =
                exporting && exportingType === option.type;
              const isDisabled = exporting && exportingType !== option.type;

              return (
                <TouchableOpacity
                  key={option.type}
                  onPress={() => handleExport(option.type)}
                  disabled={exporting}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isCurrentExporting
                      ? option.color
                      : colors.border,
                    backgroundColor: isCurrentExporting
                      ? option.bgColor
                      : colors.bg.secondary,
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                >
                  {/* Icon */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: option.bgColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isCurrentExporting ? (
                      <ActivityIndicator size="small" color={option.color} />
                    ) : (
                      <Ionicons
                        name={option.icon as any}
                        size={22}
                        color={option.color}
                      />
                    )}
                  </View>

                  {/* Text */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: colors.text.primary,
                      }}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.text.tertiary,
                        marginTop: 2,
                      }}
                    >
                      {isCurrentExporting
                        ? "Generating PDF..."
                        : option.subtitle}
                    </Text>
                  </View>

                  {/* Arrow */}
                  {!isCurrentExporting && (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.text.tertiary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Hint */}
          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            <Text
              style={{
                fontSize: 11,
                color: colors.text.tertiary,
                textAlign: "center",
                lineHeight: 16,
              }}
            >
              Exports will include{" "}
              {hasDateFilter
                ? "transactions matching your current date filters"
                : "all transactions for this account"}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
