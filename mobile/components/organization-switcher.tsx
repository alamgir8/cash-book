import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useOrganization } from "../hooks/useOrganization";
import type { OrganizationSummary } from "../services/organizations";

interface OrganizationSwitcherProps {
  onCreateNew?: () => void;
}

export function OrganizationSwitcher({
  onCreateNew,
}: OrganizationSwitcherProps) {
  const { organizations, activeOrganization, switchOrganization, isLoading } =
    useOrganization();
  const [modalVisible, setModalVisible] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleSwitch = async (orgId: string | null) => {
    setSwitching(true);
    try {
      await switchOrganization(orgId);
      setModalVisible(false);
    } catch (error) {
      console.error("Failed to switch organization:", error);
    } finally {
      setSwitching(false);
    }
  };

  const renderItem = ({ item }: { item: OrganizationSummary | null }) => {
    const isActive = item
      ? activeOrganization?.id === item.id
      : !activeOrganization;

    return (
      <TouchableOpacity
        className={`flex-row items-center p-4 border-b border-gray-100 ${
          isActive ? "bg-blue-50" : ""
        }`}
        onPress={() => handleSwitch(item?.id ?? null)}
        disabled={switching}
      >
        <View
          className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
            item ? "bg-blue-100" : "bg-gray-100"
          }`}
        >
          <Ionicons
            name={item ? "business" : "person"}
            size={20}
            color={item ? "#3B82F6" : "#6B7280"}
          />
        </View>
        <View className="flex-1">
          <Text className="text-base font-medium text-gray-900">
            {item ? item.name : "Personal Account"}
          </Text>
          {item && (
            <Text className="text-sm text-gray-500 capitalize">
              {item.business_type} • {item.role}
            </Text>
          )}
          {!item && (
            <Text className="text-sm text-gray-500">
              Your personal cash book
            </Text>
          )}
        </View>
        {isActive && (
          <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-row items-center p-3 bg-gray-50 rounded-lg">
        <ActivityIndicator size="small" color="#3B82F6" />
        <Text className="ml-2 text-gray-500">Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center p-3 bg-gray-50 rounded-lg"
        onPress={() => setModalVisible(true)}
      >
        <View
          className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${
            activeOrganization ? "bg-blue-100" : "bg-gray-200"
          }`}
        >
          <Ionicons
            name={activeOrganization ? "business" : "person"}
            size={16}
            color={activeOrganization ? "#3B82F6" : "#6B7280"}
          />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
            {activeOrganization?.name ?? "Personal Account"}
          </Text>
          {activeOrganization && (
            <Text className="text-xs text-gray-500 capitalize">
              {activeOrganization.role}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-down" size={20} color="#6B7280" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <Text className="text-lg font-semibold text-gray-900">
                Switch Account
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {switching && (
              <View className="absolute inset-0 bg-white/80 items-center justify-center z-10">
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            )}

            <FlatList
              data={[null, ...organizations]}
              keyExtractor={(item) => item?.id ?? "personal"}
              renderItem={renderItem}
              ListEmptyComponent={
                <View className="p-8 items-center">
                  <Text className="text-gray-500">No organizations yet</Text>
                </View>
              }
            />

            {onCreateNew && (
              <TouchableOpacity
                className="flex-row items-center p-4 border-t border-gray-100"
                onPress={() => {
                  setModalVisible(false);
                  onCreateNew();
                }}
              >
                <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
                  <Ionicons name="add" size={24} color="#10B981" />
                </View>
                <Text className="text-base font-medium text-green-600">
                  Create New Organization
                </Text>
              </TouchableOpacity>
            )}

            <View className="h-8" />
          </View>
        </View>
      </Modal>
    </>
  );
}
