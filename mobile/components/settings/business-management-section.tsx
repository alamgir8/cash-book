import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/hooks/useTheme";

interface BusinessManagementSectionProps {
  canManageParties: boolean;
  canManageInvoices: boolean;
  isOwner: boolean; // Only owners can manage organizations
}

export function BusinessManagementSection({
  canManageParties,
  canManageInvoices,
  isOwner,
}: BusinessManagementSectionProps) {
  const { colors } = useTheme();
  return (
    <View
      className="rounded-3xl p-6 border shadow-lg"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center gap-4 mb-6">
        <View className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full items-center justify-center">
          <Ionicons name="business" size={28} color="#6366f1" />
        </View>
        <View className="flex-1">
          <Text
            className="text-xl font-bold"
            style={{ color: colors.text.primary }}
          >
            Business Management
          </Text>
          <Text
            className="text-sm mt-1"
            style={{ color: colors.text.secondary }}
          >
            Organizations, parties & invoices
          </Text>
        </View>
      </View>

      <View className="gap-3">
        {/* Organizations - Only show for owners */}
        {isOwner && (
          <TouchableOpacity
            onPress={() => router.push("/organizations")}
            className="flex-row items-center gap-4 rounded-2xl p-4 active:scale-98"
            style={{ backgroundColor: colors.info + "15" }}
          >
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.info + "25" }}
            >
              <Ionicons name="business" size={24} color={colors.info} />
            </View>
            <View className="flex-1">
              <Text
                className="font-bold text-base"
                style={{ color: colors.text.primary }}
              >
                Organizations
              </Text>
              <Text
                className="text-sm"
                style={{ color: colors.text.secondary }}
              >
                Manage your businesses & teams
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        )}

        {/* Parties - Show only if user has permission */}
        {canManageParties && (
          <TouchableOpacity
            onPress={() => router.push("/parties")}
            className="flex-row items-center gap-4 rounded-2xl p-4 active:scale-98"
            style={{ backgroundColor: colors.success + "15" }}
          >
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.success + "25" }}
            >
              <Ionicons name="people" size={24} color={colors.success} />
            </View>
            <View className="flex-1">
              <Text
                className="font-bold text-base"
                style={{ color: colors.text.primary }}
              >
                Customers & Suppliers
              </Text>
              <Text
                className="text-sm"
                style={{ color: colors.text.secondary }}
              >
                Manage parties & view ledgers
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        )}

        {/* Invoices - Show only if user has permission */}
        {canManageInvoices && (
          <TouchableOpacity
            onPress={() => router.push("/invoices")}
            className="flex-row items-center gap-4 rounded-2xl p-4 active:scale-98"
            style={{ backgroundColor: colors.warning + "15" }}
          >
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.warning + "25" }}
            >
              <Ionicons name="receipt" size={24} color={colors.warning} />
            </View>
            <View className="flex-1">
              <Text
                className="font-bold text-base"
                style={{ color: colors.text.primary }}
              >
                Invoices
              </Text>
              <Text
                className="text-sm"
                style={{ color: colors.text.secondary }}
              >
                Sales & purchase invoices
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
