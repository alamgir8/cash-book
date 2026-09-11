import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FormSheetModal } from "./form-sheet-modal";
import { type Organization } from "../services/organizations";
import {
  dalCreateOrganization,
  dalUpdateOrganization,
} from "../data/organizations";
import { getApiErrorMessage } from "../lib/api";
import { toast } from "../lib/toast";
import { useForm, Controller } from "react-hook-form";
import { CustomInput } from "./custom-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "../hooks/use-theme";
import { useTranslation } from "../hooks/use-translation";
import {
  CURRENCY_VALUES,
  ORGANIZATION_STATUS_VALUES,
  organizationFormSchema,
  type OrganizationFormData,
} from "../lib/validations/shop";

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
  { value: "archived", label: "Archived", color: "#f43f5e" },
] as const;

/**
 * A stored currency outside the picker's options (e.g. set on the backend)
 * would be an invalid enum value, so fall back to the default rather than
 * trapping the user on an unsaveable form.
 */
function coerceCurrency(stored?: string | null): OrganizationFormData["currency"] {
  return (CURRENCY_VALUES as readonly string[]).includes(stored ?? "")
    ? (stored as OrganizationFormData["currency"])
    : "USD";
}

function coerceBusinessType(
  stored?: string | null,
): OrganizationFormData["business_type"] {
  const known = BUSINESS_TYPES.map((t) => t.value) as readonly string[];
  return known.includes(stored ?? "")
    ? (stored as OrganizationFormData["business_type"])
    : "general";
}

function coerceStatus(stored?: string | null): OrganizationFormData["status"] {
  return (ORGANIZATION_STATUS_VALUES as readonly string[]).includes(stored ?? "")
    ? (stored as OrganizationFormData["status"])
    : "active";
}

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
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = React.useState(false);
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationFormSchema),
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
          business_type: coerceBusinessType(organization.business_type),
          phone: organization.contact?.phone || "",
          email: organization.contact?.email || "",
          address: organization.address?.street || "",
          currency: coerceCurrency(
            organization.settings?.currency_code ||
              organization.settings?.currency,
          ),
          status: coerceStatus(organization.status),
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
        // Offline-first: mirrors locally and queues the server update.
        result = await dalUpdateOrganization(organization._id, params);
        toast.success("Shop saved");
      } else {
        // Create needs the backend: it owns the id used by every shop row.
        try {
          result = await dalCreateOrganization(params);
        } catch (e: any) {
          if (!e?.response) {
            toast.error(
              "Creating a shop needs a connection once. Other settings save offline.",
            );
            return;
          }
          throw e;
        }
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
    <FormSheetModal
      visible={visible}
      onClose={onClose}
      title={isEditing ? "Edit Organization" : "New Organization"}
      subtitle={
        isEditing
          ? "Update organization details"
          : "Create a new organization"
      }
      submitLabel={isEditing ? "Save Changes" : "Create Organization"}
      submitIcon={isEditing ? "checkmark-circle" : "add-circle"}
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isLoading}
      submittingLabel="Saving…"
    >
      <View className="gap-5">
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
                <Text
                  className="mb-3 text-base font-medium"
                  style={{ color: colors.text.primary }}
                >
                  Business Type
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {BUSINESS_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      className="flex-row items-center px-4 py-3 rounded-xl border-2"
                      style={{
                        backgroundColor:
                          selectedBusinessType === type.value
                            ? colors.primary + "15"
                            : colors.bg.secondary,
                        borderColor:
                          selectedBusinessType === type.value
                            ? colors.primary
                            : colors.border,
                      }}
                      onPress={() => setValue("business_type", type.value)}                    >
                      <Ionicons
                        name={type.icon as any}
                        size={18}
                        color={
                          selectedBusinessType === type.value
                            ? colors.primary
                            : colors.text.tertiary
                        }
                      />
                      <Text
                        className="ml-2 text-sm font-medium"
                        style={{
                          color:
                            selectedBusinessType === type.value
                              ? colors.primary
                              : colors.text.secondary,
                        }}
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
                <Text
                  className="text-xs font-bold uppercase tracking-wider mb-4"
                  style={{ color: colors.text.tertiary }}
                >
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
                <Text
                  className="text-xs font-bold uppercase tracking-wider mb-4"
                  style={{ color: colors.text.tertiary }}
                >
                  Settings
                </Text>

                {/* Currency */}
                <View className="mb-4">
                  <Text
                    className="mb-2 text-sm font-medium"
                    style={{ color: colors.text.primary }}
                  >
                    Currency
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {CURRENCIES.map((curr) => (
                      <TouchableOpacity
                        key={curr.code}
                        className="px-4 py-3 rounded-xl border-2 flex-row items-center"
                        style={{
                          backgroundColor:
                            selectedCurrency === curr.code
                              ? colors.primary + "15"
                              : colors.bg.secondary,
                          borderColor:
                            selectedCurrency === curr.code
                              ? colors.primary
                              : colors.border,
                        }}
                        onPress={() => setValue("currency", curr.code)}
                      >
                        <Text
                          className="text-lg font-bold mr-2"
                          style={{
                            color:
                              selectedCurrency === curr.code
                                ? colors.primary
                                : colors.text.tertiary,
                          }}
                        >
                          {curr.symbol}
                        </Text>
                        <Text
                          className="text-sm font-semibold"
                          style={{
                            color:
                              selectedCurrency === curr.code
                                ? colors.primary
                                : colors.text.secondary,
                          }}
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
                    <Text
                      className="mb-2 text-sm font-medium"
                      style={{ color: colors.text.primary }}
                    >
                      Status
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {STATUS_OPTIONS.map((status) => (
                        <TouchableOpacity
                          key={status.value}
                          className="flex-1 min-w-[100px] px-4 py-3 rounded-xl border-2 flex-row items-center justify-center"
                          style={{
                            backgroundColor:
                              selectedStatus === status.value
                                ? colors.primary + "15"
                                : colors.bg.secondary,
                            borderColor:
                              selectedStatus === status.value
                                ? colors.primary
                                : colors.border,
                          }}
                          onPress={() => setValue("status", status.value)}
                        >
                          <View
                            className="w-5 h-5 rounded-full items-center justify-center mr-2"
                            style={{
                              backgroundColor:
                                selectedStatus === status.value
                                  ? status.color
                                  : colors.text.tertiary,
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
                            className="text-sm font-semibold"
                            style={{
                              color:
                                selectedStatus === status.value
                                  ? colors.primary
                                  : colors.text.secondary,
                            }}
                          >
                            {status.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
      </View>
    </FormSheetModal>
  );
}
