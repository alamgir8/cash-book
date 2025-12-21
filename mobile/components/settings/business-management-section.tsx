import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

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
  return (
    <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg">
      <View className="flex-row items-center gap-4 mb-6">
        <View className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full items-center justify-center">
          <Ionicons name="business" size={28} color="#6366f1" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 text-xl font-bold">
            Business Management
          </Text>
          <Text className="text-gray-600 text-sm mt-1">
            Organizations, parties & invoices
          </Text>
        </View>
      </View>

      <View className="gap-3">
        {/* Organizations - Only show for owners */}
        {isOwner && (
          <TouchableOpacity
            onPress={() => router.push("/organizations")}
            className="flex-row items-center gap-4 bg-indigo-50 rounded-2xl p-4 active:scale-98"
          >
            <View className="w-12 h-12 bg-indigo-100 rounded-full items-center justify-center">
              <Ionicons name="business" size={24} color="#6366f1" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold text-base">
                Organizations
              </Text>
              <Text className="text-gray-600 text-sm">
                Manage your businesses & teams
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}

        {/* Parties - Show only if user has permission */}
        {canManageParties && (
          <TouchableOpacity
            onPress={() => router.push("/parties")}
            className="flex-row items-center gap-4 bg-teal-50 rounded-2xl p-4 active:scale-98"
          >
            <View className="w-12 h-12 bg-teal-100 rounded-full items-center justify-center">
              <Ionicons name="people" size={24} color="#14b8a6" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold text-base">
                Customers & Suppliers
              </Text>
              <Text className="text-gray-600 text-sm">
                Manage parties & view ledgers
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}

        {/* Invoices - Show only if user has permission */}
        {canManageInvoices && (
          <TouchableOpacity
            onPress={() => router.push("/invoices")}
            className="flex-row items-center gap-4 bg-amber-50 rounded-2xl p-4 active:scale-98"
          >
            <View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center">
              <Ionicons name="receipt" size={24} color="#f59e0b" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold text-base">
                Invoices
              </Text>
              <Text className="text-gray-600 text-sm">
                Sales & purchase invoices
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
