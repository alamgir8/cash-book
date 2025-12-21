import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  const roleStyle = getRoleBadgeStyle(userRole);

  return (
    <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
      <View className="flex-row items-center gap-4 mb-6">
        <View className="w-18 h-18 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full items-center justify-center">
          <Ionicons name="person" size={32} color="#1d4ed8" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
            {isPersonalMode ? "Personal Account" : organizationName || "Organization"}
          </Text>
          <Text className="text-gray-900 text-xl font-bold mt-1">
            {userName}
          </Text>
          {!isPersonalMode && userRole ? (
            <View className={`${roleStyle.bg} px-3 py-1 rounded-full self-start mt-2`}>
              <Text className={`${roleStyle.text} font-bold text-xs uppercase`}>
                {userRole}
              </Text>
            </View>
          ) : isPersonalMode ? (
            <View className="bg-indigo-100 px-3 py-1 rounded-full self-start mt-2">
              <Text className="text-indigo-700 font-bold text-xs uppercase">
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
              <Ionicons name="mail" size={18} color="#6b7280" />
              <Text className="text-gray-700 flex-1">{userEmail}</Text>
            </View>
          )}
          {userPhone && (
            <View className="flex-row items-center gap-3">
              <Ionicons name="call" size={18} color="#6b7280" />
              <Text className="text-gray-700 flex-1">{userPhone}</Text>
            </View>
          )}
        </View>
      )}

      <View className="flex-row gap-3 mt-4">
        <TouchableOpacity
          onPress={onEditProfile}
          className="flex-1 flex-row gap-2 items-center justify-center bg-purple-50 rounded-2xl py-3 active:scale-95"
        >
          <Ionicons name="create" size={18} color="#8b5cf6" />
          <Text className="text-purple-700 font-bold text-sm">
            Edit Profile
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPreferences}
          className="flex-1 flex-row gap-2 items-center justify-center bg-blue-50 rounded-2xl py-3 active:scale-95"
        >
          <Ionicons name="settings" size={18} color="#1d4ed8" />
          <Text className="text-blue-700 font-bold text-sm">Preferences</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
