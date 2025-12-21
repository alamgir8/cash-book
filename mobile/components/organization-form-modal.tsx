import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  organizationsApi,
  type Organization,
  type CreateOrganizationParams,
} from "../services/organizations";
import { getApiErrorMessage } from "../lib/api";

const BUSINESS_TYPES = [
  { value: "retail", label: "Retail Shop", icon: "storefront" },
  { value: "wholesale", label: "Wholesale", icon: "cube" },
  { value: "restaurant", label: "Restaurant/Food", icon: "restaurant" },
  { value: "service", label: "Service Business", icon: "construct" },
  { value: "manufacturing", label: "Manufacturing", icon: "hammer" },
  { value: "general", label: "General/Other", icon: "business" },
] as const;

interface OrganizationFormModalProps {
  visible: boolean;
  organization?: Organization | null;
  onClose: () => void;
  onSuccess: (org: Organization) => void;
}

export function OrganizationFormModal({
  visible,
  organization,
  onClose,
  onSuccess,
}: OrganizationFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [businessType, setBusinessType] = useState("general");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!organization;

  useEffect(() => {
    if (organization) {
      setName(organization.name || "");
      setDescription(organization.description || "");
      setBusinessType(organization.business_type || "general");
      setPhone(organization.contact?.phone || "");
      setEmail(organization.contact?.email || "");
      setAddress(organization.address?.street || "");
      setCurrency(organization.settings?.currency || "USD");
    } else {
      // Reset form
      setName("");
      setDescription("");
      setBusinessType("general");
      setPhone("");
      setEmail("");
      setAddress("");
      setCurrency("USD");
    }
  }, [organization, visible]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Organization name is required");
      return;
    }

    setIsLoading(true);
    try {
      const params: CreateOrganizationParams = {
        name: name.trim(),
        description: description.trim() || undefined,
        business_type: businessType,
        contact: {
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        },
        address: {
          street: address.trim() || undefined,
        },
        settings: {
          currency,
        },
      };

      let result: Organization;
      if (isEditing && organization) {
        result = await organizationsApi.update(organization._id, params);
      } else {
        result = await organizationsApi.create(params);
      }

      onSuccess(result);
      onClose();
    } catch (error) {
      Alert.alert("Error", getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <TouchableOpacity onPress={onClose} disabled={isLoading}>
            <Text className="text-blue-500 text-base">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Organization" : "New Organization"}
          </Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Text className="text-blue-500 text-base font-medium">
                {isEditing ? "Save" : "Create"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Business Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Business Name *
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="Enter business name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Business Type */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Business Type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {BUSINESS_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  className={`flex-row items-center px-3 py-2 rounded-lg border ${
                    businessType === type.value
                      ? "bg-blue-50 border-blue-500"
                      : "bg-gray-50 border-gray-200"
                  }`}
                  onPress={() => setBusinessType(type.value)}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={18}
                    color={businessType === type.value ? "#3B82F6" : "#6B7280"}
                  />
                  <Text
                    className={`ml-2 text-sm ${
                      businessType === type.value
                        ? "text-blue-600 font-medium"
                        : "text-gray-600"
                    }`}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Description
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="Brief description of your business"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Contact Section */}
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">
            Contact Information
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Phone
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="Business phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Email
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="Business email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Address
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
              placeholder="Business address"
              value={address}
              onChangeText={setAddress}
              multiline
            />
          </View>

          {/* Currency */}
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">
            Settings
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Currency
            </Text>
            <View className="flex-row gap-2">
              {["USD", "EUR", "GBP", "BDT", "INR"].map((curr) => (
                <TouchableOpacity
                  key={curr}
                  className={`px-4 py-2 rounded-lg border ${
                    currency === curr
                      ? "bg-blue-50 border-blue-500"
                      : "bg-gray-50 border-gray-200"
                  }`}
                  onPress={() => setCurrency(curr)}
                >
                  <Text
                    className={`text-sm ${
                      currency === curr
                        ? "text-blue-600 font-medium"
                        : "text-gray-600"
                    }`}
                  >
                    {curr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="h-8" />
        </ScrollView>
      </View>
    </Modal>
  );
}
