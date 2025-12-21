import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SecuritySectionProps {
  biometricType?: string;
  isEnabled?: boolean;
  isAvailable?: boolean;
  getBiometricDisplayName: (type?: string) => string;
  getBiometricIconName: (type?: string) => keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export function SecuritySection({
  biometricType,
  isEnabled,
  isAvailable,
  getBiometricDisplayName,
  getBiometricIconName,
  onPress,
}: SecuritySectionProps) {
  return (
    <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
      <View className="flex-row items-center gap-4 mb-4">
        <View className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full items-center justify-center">
          <Ionicons name="shield-checkmark" size={28} color="#8b5cf6" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 text-xl font-bold">Security</Text>
          <Text className="text-gray-600 text-sm mt-1">
            Protect your account
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onPress}
        className="flex-row items-center gap-4 bg-purple-50 rounded-2xl p-4 active:scale-98"
      >
        <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center">
          <Ionicons
            name={getBiometricIconName(biometricType)}
            size={24}
            color="#8b5cf6"
          />
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 font-bold text-base">
            {getBiometricDisplayName(biometricType)} Login
          </Text>
          <Text className="text-gray-600 text-sm">
            {isEnabled
              ? "Enabled - Quick login with biometric"
              : isAvailable
              ? "Tap to enable quick login"
              : "Not available on this device"}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {isEnabled && (
            <View className="bg-green-100 px-2 py-1 rounded-full">
              <Text className="text-green-700 text-xs font-bold">ON</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>
      </TouchableOpacity>
    </View>
  );
}
