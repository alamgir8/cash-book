import { View } from "react-native";
import { SkeletonBase } from "./skeleton-base";

export function QuickFeatureSkeleton() {
  return (
    <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm items-center gap-2">
      {/* Icon placeholder */}
      <SkeletonBase width={40} height={40} borderRadius={8} />
      {/* Label placeholder */}
      <SkeletonBase
        width={60}
        height={14}
        borderRadius={6}
        style={{ marginTop: 4 }}
      />
    </View>
  );
}

export function QuickFeaturesSkeleton() {
  return (
    <View className="flex-row gap-3 mb-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} className="flex-1">
          <QuickFeatureSkeleton />
        </View>
      ))}
    </View>
  );
}
