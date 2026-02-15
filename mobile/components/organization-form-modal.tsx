import React, { useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { organizationsApi, type Organization } from "../services/organizations";
import { getApiErrorMessage } from "../lib/api";
import { toast } from "../lib/toast";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { CustomInput } from "./custom-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { ActionButton } from "./action-button";
import { useTheme } from "../hooks/useTheme";

const BUSINESS_TYPES = [
  { value: "retail_shop", label: "Retail Shop", icon: "storefront" },
  { value: "wholesale", label: "Wholesale", icon: "cube" },
  { value: "restaurant", label: "Restaurant/Food", icon: "restaurant" },
  { value: "service", label: "Service Business", icon: "construct" },
  { value: "manufacturing", label: "Manufacturing", icon: "hammer" },
  { value: "general", label: "General/Other", icon: "business" },
] as const;

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
] as const;

const STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "#10b981" },
  { value: "suspended", label: "Suspended", color: "#f59e0b" },
  { value: "archived", label: "Archived", color: "#ef4444" },
] as const;

// Zod validation schema
const organizationSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  description: z.string().optional(),
  business_type: z.string(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  currency: z.string(),
  status: z.enum(["active", "suspended", "archived"]),
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
      status: "active",
    },
  });

  const selectedBusinessType = watch("business_type");
  const selectedCurrency = watch("currency");
  const selectedStatus = watch("status");

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
          currency:
            organization.settings?.currency_code ||
            organization.settings?.currency ||
            "USD",
          status: organization.status || "active",
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
          status: "active",
        });
      }
    }
  }, [organization, visible, reset]);

  const onSubmit = async (data: OrganizationFormData) => {
    setIsLoading(true);
    try {
      const params: any = {
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
        status: data.status,
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
      toast.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
          className="justify-end"
        >
          <View
            style={{ backgroundColor: colors.bg.primary, maxHeight: "90%" }}
            className="rounded-t-3xl flex-1"
          >
            {/* Header */}
            <View
              style={{ borderColor: colors.border }}
              className="flex-row justify-between items-center p-6 pb-4 border-b"
            >
              <View>
                <Text
                  style={{ color: colors.text.primary }}
                  className="text-xl font-bold"
                >
                  {isEditing ? "Edit Organization" : "New Organization"}
                </Text>
                <Text
                  style={{ color: colors.text.secondary }}
                  className="text-sm"
                >
                  {isEditing
                    ? "Update organization details"
                    : "Create a new organization"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{ backgroundColor: colors.bg.tertiary }}
                className="w-8 h-8 rounded-full items-center justify-center"
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 px-6 py-4"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Business Name */}
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Business Name *"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Enter business name"
                    error={errors.name?.message}
                    containerClassName="mb-5"
                    autoCapitalize="words"
                  />
                )}
              />

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
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, onBlur, value } }) => (
                  <CustomInput
                    label="Description"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Brief description of your business"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    inputClassName="min-h-[80px]"
                    containerClassName="mb-5"
                  />
                )}
              />

              {/* Contact Section */}
              <View className="mb-5">
                <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Contact Information
                </Text>

                {/* Phone */}
                <Controller
                  control={control}
                  name="phone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <CustomInput
                      label="Phone"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Business phone number"
                      keyboardType="phone-pad"
                      containerClassName="mb-4"
                    />
                  )}
                />

                {/* Email */}
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <CustomInput
                      label="Email"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Business email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      error={errors.email?.message}
                      containerClassName="mb-4"
                    />
                  )}
                />

                {/* Address */}
                <Controller
                  control={control}
                  name="address"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <CustomInput
                      label="Address"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Business address"
                    />
                  )}
                />
              </View>

              {/* Settings Section */}
              <View className="mb-5">
                <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Settings
                </Text>

                {/* Currency */}
                <View className="mb-4">
                  <Text className="text-slate-700 mb-2 text-sm font-medium">
                    Currency
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {CURRENCIES.map((curr) => (
                      <TouchableOpacity
                        key={curr.code}
                        className={`px-4 py-3 rounded-xl border-2 flex-row items-center ${
                          selectedCurrency === curr.code
                            ? "bg-blue-50 border-blue-500"
                            : "bg-slate-50 border-slate-200"
                        }`}
                        onPress={() => setValue("currency", curr.code)}
                      >
                        <Text
                          className={`text-lg font-bold mr-2 ${
                            selectedCurrency === curr.code
                              ? "text-blue-600"
                              : "text-slate-500"
                          }`}
                        >
                          {curr.symbol}
                        </Text>
                        <Text
                          className={`text-sm font-semibold ${
                            selectedCurrency === curr.code
                              ? "text-blue-700"
                              : "text-slate-600"
                          }`}
                        >
                          {curr.code}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Status */}
                {isEditing && (
                  <View>
                    <Text className="text-slate-700 mb-2 text-sm font-medium">
                      Status
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {STATUS_OPTIONS.map((status) => (
                        <TouchableOpacity
                          key={status.value}
                          className={`flex-1 min-w-[100px] px-4 py-3 rounded-xl border-2 flex-row items-center justify-center ${
                            selectedStatus === status.value
                              ? "bg-blue-50 border-blue-500"
                              : "bg-slate-50 border-slate-200"
                          }`}
                          onPress={() => setValue("status", status.value)}
                        >
                          <View
                            className="w-5 h-5 rounded-full items-center justify-center mr-2"
                            style={{
                              backgroundColor:
                                selectedStatus === status.value
                                  ? status.color
                                  : "#94a3b8",
                            }}
                          >
                            {selectedStatus === status.value && (
                              <Ionicons
                                name="checkmark"
                                size={12}
                                color="white"
                              />
                            )}
                          </View>
                          <Text
                            className={`text-sm font-semibold ${
                              selectedStatus === status.value
                                ? "text-blue-700"
                                : "text-slate-600"
                            }`}
                          >
                            {status.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View className="p-6 pt-4 pb-8 border-t border-gray-100">
              <ActionButton
                label={isEditing ? "Save Changes" : "Create Organization"}
                onPress={handleSubmit(onSubmit)}
                isLoading={isLoading}
                disabled={isLoading}
                fullWidth
                size="medium"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
