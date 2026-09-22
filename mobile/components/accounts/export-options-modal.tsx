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
import { useTheme } from "@/hooks/use-theme";

export type ExportType =
  | "pdf"
  | "by-account"
  | "by-category"
  | "by-counterparty"
  | "by-for";

type ExportOption = {
  type: ExportType;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
};

type ExportOptionsModalProps = {
  visible: boolean;
  onClose: () => void;
  onExport: (type: ExportType) => void;
  exporting: boolean;
  exportingType?: ExportType | null;
  accountName?: string;
  hasDateFilter?: boolean;
  /** When true (Ledger / all accounts), show the By Account option. */
  showByAccount?: boolean;
  /** When true, show By For (beneficiary) alongside counterparty/vendor. */
  showByFor?: boolean;
};

const BASE_OPTIONS: ExportOption[] = [
  {
    type: "pdf",
    icon: "document-text-outline",
    title: "All Transactions",
    subtitle: "Full list with running balance",
    color: "#22c55e",
  },
  {
    type: "by-account",
    icon: "wallet-outline",
    title: "By Account",
    subtitle: "Grouped by payment account with totals",
    color: "#3b82f6",
  },
  {
    type: "by-category",
    icon: "pricetags-outline",
    title: "By Category",
    subtitle: "Grouped by category with totals",
    color: "#8b5cf6",
  },
  {
    type: "by-counterparty",
    icon: "people-outline",
    title: "By Counterparty / Vendor",
    subtitle: "Grouped by customer, supplier, or vendor",
    color: "#f59e0b",
  },
  {
    type: "by-for",
    icon: "person-outline",
    title: "By For",
    subtitle: "Grouped by beneficiary / for-whom",
    color: "#14b8a6",
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
  showByAccount = false,
  showByFor = false,
}: ExportOptionsModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const options = BASE_OPTIONS.filter((option) => {
    if (option.type === "by-account") return showByAccount;
    if (option.type === "by-for") return showByFor;
    return true;
  });

  const handleExport = (type: ExportType) => {
    if (exporting) return;
    onExport(type);
  };

  const scopeHint = accountName
    ? hasDateFilter
      ? "transactions matching your current date filters"
      : "all transactions for this account"
    : hasDateFilter
      ? "transactions matching your current filters"
      : "all matching transactions";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />

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
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

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
              {accountName ? (
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
              ) : hasDateFilter ? (
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.text.secondary,
                    marginTop: 2,
                  }}
                >
                  Using current Ledger filters
                </Text>
              ) : null}
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

          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
            {options.map((option) => {
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
                    backgroundColor: colors.bg.secondary,
                    opacity: isDisabled ? 0.45 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: option.color + "20",
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

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: isCurrentExporting
                          ? option.color
                          : colors.text.primary,
                      }}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: isCurrentExporting
                          ? option.color
                          : colors.text.tertiary,
                        marginTop: 2,
                      }}
                    >
                      {isCurrentExporting ? "Generating PDF…" : option.subtitle}
                    </Text>
                  </View>

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

          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            <Text
              style={{
                fontSize: 11,
                color: colors.text.tertiary,
                textAlign: "center",
                lineHeight: 16,
              }}
            >
              Exports will include {scopeHint}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
