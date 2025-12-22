import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { OrganizationFormModal } from "@/components/organization-form-modal";
import { useOrganization } from "@/hooks/useOrganization";
import { organizationsApi, type Organization } from "@/services/organizations";
import { getApiErrorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function OrganizationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setOrganizations, switchOrganization, activeOrganization } =
    useOrganization();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  const {
    data: organizations = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["organizations"],
    queryFn: organizationsApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: organizationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Organization deleted successfully");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const handleDelete = useCallback(
    (org: Organization) => {
      Alert.alert(
        "Delete Organization",
        `Are you sure you want to delete "${org.name}"? This action cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              // If deleting active org, switch to personal
              if (activeOrganization?.id === org._id) {
                await switchOrganization(null);
              }
              deleteMutation.mutate(org._id);
            },
          },
        ]
      );
    },
    [deleteMutation, activeOrganization, switchOrganization]
  );

  const handleEdit = useCallback((org: Organization) => {
    setEditingOrg(org);
    setShowFormModal(true);
  }, []);

  const handleFormSuccess = useCallback(
    (org: Organization) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      // Update context with proper role and permissions from API
      refetch().then((result) => {
        if (result.data) {
          const summaries = result.data.map((o) => ({
            id: o._id,
            name: o.name,
            business_type: o.business_type,
            role: o.role || "owner", // Role comes from API
            permissions: o.permissions || {}, // Permissions come from API
            settings: o.settings,
          }));
          setOrganizations(summaries);
        }
      });
    },
    [queryClient, refetch, setOrganizations]
  );

  const handleViewDetails = useCallback(
    (org: Organization) => {
      router.push(`/organizations/${org._id}`);
    },
    [router]
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-700";
      case "admin":
        return "bg-blue-100 text-blue-700";
      case "manager":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-white">
        <ScreenHeader title="Organizations" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Organizations"
        showBack
        onBack={() => router.push("/settings")}
        rightAction={
          <TouchableOpacity
            className="p-2"
            onPress={() => {
              setEditingOrg(null);
              setShowFormModal(true);
            }}
          >
            <Ionicons name="add-circle" size={28} color="#3B82F6" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Info Card */}
        <View className="m-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={24} color="#3B82F6" />
            <View className="ml-3 flex-1">
              <Text className="text-sm font-medium text-blue-800">
                Multi-User Business Management
              </Text>
              <Text className="text-sm text-blue-600 mt-1">
                Create organizations for your businesses. Invite team members
                with different roles and permissions.
              </Text>
            </View>
          </View>
        </View>

        {organizations.length === 0 ? (
          <View className="p-8 items-center">
            <Ionicons name="business-outline" size={64} color="#D1D5DB" />
            <Text className="text-lg font-medium text-gray-500 mt-4">
              No Organizations Yet
            </Text>
            <Text className="text-sm text-gray-400 text-center mt-2">
              Create your first organization to start managing your business
              with multiple users.
            </Text>
            <TouchableOpacity
              className="mt-6 bg-blue-500 px-6 py-3 rounded-lg"
              onPress={() => {
                setEditingOrg(null);
                setShowFormModal(true);
              }}
            >
              <Text className="text-white font-medium">
                Create Organization
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="px-4 pb-4">
            {organizations.map((org) => (
              <TouchableOpacity
                key={org._id}
                className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
                onPress={() => handleViewDetails(org)}
              >
                <View className="flex-row items-start">
                  <View className="w-12 h-12 rounded-xl bg-blue-100 items-center justify-center">
                    <Ionicons name="business" size={24} color="#3B82F6" />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-semibold text-gray-900">
                      {org.name}
                    </Text>
                    <Text className="text-sm text-gray-500 capitalize mt-0.5">
                      {org.business_type}
                    </Text>
                    {org.description && (
                      <Text
                        className="text-sm text-gray-400 mt-1"
                        numberOfLines={1}
                      >
                        {org.description}
                      </Text>
                    )}
                  </View>
                  <View
                    className={`px-2 py-1 rounded-full ${getRoleColor(
                      org.role || "owner"
                    )}`}
                  >
                    <Text className="text-xs font-medium capitalize">
                      {org.role || "Owner"}
                    </Text>
                  </View>
                </View>

                {/* Quick Stats */}
                <View className="flex-row mt-4 pt-3 border-t border-gray-100">
                  <View className="flex-1 items-center">
                    <Text className="text-xs text-gray-500">Currency</Text>
                    <Text className="text-sm font-medium text-gray-700">
                      {org.settings?.currency || "USD"}
                    </Text>
                  </View>
                  <View className="w-px bg-gray-100" />
                  <View className="flex-1 items-center">
                    <Text className="text-xs text-gray-500">Status</Text>
                    <Text
                      className={`text-sm font-medium ${
                        org.status === "active"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {org.status === "active" ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                {/* Actions - Only show management actions to owners/managers */}
                {(org.role === "owner" ||
                  org.role === "manager" ||
                  !org.role) && (
                  <View className="flex-row mt-3 pt-3 border-t border-gray-100 gap-2">
                    {(org.role === "owner" || !org.role) && (
                      <TouchableOpacity
                        className="flex-1 flex-row items-center justify-center py-2 bg-gray-50 rounded-lg"
                        onPress={() => handleEdit(org)}
                      >
                        <Ionicons name="pencil" size={16} color="#6B7280" />
                        <Text className="ml-1 text-sm text-gray-600">Edit</Text>
                      </TouchableOpacity>
                    )}
                    {(org.role === "owner" ||
                      org.role === "manager" ||
                      !org.role) && (
                      <TouchableOpacity
                        className="flex-1 flex-row items-center justify-center py-2 bg-gray-50 rounded-lg"
                        onPress={() => handleViewDetails(org)}
                      >
                        <Ionicons name="people" size={16} color="#6B7280" />
                        <Text className="ml-1 text-sm text-gray-600">
                          Members
                        </Text>
                      </TouchableOpacity>
                    )}
                    {(org.role === "owner" || !org.role) && (
                      <TouchableOpacity
                        className="flex-row items-center justify-center py-2 px-3 bg-red-50 rounded-lg"
                        onPress={() => handleDelete(org)}
                      >
                        <Ionicons name="trash" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <OrganizationFormModal
        visible={showFormModal}
        organization={editingOrg}
        onClose={() => {
          setShowFormModal(false);
          setEditingOrg(null);
        }}
        onSuccess={handleFormSuccess}
      />
    </View>
  );
}
