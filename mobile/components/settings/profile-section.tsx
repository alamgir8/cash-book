import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface ProfileSectionProps {
  userName: string;
  userEmail?: string;
  userPhone?: string;
  userRole?: string;
  organizationName?: string;
  isPersonalMode?: boolean;
  onEditProfile: () => void;
  onPreferences: () => void;
}

const getRoleBadgeStyle = (role?: string) => {
  switch (role) {
    case "owner":
      return { bg: "bg-purple-100", text: "text-purple-700" };
    case "manager":
      return { bg: "bg-blue-100", text: "text-blue-700" };
    case "cashier":
      return { bg: "bg-green-100", text: "text-green-700" };
    case "viewer":
      return { bg: "bg-gray-100", text: "text-gray-700" };
    default:
      return { bg: "bg-indigo-100", text: "text-indigo-700" };
  }
};

export function ProfileSection({
  userName,
  userEmail,
  userPhone,
  userRole,
  organizationName,
  isPersonalMode = true,
  onEditProfile,
  onPreferences,
}: ProfileSectionProps) {
  const { colors } = useTheme();
  const roleStyle = getRoleBadgeStyle(userRole);

  return (
    <View
      className="rounded-3xl p-6 border shadow-lg"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center gap-4 mb-6">
        <View
          className="w-18 h-18 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.info + "20" }}
        >
          <Ionicons name="person" size={32} color={colors.info} />
        </View>
        <View className="flex-1">
          <Text
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: colors.text.secondary }}
          >
            {isPersonalMode
              ? "Personal Account"
              : organizationName || "Organization"}
          </Text>
          <Text
            className="text-xl font-bold mt-1"
            style={{ color: colors.text.primary }}
          >
            {userName}
          </Text>
          {!isPersonalMode && userRole ? (
            <View
              className="px-3 py-1 rounded-full self-start mt-2"
              style={{ backgroundColor: colors.info + "20" }}
            >
              <Text
                className="font-bold text-xs uppercase"
                style={{ color: colors.info }}
              >
                {userRole}
              </Text>
            </View>
          ) : isPersonalMode ? (
            <View
              className="px-3 py-1 rounded-full self-start mt-2"
              style={{ backgroundColor: colors.info + "20" }}
            >
              <Text
                className="font-bold text-xs uppercase"
                style={{ color: colors.info }}
              >
                Owner
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {(userEmail || userPhone) && (
        <View className="gap-3">
          {userEmail && (
            <View className="flex-row items-center gap-3">
              <Ionicons name="mail" size={18} color={colors.text.secondary} />
              <Text className="flex-1" style={{ color: colors.text.primary }}>
                {userEmail}
              </Text>
            </View>
          )}
          {userPhone && (
            <View className="flex-row items-center gap-3">
              <Ionicons name="call" size={18} color={colors.text.secondary} />
              <Text className="flex-1" style={{ color: colors.text.primary }}>
                {userPhone}
              </Text>
            </View>
          )}
        </View>
      )}

      <View className="flex-row gap-3 mt-4">
        <TouchableOpacity
          onPress={onEditProfile}
          className="flex-1 flex-row gap-2 items-center justify-center rounded-2xl py-3 active:scale-95"
          style={{ backgroundColor: colors.info + "15" }}
        >
          <Ionicons name="create" size={18} color={colors.info} />
          <Text className="font-bold text-sm" style={{ color: colors.info }}>
            Edit Profile
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPreferences}
          className="flex-1 flex-row gap-2 items-center justify-center rounded-2xl py-3 active:scale-95"
          style={{ backgroundColor: colors.success + "15" }}
        >
          <Ionicons name="settings" size={18} color={colors.success} />
          <Text className="font-bold text-sm" style={{ color: colors.success }}>
            Preferences
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
