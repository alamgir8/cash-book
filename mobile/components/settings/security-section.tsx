import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";

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
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      className="rounded-3xl p-6 border shadow-lg"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center gap-4 mb-4">
        <View
          className="w-14 h-14 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.info + "15" }}
        >
          <Ionicons name="shield-checkmark" size={28} color={colors.info} />
        </View>
        <View className="flex-1">
          <Text
            className="text-xl font-bold"
            style={{ color: colors.text.primary }}
          >
            {t("securityTitle")}
          </Text>
          <Text
            className="text-sm mt-1"
            style={{ color: colors.text.secondary }}
          >
            {t("protectYourAccount")}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onPress}
        className="flex-row items-center gap-4 rounded-2xl p-4 active:scale-98"
        style={{ backgroundColor: colors.info + "15" }}
      >
        <View
          className="w-12 h-12 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.info + "30" }}
        >
          <Ionicons
            name={getBiometricIconName(biometricType)}
            size={24}
            color={colors.info}
          />
        </View>
        <View className="flex-1">
          <Text
            className="font-bold text-base"
            style={{ color: colors.text.primary }}
          >
            {getBiometricDisplayName(biometricType)} {t("biometricLogin")}
          </Text>
          <Text className="text-sm" style={{ color: colors.text.secondary }}>
            {isEnabled
              ? t("biometricEnabled")
              : isAvailable
                ? t("tapToEnableBiometric")
                : t("biometricNotAvailable")}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {isEnabled && (
            <View
              className="px-2 py-1 rounded-full"
              style={{ backgroundColor: colors.success + "20" }}
            >
              <Text
                className="text-xs font-bold"
                style={{ color: colors.success }}
              >
                ON
              </Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.text.tertiary}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}
