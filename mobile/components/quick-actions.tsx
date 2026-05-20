import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useOrganization } from "../hooks/use-organization";
import { useTranslation } from "@/hooks/use-translation";

type QuickActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
  onPress: () => void;
};

const QuickAction = ({
  icon,
  title,
  subtitle,
  color,
  bgColor,
  onPress,
}: QuickActionProps) => (
  <TouchableOpacity
    onPress={onPress}
    className={`${bgColor} rounded-2xl p-4 flex-1 shadow-sm border border-gray-100`}
    style={{
      shadowColor: color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    }}
  >
    <View className="items-center gap-2">
      <View className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm">
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text className="font-bold text-gray-900 text-center text-sm">
        {title}
      </Text>
      <Text className="text-gray-600 text-xs text-center">{subtitle}</Text>
    </View>
  </TouchableOpacity>
);

type QuickActionsProps = {
  onAddTransaction: () => void;
  onAddTransfer: () => void;
  onAddAccount: () => void;
  onExportPDF: () => void;
  onVoiceInput: () => void;
};

export const QuickActions = ({
  onAddTransaction,
  onAddTransfer,
  onAddAccount,
  onExportPDF,
  onVoiceInput,
}: QuickActionsProps) => {
  const { t } = useTranslation();
  const { canCreateTransactions, canManageAccounts, canViewReports } =
    useOrganization();

  const allActions = [
    {
      id: "add-transaction",
      icon: "add-circle" as const,
      title: t("addTransactionTitle"),
      subtitle: t("recordNewEntry"),
      color: "#3b82f6",
      bgColor: "bg-blue-50",
      onPress: onAddTransaction,
      permission: canCreateTransactions,
    },
    {
      id: "transfer",
      icon: "swap-horizontal" as const,
      title: t("transferFundsTitle"),
      subtitle: t("moveBetweenAccounts"),
      color: "#ec4899",
      bgColor: "bg-pink-50",
      onPress: onAddTransfer,
      permission: canCreateTransactions,
    },
    {
      id: "add-account",
      icon: "wallet" as const,
      title: t("newAccount"),
      subtitle: "Create account",
      color: "#10b981",
      bgColor: "bg-green-50",
      onPress: onAddAccount,
      permission: canManageAccounts,
    },
    {
      id: "export",
      icon: "document-text" as const,
      title: t("exportPdfTitle"),
      subtitle: t("downloadReport"),
      color: "#f59e0b",
      bgColor: "bg-yellow-50",
      onPress: onExportPDF,
      permission: canViewReports,
    },
    // {
    //   id: "voice",
    //   icon: "mic" as const,
    //   title: "Voice Input",
    //   subtitle: "Speak to add",
    //   color: "#8b5cf6",
    //   bgColor: "bg-purple-50",
    //   onPress: onVoiceInput,
    //   permission: canCreateTransactions,
    // },
  ];

  // Filter actions based on permissions
  const actions = allActions.filter((action) => action.permission);

  // Don't show the component if no actions are available
  if (actions.length === 0) {
    return null;
  }

  return (
    <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <Text className="text-gray-900 text-lg font-bold mb-4">
        {t("quickActions")}
      </Text>

      <View className="flex-row flex-wrap gap-3">
        {actions.map((action) => (
          <View key={action.id} className="flex-1 basis-[48%] min-w-[140px]">
            <QuickAction {...action} />
          </View>
        ))}
      </View>
    </View>
  );
};
