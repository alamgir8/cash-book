import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../../components/screen-header";
import {
  organizationsApi,
  type OrganizationMember,
} from "../../../services/organizations";
import { getApiErrorMessage } from "../../../lib/api";

const ROLES = [
  {
    value: "admin",
    label: "Admin",
    description: "Full access except ownership transfer",
  },
  {
    value: "manager",
    label: "Manager",
    description: "Manage transactions, categories, and view reports",
  },
  {
    value: "accountant",
    label: "Accountant",
    description: "View and create transactions, view reports",
  },
  {
    value: "cashier",
    label: "Cashier",
    description: "Create transactions only",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access",
  },
];

export default function OrganizationDetailScreen() {
  const { organizationId } = useLocalSearchParams<{ organizationId: string }>();
  const queryClient = useQueryClient();

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("cashier");
  const [newMemberName, setNewMemberName] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["organization", organizationId],
    queryFn: () => organizationsApi.get(organizationId!),
    enabled: !!organizationId,
  });

  const addMemberMutation = useMutation({
    mutationFn: (params: {
      email?: string;
      phone?: string;
      role: string;
      display_name?: string;
    }) => organizationsApi.addMember(organizationId!, params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization", organizationId],
      });
      setShowAddMemberModal(false);
      resetForm();
      Alert.alert("Success", "Member added successfully");
    },
    onError: (error) => {
      Alert.alert("Error", getApiErrorMessage(error));
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      organizationsApi.updateMemberRole(organizationId!, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization", organizationId],
      });
    },
    onError: (error) => {
      Alert.alert("Error", getApiErrorMessage(error));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      organizationsApi.removeMember(organizationId!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization", organizationId],
      });
    },
    onError: (error) => {
      Alert.alert("Error", getApiErrorMessage(error));
    },
  });

  const resetForm = () => {
    setNewMemberEmail("");
    setNewMemberPhone("");
    setNewMemberRole("cashier");
    setNewMemberName("");
  };

  const handleAddMember = () => {
    if (!newMemberEmail && !newMemberPhone) {
      Alert.alert("Error", "Please enter email or phone number");
      return;
    }

    addMemberMutation.mutate({
      email: newMemberEmail.trim() || undefined,
      phone: newMemberPhone.trim() || undefined,
      role: newMemberRole,
      display_name: newMemberName.trim() || undefined,
    });
  };

  const handleRemoveMember = useCallback(
    (member: OrganizationMember) => {
      Alert.alert(
        "Remove Member",
        `Are you sure you want to remove this member?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => removeMemberMutation.mutate(member._id),
          },
        ]
      );
    },
    [removeMemberMutation]
  );

  const handleChangeRole = useCallback(
    (member: OrganizationMember) => {
      Alert.alert(
        "Change Role",
        "Select new role for this member",
        ROLES.map((role) => ({
          text: role.label,
          onPress: () =>
            updateRoleMutation.mutate({
              memberId: member._id,
              role: role.value,
            }),
        })).concat([{ text: "Cancel", style: "cancel" } as any])
      );
    },
    [updateRoleMutation]
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-700";
      case "admin":
        return "bg-blue-100 text-blue-700";
      case "manager":
        return "bg-green-100 text-green-700";
      case "accountant":
        return "bg-yellow-100 text-yellow-700";
      case "cashier":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScreenHeader title="Organization" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  const organization = data?.organization;
  const members = data?.members || [];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScreenHeader title={organization?.name || "Organization"} showBack />

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Organization Info */}
        <View className="m-4 bg-white rounded-xl p-4 border border-gray-100">
          <View className="flex-row items-center mb-4">
            <View className="w-14 h-14 rounded-xl bg-blue-100 items-center justify-center">
              <Ionicons name="business" size={28} color="#3B82F6" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-lg font-semibold text-gray-900">
                {organization?.name}
              </Text>
              <Text className="text-sm text-gray-500 capitalize">
                {organization?.business_type}
              </Text>
            </View>
          </View>

          {organization?.description && (
            <Text className="text-sm text-gray-600 mb-3">
              {organization.description}
            </Text>
          )}

          <View className="flex-row flex-wrap gap-2">
            {organization?.contact?.phone && (
              <View className="flex-row items-center bg-gray-50 px-3 py-1.5 rounded-full">
                <Ionicons name="call" size={14} color="#6B7280" />
                <Text className="ml-1 text-sm text-gray-600">
                  {organization.contact.phone}
                </Text>
              </View>
            )}
            {organization?.contact?.email && (
              <View className="flex-row items-center bg-gray-50 px-3 py-1.5 rounded-full">
                <Ionicons name="mail" size={14} color="#6B7280" />
                <Text className="ml-1 text-sm text-gray-600">
                  {organization.contact.email}
                </Text>
              </View>
            )}
            <View className="flex-row items-center bg-gray-50 px-3 py-1.5 rounded-full">
              <Ionicons name="cash" size={14} color="#6B7280" />
              <Text className="ml-1 text-sm text-gray-600">
                {organization?.settings?.currency || "USD"}
              </Text>
            </View>
          </View>
        </View>

        {/* Team Members */}
        <View className="px-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-gray-900">
              Team Members ({members.length})
            </Text>
            <TouchableOpacity
              className="flex-row items-center bg-blue-500 px-3 py-2 rounded-lg"
              onPress={() => setShowAddMemberModal(true)}
            >
              <Ionicons name="person-add" size={16} color="white" />
              <Text className="ml-1 text-sm font-medium text-white">
                Add Member
              </Text>
            </TouchableOpacity>
          </View>

          {members.map((member) => (
            <View
              key={member._id}
              className="bg-white rounded-xl p-4 mb-3 border border-gray-100"
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center">
                  <Ionicons name="person" size={20} color="#6B7280" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-base font-medium text-gray-900">
                    {member.display_name || "Team Member"}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {member.status === "pending"
                      ? "Invitation pending"
                      : "Active"}
                  </Text>
                </View>
                <View
                  className={`px-2 py-1 rounded-full ${getRoleColor(
                    member.role
                  )}`}
                >
                  <Text className="text-xs font-medium capitalize">
                    {member.role}
                  </Text>
                </View>
              </View>

              {member.role !== "owner" && (
                <View className="flex-row mt-3 pt-3 border-t border-gray-100 gap-2">
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center py-2 bg-gray-50 rounded-lg"
                    onPress={() => handleChangeRole(member)}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={16}
                      color="#6B7280"
                    />
                    <Text className="ml-1 text-sm text-gray-600">
                      Change Role
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-center justify-center py-2 px-4 bg-red-50 rounded-lg"
                    onPress={() => handleRemoveMember(member)}
                  >
                    <Ionicons name="person-remove" size={16} color="#EF4444" />
                    <Text className="ml-1 text-sm text-red-600">Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>

        <View className="h-8" />
      </ScrollView>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowAddMemberModal(false)}>
              <Text className="text-blue-500 text-base">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-gray-900">
              Add Team Member
            </Text>
            <TouchableOpacity
              onPress={handleAddMember}
              disabled={addMemberMutation.isPending}
            >
              {addMemberMutation.isPending ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Text className="text-blue-500 text-base font-medium">Add</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            <Text className="text-sm text-gray-500 mb-4">
              Invite a team member by their email or phone number. They will
              receive an invitation to join this organization.
            </Text>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Display Name
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                placeholder="Member's name"
                value={newMemberName}
                onChangeText={setNewMemberName}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Email Address
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                placeholder="member@example.com"
                value={newMemberEmail}
                onChangeText={setNewMemberEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text className="text-center text-gray-400 my-2">or</Text>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                placeholder="+1 234 567 8900"
                value={newMemberPhone}
                onChangeText={setNewMemberPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Role
              </Text>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role.value}
                  className={`p-3 rounded-lg border mb-2 ${
                    newMemberRole === role.value
                      ? "bg-blue-50 border-blue-500"
                      : "bg-gray-50 border-gray-200"
                  }`}
                  onPress={() => setNewMemberRole(role.value)}
                >
                  <Text
                    className={`text-base font-medium ${
                      newMemberRole === role.value
                        ? "text-blue-700"
                        : "text-gray-700"
                    }`}
                  >
                    {role.label}
                  </Text>
                  <Text
                    className={`text-sm mt-0.5 ${
                      newMemberRole === role.value
                        ? "text-blue-600"
                        : "text-gray-500"
                    }`}
                  >
                    {role.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
