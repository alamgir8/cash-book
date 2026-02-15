import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface LoadMoreButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  hasMore?: boolean;
}

export function LoadMoreButton({
  onPress,
  isLoading = false,
  hasMore = true,
}: LoadMoreButtonProps) {
  const { colors } = useTheme();

  if (!hasMore) {
    return (
      <View className="items-center py-6 mt-4">
        <Text style={{ color: colors.text.tertiary }} className="text-sm">
          No more transactions
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      className="flex-row items-center justify-center gap-2 py-4 px-4 rounded-lg border-2 mx-4 my-2"
      style={{
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}10`,
        opacity: isLoading ? 0.6 : 1,
      }}
    >
      {isLoading ? (
        <>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.primary }} className="font-semibold">
            Loading more...
          </Text>
        </>
      ) : (
        <>
          <Text style={{ color: colors.primary }} className="font-semibold">
            Load More Transactions
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.primary} />
        </>
      )}
    </Pressable>
  );
}
