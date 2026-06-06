import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";

interface LoadMoreButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  hasMore?: boolean;
  totalCount?: number;
}

export function LoadMoreButton({
  onPress,
  isLoading = false,
  hasMore = true,
  totalCount = 0,
}: LoadMoreButtonProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!hasMore) {
    if (totalCount > 0) {
      return (
        <View className="items-center py-6">
          <View
            className="rounded-full px-4 py-2"
            style={{ backgroundColor: colors.bg.tertiary }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: colors.text.secondary }}
            >
              {t("allTransactionsLoaded")}
            </Text>
          </View>
        </View>
      );
    }
    return null;
  }

  if (isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator size="small" color={colors.info} />
        <Text className="text-sm mt-2" style={{ color: colors.text.tertiary }}>
          {t("loadingMore")}
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center py-6">
      <TouchableOpacity
        onPress={onPress}
        className="rounded-xl px-6 py-3 shadow-sm active:scale-95"
        style={{
          backgroundColor: colors.info,
          shadowColor: colors.info,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="arrow-down-circle" size={20} color="white" />
          <Text className="text-white font-semibold text-base">
            {t("loadMoreTransactions")}
          </Text>
        </View>
      </TouchableOpacity>
      {totalCount > 0 && (
        <Text className="text-xs mt-2" style={{ color: colors.text.tertiary }}>
          {t("showing")} {totalCount} {t("total")}
        </Text>
      )}
    </View>
  );
}
