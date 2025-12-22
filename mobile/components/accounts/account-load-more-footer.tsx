import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  if (!hasMorePages) {
    if (totalTransactions > 0) {
      return (
        <View className="items-center py-6">
          <View className="bg-gray-100 rounded-full px-4 py-2">
            <Text className="text-gray-600 text-sm font-medium">
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
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text className="text-gray-500 text-sm mt-2">Loading more...</Text>
      </View>
    );
  }

  return (
    <View className="items-center py-6">
      <TouchableOpacity
        onPress={onLoadMore}
        className="bg-blue-500 rounded-xl px-6 py-3 shadow-sm active:scale-95"
        style={{
          shadowColor: "#3b82f6",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="arrow-down-circle" size={20} color="white" />
          <Text className="text-white font-semibold text-base">
            Load More Transactions
          </Text>
        </View>
      </TouchableOpacity>
      <Text className="text-gray-400 text-xs mt-2">
        Showing {totalTransactions} transactions
      </Text>
    </View>
  );
}
