import { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { toast } from "@/lib/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { partiesApi, PartyType } from "@/services/parties";
import { getApiErrorMessage } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "@/hooks/useTheme";

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
  notes: z.string().optional(),
});

type PartyFormData = z.infer<typeof partySchema>;

export default function EditPartyScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PartyFormData>({
    resolver: zodResolver(partySchema),
    defaultValues: {
      name: "",
      type: "customer",
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
      notes: "",
    },
  });

  const selectedType = watch("type");

  // Fetch party data
  const { data: party, isLoading } = useQuery({
    queryKey: ["party", partyId],
    queryFn: () => partiesApi.get(partyId!),
    enabled: !!partyId,
  });

  // Populate form when party data loads
  useEffect(() => {
    if (party) {
      reset({
        name: party.name,
        type: party.type,
        code: party.code || "",
        phone: party.phone || "",
        email: party.email || "",
        address: {
          street:
            typeof party.address === "object"
              ? party.address?.street || ""
              : "",
          city:
            typeof party.address === "object" ? party.address?.city || "" : "",
          state:
            typeof party.address === "object" ? party.address?.state || "" : "",
          country:
            typeof party.address === "object"
              ? party.address?.country || ""
              : "",
          postal_code:
            typeof party.address === "object"
              ? party.address?.postal_code || ""
              : "",
        },
        tax_id: party.tax_id || "",
        credit_limit: party.credit_limit?.toString() || "",
        payment_terms_days: party.payment_terms_days?.toString() || "",
        notes: party.notes || "",
      });
    }
  }, [party, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof partiesApi.update>[1]) =>
      partiesApi.update(partyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PARTIES });
      queryClient.invalidateQueries({ queryKey: ["party", partyId] });
      toast.success("Party updated successfully");
      router.back();
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const onSubmit = (data: PartyFormData) => {
    updateMutation.mutate({
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
      notes: data.notes || undefined,
    });
  };

  const partyTypes: {
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

  if (isLoading) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
        <View
          className="flex-row items-center justify-between px-5 py-3 border-b"
          style={{ backgroundColor: colors.bg.primary, borderColor: colors.border }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text className="text-lg font-bold" style={{ color: colors.text.primary }}>
            Edit Party
          </Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4" style={{ color: colors.text.tertiary }}>
            Loading party...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 py-3 border-b"
          style={{ backgroundColor: colors.bg.primary, borderColor: colors.border }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text className="text-lg font-bold" style={{ color: colors.text.primary }}>
            Edit Party
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
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
                      keyboardType="decimal-pad"
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
                      keyboardType="number-pad"
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
        </ScrollView>

        {/* Submit Button */}
        <View
          className="absolute bottom-0 left-0 right-0 px-5 py-4 border-t"
          style={{ backgroundColor: colors.bg.primary, borderColor: colors.border }}
        >
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={updateMutation.isPending || isSubmitting}
            className="rounded-xl py-4 items-center"
            style={{
              backgroundColor: updateMutation.isPending || isSubmitting
                ? colors.primary + '60'
                : colors.primary,
            }}
          >
            {updateMutation.isPending ? (
              <Text className="text-white font-semibold text-base">
                Updating...
              </Text>
            ) : (
              <View className="flex-row items-center">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={22}
                  color="white"
                />
                <Text className="text-white font-semibold text-base ml-2">
                  Update Party
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
