import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

type AccountLoadMoreFooterProps = {
  hasMorePages: boolean;
  loadingMore: boolean;
  isFetching: boolean;
  totalTransactions: number;
  onLoadMore: () => void;
};

export function AccountLoadMoreFooter({
  hasMorePages,
  loadingMore,
  isFetching,
  totalTransactions,
  onLoadMore,
}: AccountLoadMoreFooterProps) {
  const { colors } = useTheme();

  if (!hasMorePages) {
    if (totalTransactions > 0) {
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
              ✓ All transactions loaded ({totalTransactions} total)
            </Text>
          </View>
        </View>
      );
    }
    return null;
  }

  if (loadingMore || isFetching) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator size="small" color={colors.info} />
        <Text className="text-sm mt-2" style={{ color: colors.text.tertiary }}>
          Loading more...
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center py-6">
      <TouchableOpacity
        onPress={onLoadMore}
        className="rounded-xl px-6 py-3"
        style={{ backgroundColor: colors.info }}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="arrow-down-circle" size={20} color="white" />
          <Text className="text-white font-semibold text-base">
            Load More Transactions
          </Text>
        </View>
      </TouchableOpacity>
      <Text className="text-xs mt-2" style={{ color: colors.text.tertiary }}>
        Showing {totalTransactions} transactions
      </Text>
    </View>
  );
}
