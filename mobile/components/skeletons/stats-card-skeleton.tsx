import { View } from "react-native";
import { SkeletonBase } from "./skeleton-base";

export function StatCardSkeleton() {
  return (
    <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm gap-3">
      {/* Icon placeholder */}
      <View className="flex-row items-center justify-between">
        <SkeletonBase width={40} height={40} borderRadius={20} />
        <SkeletonBase width={50} height={20} />
      </View>

      {/* Amount placeholder */}
      <SkeletonBase
        width="80%"
        height={24}
        borderRadius={8}
        style={{ marginTop: 8 }}
      />

      {/* Label placeholder */}
      <SkeletonBase
        width="60%"
        height={14}
        borderRadius={6}
        style={{ marginTop: 4 }}
      />
    </View>
  );
}

export function StatsCardsSkeleton() {
  return (
    <View className="gap-3 mb-6">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </View>
  );
}
