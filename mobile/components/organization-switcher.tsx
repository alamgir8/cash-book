import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { Organization } from "@/services/organizations";

interface OrganizationSwitcherProps {
  visible: boolean;
  organizations: Organization[];
  currentOrganization: Organization | null;
  onSelect: (org: Organization) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function OrganizationSwitcher({
  visible,
  organizations,
  currentOrganization,
  onSelect,
  onClose,
  isLoading,
}: OrganizationSwitcherProps) {
  const { colors } = useTheme();

  const renderOrganization = ({ item }: { item: Organization }) => {
    const isSelected = currentOrganization?._id === item._id;
    return (
      <TouchableOpacity
        className={`flex-row items-center p-4 mx-4 mb-2 rounded-xl ${
          isSelected ? "border" : ""
        }`}
        style={{
          backgroundColor: isSelected ? "#eff6ff" : colors.bg.secondary,
          borderColor: isSelected ? "#bfdbfe" : "transparent",
        }}
        onPress={() => onSelect(item)}
      >
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{
            backgroundColor: isSelected ? colors.primary : colors.bg.tertiary,
          }}
        >
          <Ionicons
            name="business"
            size={20}
            color={isSelected ? "white" : colors.text.tertiary}
          />
        </View>
        <View className="flex-1 ml-3">
          <Text
            className="text-base font-semibold"
            style={{
              color: isSelected ? colors.primary : colors.text.primary,
            }}
          >
            {item.name}
          </Text>
          {item.business_type && (
            <Text
              className="text-sm capitalize"
              style={{ color: colors.text.secondary }}
            >
              {item.business_type.replace("_", " ")}
            </Text>
          )}
        </View>
        {isSelected && (
          <View
            className="p-1 rounded-full"
            style={{ backgroundColor: "#d1fae5" }}
          >
            <Ionicons name="checkmark" size={16} color="#10B981" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: colors.modalOverlay }}
      >
        <View
          className="rounded-t-3xl max-h-[70%]"
          style={{ backgroundColor: colors.bg.primary }}
        >
          {/* Header */}
          <View
            className="flex-row items-center justify-between p-5 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <Text
              className="text-xl font-bold"
              style={{ color: colors.text.primary }}
            >
              Switch Organization
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.bg.tertiary }}
            >
              <Ionicons name="close" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View className="p-8 items-center">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-3" style={{ color: colors.text.secondary }}>
                Loading organizations...
              </Text>
            </View>
          ) : organizations.length === 0 ? (
            <View className="p-8 items-center">
              <Text style={{ color: colors.text.secondary }}>
                No organizations found
              </Text>
            </View>
          ) : (
            <FlatList
              data={organizations}
              renderItem={renderOrganization}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingVertical: 16 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
