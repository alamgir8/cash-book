import React, { useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  organizationsApi,
  type Organization,
  type CreateOrganizationParams,
} from "../services/organizations";
import { getApiErrorMessage } from "../lib/api";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const BUSINESS_TYPES = [
  { value: "retail", label: "Retail Shop", icon: "storefront" },
  { value: "wholesale", label: "Wholesale", icon: "cube" },
  { value: "restaurant", label: "Restaurant/Food", icon: "restaurant" },
  { value: "service", label: "Service Business", icon: "construct" },
  { value: "manufacturing", label: "Manufacturing", icon: "hammer" },
  { value: "general", label: "General/Other", icon: "business" },
] as const;

const CURRENCIES = ["USD", "EUR", "GBP", "BDT", "INR"] as const;

// Zod validation schema
const organizationSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  description: z.string().optional(),
  business_type: z.string(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  currency: z.string(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

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
  const isEditing = !!organization;
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: "",
      description: "",
      business_type: "general",
      phone: "",
      email: "",
      address: "",
      currency: "USD",
    },
  });

  const selectedBusinessType = watch("business_type");
  const selectedCurrency = watch("currency");

  useEffect(() => {
    if (visible) {
      if (organization) {
        reset({
          name: organization.name || "",
          description: organization.description || "",
          business_type: organization.business_type || "general",
          phone: organization.contact?.phone || "",
          email: organization.contact?.email || "",
          address: organization.address?.street || "",
          currency: organization.settings?.currency || "USD",
        });
      } else {
        reset({
          name: "",
          description: "",
          business_type: "general",
          phone: "",
          email: "",
          address: "",
          currency: "USD",
        });
      }
    }
  }, [organization, visible, reset]);

  const onSubmit = async (data: OrganizationFormData) => {
    setIsLoading(true);
    try {
      const params: CreateOrganizationParams = {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        business_type: data.business_type,
        contact: {
          phone: data.phone?.trim() || undefined,
          email: data.email?.trim() || undefined,
        },
        address: {
          street: data.address?.trim() || undefined,
        },
        settings: {
          currency: data.currency,
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-white"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-200">
          <TouchableOpacity
            onPress={onClose}
            disabled={isLoading}
            className="py-2"
          >
            <Text className="text-blue-600 text-base font-medium">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-slate-900">
            {isEditing ? "Edit Organization" : "New Organization"}
          </Text>
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            className="py-2"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Text className="text-blue-600 text-base font-semibold">
                {isEditing ? "Save" : "Create"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Business Name */}
          <View className="mb-5">
            <Text className="text-slate-700 mb-2 text-base font-medium">
              Business Name <Text className="text-red-500">*</Text>
            </Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Enter business name"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                  className={`bg-slate-50 border rounded-2xl px-4 py-4 text-base text-slate-900 ${
                    errors.name ? "border-red-400" : "border-slate-200"
                  }`}
                />
              )}
            />
            {errors.name && (
              <Text className="text-red-500 text-sm mt-2">
                {errors.name.message}
              </Text>
            )}
          </View>

          {/* Business Type */}
          <View className="mb-5">
            <Text className="text-slate-700 mb-3 text-base font-medium">
              Business Type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {BUSINESS_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  className={`flex-row items-center px-4 py-3 rounded-xl border-2 ${
                    selectedBusinessType === type.value
                      ? "bg-blue-50 border-blue-500"
                      : "bg-slate-50 border-slate-200"
                  }`}
                  onPress={() => setValue("business_type", type.value)}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={18}
                    color={
                      selectedBusinessType === type.value
                        ? "#2563EB"
                        : "#64748B"
                    }
                  />
                  <Text
                    className={`ml-2 text-sm font-medium ${
                      selectedBusinessType === type.value
                        ? "text-blue-600"
                        : "text-slate-600"
                    }`}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View className="mb-5">
            <Text className="text-slate-700 mb-2 text-base font-medium">
              Description
            </Text>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Brief description of your business"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-base text-slate-900 min-h-[80px]"
                />
              )}
            />
          </View>

          {/* Contact Section */}
          <View className="mb-5">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Contact Information
            </Text>

            {/* Phone */}
            <View className="mb-4">
              <Text className="text-slate-700 mb-2 text-base font-medium">
                Phone
              </Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Business phone number"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-base text-slate-900"
                  />
                )}
              />
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text className="text-slate-700 mb-2 text-base font-medium">
                Email
              </Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Business email"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className={`bg-slate-50 border rounded-2xl px-4 py-4 text-base text-slate-900 ${
                      errors.email ? "border-red-400" : "border-slate-200"
                    }`}
                  />
                )}
              />
              {errors.email && (
                <Text className="text-red-500 text-sm mt-2">
                  {errors.email.message}
                </Text>
              )}
            </View>

            {/* Address */}
            <View>
              <Text className="text-slate-700 mb-2 text-base font-medium">
                Address
              </Text>
              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Business address"
                    placeholderTextColor="#94A3B8"
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-base text-slate-900"
                  />
                )}
              />
            </View>
          </View>

          {/* Settings Section */}
          <View className="mb-5">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Settings
            </Text>

            {/* Currency */}
            <View>
              <Text className="text-slate-700 mb-3 text-base font-medium">
                Currency
              </Text>
              <View className="flex-row gap-2">
                {CURRENCIES.map((curr) => (
                  <TouchableOpacity
                    key={curr}
                    className={`px-5 py-3 rounded-xl border-2 ${
                      selectedCurrency === curr
                        ? "bg-blue-50 border-blue-500"
                        : "bg-slate-50 border-slate-200"
                    }`}
                    onPress={() => setValue("currency", curr)}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        selectedCurrency === curr
                          ? "text-blue-600"
                          : "text-slate-600"
                      }`}
                    >
                      {curr}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
