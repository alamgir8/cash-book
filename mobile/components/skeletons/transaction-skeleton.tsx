import { View } from "react-native";
import { SkeletonBase } from "./skeleton-base";

export function TransactionCardSkeleton() {
  return (
    <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-3 flex-row items-center gap-4">
      {/* Icon/Avatar placeholder */}
      <View className="w-12 h-12 rounded-full">
        <SkeletonBase width={48} height={48} borderRadius={24} />
      </View>

      {/* Content placeholders */}
      <View className="flex-1 gap-2">
        {/* Category/Type */}
        <SkeletonBase width="60%" height={16} borderRadius={6} />
        {/* Description */}
        <SkeletonBase width="80%" height={12} borderRadius={5} />
      </View>

      {/* Amount placeholder */}
      <View className="gap-2 items-end">
        <SkeletonBase width={80} height={16} borderRadius={6} />
        <SkeletonBase width={60} height={12} borderRadius={5} />
      </View>
    </View>
  );
}

export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View className="gap-0">
      {Array.from({ length: count }).map((_, index) => (
        <TransactionCardSkeleton key={index} />
      ))}
    </View>
  );
}
