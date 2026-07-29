import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router, useLocalSearchParams } from "expo-router";
import { toast } from "@/lib/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { partiesApi, PartyType } from "@/services/parties";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActiveOrgId, useOrganization } from "@/hooks/use-organization";
import { getApiErrorMessage } from "@/lib/api";
import { useTheme } from "@/hooks/use-theme";
import { amountInputProps, integerInputProps } from "@/lib/amount-input";
import { useKeyboardFooterLift } from "@/hooks/use-keyboard-footer-lift";

// Zod validation schema
const partySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.enum(["customer", "supplier", "both"]),
  code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postal_code: z.string().optional(),
    })
    .optional(),
  tax_id: z.string().optional(),
  credit_limit: z.string().optional(),
  payment_terms_days: z.string().optional(),
  opening_balance: z.string().optional(),
  opening_balance_type: z.enum(["receivable", "payable"]),
  notes: z.string().optional(),
});

type PartyFormData = z.infer<typeof partySchema>;

export default function CreatePartyScreen() {
  const queryClient = useQueryClient();
  const organizationId = useActiveOrgId();
  const { canManageCustomers, canManageSuppliers } = useOrganization();
  const params = useLocalSearchParams<{ type?: PartyType }>();
  const { colors } = useTheme();
  const { footerContainerStyle, scrollProps } = useKeyboardFooterLift();

  // Determine default type based on permissions and query param
  const getDefaultType = (): PartyType => {
    if (params.type) return params.type;
    if (canManageCustomers && !canManageSuppliers) return "customer";
    if (!canManageCustomers && canManageSuppliers) return "supplier";
    return "customer"; // Default to customer if both permissions available
  };

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PartyFormData>({
    resolver: zodResolver(partySchema),
    defaultValues: {
      name: "",
      type: getDefaultType(),
      code: "",
      phone: "",
      email: "",
      address: {
        street: "",
        city: "",
        state: "",
        country: "",
        postal_code: "",
      },
      tax_id: "",
      credit_limit: "",
      payment_terms_days: "",
      opening_balance: "",
      opening_balance_type: "receivable",
      notes: "",
    },
  });

  const selectedType = watch("type");
  const selectedBalanceType = watch("opening_balance_type");

  const createMutation = useMutation({
    mutationFn: partiesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parties });
      toast.success("Party created successfully");
      router.back();
    },
    onError: (error: any) => {
      console.error("Party creation error:", error);
      const errorMessage = getApiErrorMessage(error);
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: PartyFormData) => {
    const payload = {
      organization: organizationId || undefined,
      name: data.name,
      type: data.type,
      code: data.code || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address,
      tax_id: data.tax_id || undefined,
      credit_limit: data.credit_limit
        ? parseFloat(data.credit_limit)
        : undefined,
      payment_terms_days: data.payment_terms_days
        ? parseInt(data.payment_terms_days)
        : undefined,
      opening_balance: data.opening_balance
        ? parseFloat(data.opening_balance)
        : 0,
      notes: data.notes || undefined,
    };

    console.log("Creating party with payload:", payload);
    createMutation.mutate(payload);
  };

  // Filter party types based on permissions
  const allPartyTypes: {
    value: PartyType;
    label: string;
    icon: string;
    color: string;
  }[] = [
    {
      value: "customer",
      label: "Customer",
      icon: "person-outline",
      color: "#10B981",
    },
    {
      value: "supplier",
      label: "Supplier",
      icon: "business-outline",
      color: "#6366F1",
    },
    { value: "both", label: "Both", icon: "people-outline", color: "#F59E0B" },
  ];

  const partyTypes = allPartyTypes.filter((type) => {
    if (type.value === "customer") return canManageCustomers;
    if (type.value === "supplier") return canManageSuppliers;
    if (type.value === "both") return canManageCustomers && canManageSuppliers;
    return false;
  });

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.bg.primary,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.bg.tertiary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: colors.text.primary,
              textAlign: "center",
            }}
          >
            New Party
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.text.secondary,
              textAlign: "center",
              marginTop: 2,
            }}
          >
            Add a customer or supplier
          </Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        {...scrollProps}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
          {/* Party Type Selection */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Text className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
              Party Type <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <View className="flex-row gap-3">
              {partyTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  onPress={() => setValue("type", type.value)}
                  className="flex-1 p-4 rounded-xl border-2 items-center"
                  style={{
                    borderColor: selectedType === type.value ? colors.primary : colors.border,
                    backgroundColor: selectedType === type.value ? colors.primary + '10' : colors.bg.secondary,
                  }}
                >
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center mb-2"
                    style={{
                      backgroundColor:
                        selectedType === type.value
                          ? type.color + "20"
                          : colors.bg.tertiary,
                    }}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={24}
                      color={
                        selectedType === type.value ? type.color : colors.text.tertiary
                      }
                    />
                  </View>
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: selectedType === type.value ? colors.primary : colors.text.tertiary,
                    }}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Basic Information */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Text className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
              Basic Information
            </Text>

            {/* Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Name <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Enter party name"
                    placeholderTextColor={colors.inputPlaceholder}
                    className="border rounded-xl px-4 py-3.5 text-base"
                    style={{
                      backgroundColor: colors.bg.secondary,
                      borderColor: errors.name ? colors.error : colors.inputBorder,
                      color: colors.text.primary,
                    }}
                  />
                )}
              />
              {errors.name && (
                <Text className="text-sm mt-1" style={{ color: colors.error }}>
                  {errors.name.message}
                </Text>
              )}
            </View>

            {/* Code */}
            <View className="mb-4">
              <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Code
              </Text>
              <Controller
                control={control}
                name="code"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Enter party code (optional)"
                    placeholderTextColor={colors.inputPlaceholder}
                    className="border rounded-xl px-4 py-3.5 text-base"
                    style={{
                      backgroundColor: colors.bg.secondary,
                      borderColor: colors.inputBorder,
                      color: colors.text.primary,
                    }}
                  />
                )}
              />
            </View>

            {/* Phone */}
            <View className="mb-4">
              <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
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
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.inputPlaceholder}
                    keyboardType="phone-pad"
                    className="border rounded-xl px-4 py-3.5 text-base"
                    style={{
                      backgroundColor: colors.bg.secondary,
                      borderColor: colors.inputBorder,
                      color: colors.text.primary,
                    }}
                  />
                )}
              />
            </View>

            {/* Email */}
            <View className="mb-0">
              <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
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
                    placeholder="Enter email address"
                    placeholderTextColor={colors.inputPlaceholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="border rounded-xl px-4 py-3.5 text-base"
                    style={{
                      backgroundColor: colors.bg.secondary,
                      borderColor: errors.email ? colors.error : colors.inputBorder,
                      color: colors.text.primary,
                    }}
                  />
                )}
              />
              {errors.email && (
                <Text className="text-sm mt-1" style={{ color: colors.error }}>
                  {errors.email.message}
                </Text>
              )}
            </View>
          </View>

          {/* Address & Tax */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Text className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
              Address & Tax
            </Text>

            {/* Street */}
            <View className="mb-4">
              <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Street Address
              </Text>
              <Controller
                control={control}
                name="address.street"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Enter street address"
                    placeholderTextColor={colors.inputPlaceholder}
                    className="border rounded-xl px-4 py-3.5 text-base"
                    style={{
                      backgroundColor: colors.bg.secondary,
                      borderColor: colors.inputBorder,
                      color: colors.text.primary,
                    }}
                  />
                )}
              />
            </View>

            {/* City & State Row */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  City
                </Text>
                <Controller
                  control={control}
                  name="address.city"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="City"
                      placeholderTextColor={colors.inputPlaceholder}
                      className="border rounded-xl px-4 py-3.5 text-base"
                      style={{
                        backgroundColor: colors.bg.secondary,
                        borderColor: colors.inputBorder,
                        color: colors.text.primary,
                      }}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  State
                </Text>
                <Controller
                  control={control}
                  name="address.state"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="State"
                      placeholderTextColor={colors.inputPlaceholder}
                      className="border rounded-xl px-4 py-3.5 text-base"
                      style={{
                        backgroundColor: colors.bg.secondary,
                        borderColor: colors.inputBorder,
                        color: colors.text.primary,
                      }}
                    />
                  )}
                />
              </View>
            </View>

            {/* Country & Postal Code Row */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Country
                </Text>
                <Controller
                  control={control}
                  name="address.country"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Country"
                      placeholderTextColor={colors.inputPlaceholder}
                      className="border rounded-xl px-4 py-3.5 text-base"
                      style={{
                        backgroundColor: colors.bg.secondary,
                        borderColor: colors.inputBorder,
                        color: colors.text.primary,
                      }}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Postal Code
                </Text>
                <Controller
                  control={control}
                  name="address.postal_code"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Postal"
                      placeholderTextColor={colors.inputPlaceholder}
                      className="border rounded-xl px-4 py-3.5 text-base"
                      style={{
                        backgroundColor: colors.bg.secondary,
                        borderColor: colors.inputBorder,
                        color: colors.text.primary,
                      }}
                    />
                  )}
                />
              </View>
            </View>

            {/* Tax ID */}
            <View className="mb-0">
              <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Tax ID / GST Number
              </Text>
              <Controller
                control={control}
                name="tax_id"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Enter Tax ID or GST Number"
                    placeholderTextColor={colors.inputPlaceholder}
                    className="border rounded-xl px-4 py-3.5 text-base"
                    style={{
                      backgroundColor: colors.bg.secondary,
                      borderColor: colors.inputBorder,
                      color: colors.text.primary,
                    }}
                  />
                )}
              />
            </View>
          </View>

          {/* Credit Settings */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Text className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
              Credit Settings
            </Text>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Credit Limit
                </Text>
                <Controller
                  control={control}
                  name="credit_limit"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="0.00"
                      placeholderTextColor={colors.inputPlaceholder}
                      {...amountInputProps}
                      className="border rounded-xl px-4 py-3.5 text-base"
                      style={{
                        backgroundColor: colors.bg.secondary,
                        borderColor: colors.inputBorder,
                        color: colors.text.primary,
                      }}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Payment Terms (Days)
                </Text>
                <Controller
                  control={control}
                  name="payment_terms_days"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="30"
                      placeholderTextColor={colors.inputPlaceholder}
                      {...integerInputProps}
                      className="border rounded-xl px-4 py-3.5 text-base"
                      style={{
                        backgroundColor: colors.bg.secondary,
                        borderColor: colors.inputBorder,
                        color: colors.text.primary,
                      }}
                    />
                  )}
                />
              </View>
            </View>
          </View>

          {/* Opening Balance */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Text className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
              Opening Balance
            </Text>

            <View className="mb-4">
              <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Balance Type
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setValue("opening_balance_type", "receivable")}
                  className="flex-1 p-3 rounded-xl border-2 items-center"
                  style={{
                    borderColor: selectedBalanceType === "receivable" ? "#10B981" : colors.border,
                    backgroundColor: selectedBalanceType === "receivable" ? "#10B98110" : colors.bg.secondary,
                  }}
                >
                  <Ionicons
                    name="arrow-down-outline"
                    size={20}
                    color={
                      selectedBalanceType === "receivable"
                        ? "#10B981"
                        : colors.text.tertiary
                    }
                  />
                  <Text
                    className="text-sm font-medium mt-1"
                    style={{
                      color: selectedBalanceType === "receivable"
                        ? "#10B981"
                        : colors.text.tertiary,
                    }}
                  >
                    Receivable
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setValue("opening_balance_type", "payable")}
                  className="flex-1 p-3 rounded-xl border-2 items-center"
                  style={{
                    borderColor: selectedBalanceType === "payable" ? "#EF4444" : colors.border,
                    backgroundColor: selectedBalanceType === "payable" ? "#EF444410" : colors.bg.secondary,
                  }}
                >
                  <Ionicons
                    name="arrow-up-outline"
                    size={20}
                    color={
                      selectedBalanceType === "payable" ? "#EF4444" : colors.text.tertiary
                    }
                  />
                  <Text
                    className="text-sm font-medium mt-1"
                    style={{
                      color: selectedBalanceType === "payable"
                        ? "#EF4444"
                        : colors.text.tertiary,
                    }}
                  >
                    Payable
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Amount
              </Text>
              <Controller
                control={control}
                name="opening_balance"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="0.00"
                    placeholderTextColor={colors.inputPlaceholder}
                    {...amountInputProps}
                    className="border rounded-xl px-4 py-3.5 text-base"
                    style={{
                      backgroundColor: colors.bg.secondary,
                      borderColor: colors.inputBorder,
                      color: colors.text.primary,
                    }}
                  />
                )}
              />
            </View>
          </View>

          {/* Notes */}
          <View
            className="mx-4 mt-4 rounded-2xl p-5 shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Text className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
              Notes
            </Text>
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Add any additional notes..."
                  placeholderTextColor={colors.inputPlaceholder}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  className="border rounded-xl px-4 py-3.5 text-base min-h-[100px]"
                  style={{
                    backgroundColor: colors.bg.secondary,
                    borderColor: colors.inputBorder,
                    color: colors.text.primary,
                  }}
                />
              )}
            />
          </View>

          {/* Submit moved to fixed footer */}
        </KeyboardAwareScrollView>

      <View
        style={{
          ...footerContainerStyle,
          borderTopColor: colors.border,
          backgroundColor: colors.bg.primary,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          disabled={createMutation.isPending || isSubmitting}
          className="rounded-2xl py-4 items-center shadow-lg"
          style={{
            backgroundColor: colors.info,
            opacity: createMutation.isPending || isSubmitting ? 0.7 : 1,
          }}
        >
          {createMutation.isPending || isSubmitting ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="white" />
              <Text className="text-white font-bold text-base">Creating…</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="add-circle" size={20} color="white" />
              <Text className="text-white font-bold text-base">
                Create Party
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
