import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { partiesApi, PartyType } from "@/services/parties";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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

export default function NewPartyScreen() {
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PARTIES });
      Alert.alert("Success", "Party created successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create party"
      );
    },
  });

  const onSubmit = (data: PartyFormData) => {
    createMutation.mutate({
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

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 bg-white border-b border-slate-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-slate-900">New Party</Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Party Type Selection */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-4">
              Party Type <Text className="text-red-500">*</Text>
            </Text>
            <View className="flex-row gap-3">
              {partyTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  onPress={() => setValue("type", type.value)}
                  className={`flex-1 p-4 rounded-xl border-2 items-center ${
                    selectedType === type.value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <View
                    className={`w-12 h-12 rounded-full items-center justify-center mb-2`}
                    style={{
                      backgroundColor:
                        selectedType === type.value
                          ? type.color + "20"
                          : "#F1F5F9",
                    }}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={24}
                      color={
                        selectedType === type.value ? type.color : "#94A3B8"
                      }
                    />
                  </View>
                  <Text
                    className={`text-sm font-medium ${
                      selectedType === type.value
                        ? "text-indigo-600"
                        : "text-slate-500"
                    }`}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Basic Information */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-4">
              Basic Information
            </Text>

            {/* Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-600 mb-2">
                Name <Text className="text-red-500">*</Text>
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
                    placeholderTextColor="#94A3B8"
                    className={`bg-slate-50 border rounded-xl px-4 py-3.5 text-slate-800 text-base ${
                      errors.name ? "border-red-400" : "border-slate-200"
                    }`}
                  />
                )}
              />
              {errors.name && (
                <Text className="text-red-500 text-sm mt-1">
                  {errors.name.message}
                </Text>
              )}
            </View>

            {/* Code */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-600 mb-2">
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
                    placeholderTextColor="#94A3B8"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                  />
                )}
              />
            </View>

            {/* Phone */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-600 mb-2">
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
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                  />
                )}
              />
            </View>

            {/* Email */}
            <View className="mb-0">
              <Text className="text-sm font-medium text-slate-600 mb-2">
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
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className={`bg-slate-50 border rounded-xl px-4 py-3.5 text-slate-800 text-base ${
                      errors.email ? "border-red-400" : "border-slate-200"
                    }`}
                  />
                )}
              />
              {errors.email && (
                <Text className="text-red-500 text-sm mt-1">
                  {errors.email.message}
                </Text>
              )}
            </View>
          </View>

          {/* Address & Tax */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-4">
              Address & Tax
            </Text>

            {/* Street */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-600 mb-2">
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
                    placeholderTextColor="#94A3B8"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                  />
                )}
              />
            </View>

            {/* City & State Row */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-600 mb-2">
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
                      placeholderTextColor="#94A3B8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-600 mb-2">
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
                      placeholderTextColor="#94A3B8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                    />
                  )}
                />
              </View>
            </View>

            {/* Country & Postal Code Row */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-600 mb-2">
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
                      placeholderTextColor="#94A3B8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-600 mb-2">
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
                      placeholderTextColor="#94A3B8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                    />
                  )}
                />
              </View>
            </View>

            {/* Tax ID */}
            <View className="mb-0">
              <Text className="text-sm font-medium text-slate-600 mb-2">
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
                    placeholderTextColor="#94A3B8"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                  />
                )}
              />
            </View>
          </View>

          {/* Credit Settings */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-4">
              Credit Settings
            </Text>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-600 mb-2">
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
                      placeholderTextColor="#94A3B8"
                      keyboardType="decimal-pad"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-600 mb-2">
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
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                    />
                  )}
                />
              </View>
            </View>
          </View>

          {/* Opening Balance */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-4">
              Opening Balance
            </Text>

            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-600 mb-2">
                Balance Type
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setValue("opening_balance_type", "receivable")}
                  className={`flex-1 p-3 rounded-xl border-2 items-center ${
                    selectedBalanceType === "receivable"
                      ? "border-green-500 bg-green-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <Ionicons
                    name="arrow-down-outline"
                    size={20}
                    color={
                      selectedBalanceType === "receivable"
                        ? "#10B981"
                        : "#94A3B8"
                    }
                  />
                  <Text
                    className={`text-sm font-medium mt-1 ${
                      selectedBalanceType === "receivable"
                        ? "text-green-600"
                        : "text-slate-500"
                    }`}
                  >
                    Receivable
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setValue("opening_balance_type", "payable")}
                  className={`flex-1 p-3 rounded-xl border-2 items-center ${
                    selectedBalanceType === "payable"
                      ? "border-red-500 bg-red-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <Ionicons
                    name="arrow-up-outline"
                    size={20}
                    color={
                      selectedBalanceType === "payable" ? "#EF4444" : "#94A3B8"
                    }
                  />
                  <Text
                    className={`text-sm font-medium mt-1 ${
                      selectedBalanceType === "payable"
                        ? "text-red-600"
                        : "text-slate-500"
                    }`}
                  >
                    Payable
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-slate-600 mb-2">
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
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base"
                  />
                )}
              />
            </View>
          </View>

          {/* Notes */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm">
            <Text className="text-base font-semibold text-slate-800 mb-4">
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
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 text-base min-h-[100px]"
                />
              )}
            />
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View className="absolute bottom-0 left-0 right-0 bg-white px-5 py-4 border-t border-slate-100">
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={createMutation.isPending || isSubmitting}
            className={`rounded-xl py-4 items-center ${
              createMutation.isPending || isSubmitting
                ? "bg-indigo-300"
                : "bg-indigo-600"
            }`}
          >
            {createMutation.isPending ? (
              <Text className="text-white font-semibold text-base">
                Creating...
              </Text>
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="add-circle-outline" size={22} color="white" />
                <Text className="text-white font-semibold text-base ml-2">
                  Create Party
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
