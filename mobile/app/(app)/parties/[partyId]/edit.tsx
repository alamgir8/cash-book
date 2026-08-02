import { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { toast } from "@/lib/toast";
import { useTheme } from "@/hooks/use-theme";
import { ScreenHeader } from "@/components/screen-header";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useKeyboardFooterLift } from "@/hooks/use-keyboard-footer-lift";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type PartyType } from "@/services/parties";
import { dalFetchParty, dalUpdateParty } from "@/data/parties";
import { getApiErrorMessage } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { safeGoBack } from "@/lib/navigation";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
  const { footerContainerStyle, scrollProps } = useKeyboardFooterLift();

  const goBack = () =>
    safeGoBack(`/(app)/parties/${partyId}`, router);

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

  const { data: party, isLoading } = useQuery({
    queryKey: ["party", partyId],
    queryFn: () => dalFetchParty(partyId!),
    enabled: !!partyId,
  });

  useEffect(() => {
    if (!party) return;
    reset({
      name: party.name,
      type: party.type,
      code: party.code || "",
      phone: party.phone || "",
      email: party.email || "",
      address: {
        street:
          typeof party.address === "object" ? party.address?.street || "" : "",
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
  }, [party, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof dalUpdateParty>[1]) =>
      dalUpdateParty(partyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parties });
      queryClient.invalidateQueries({ queryKey: ["party", partyId] });
      toast.success("Party updated successfully");
      goBack();
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
        ? parseInt(data.payment_terms_days, 10)
        : undefined,
      notes: data.notes || undefined,
    });
  };

  const partyTypes: {
    value: PartyType;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
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

  const inputStyle = (hasError?: boolean) => ({
    ...styles.input,
    backgroundColor: colors.bg.secondary,
    borderColor: hasError ? colors.error : colors.border,
    color: colors.text.primary,
  });

  const FieldLabel = ({
    children,
    required,
  }: {
    children: string;
    required?: boolean;
  }) => (
    <Text style={{ ...styles.label, color: colors.text.secondary }}>
      {children}
      {required ? <Text style={{ color: colors.error }}> *</Text> : null}
    </Text>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <ScreenHeader title="Edit Party" showBack onBack={goBack} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      </View>
    );
  }

  const busy = updateMutation.isPending || isSubmitting;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader title="Edit Party" showBack onBack={goBack} />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        {...scrollProps}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
          {/* Party type */}
          <View
            style={{
              ...styles.card,
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
            }}
          >
            <Text style={{ ...styles.sectionTitle, color: colors.text.primary }}>
              Party Type <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <View style={styles.typeRow}>
              {partyTypes.map((type) => {
                const selected = selectedType === type.value;
                return (
                  <TouchableOpacity
                    key={type.value}
                    onPress={() => setValue("type", type.value)}
                    style={{
                      ...styles.typeChip,
                      borderColor: selected ? colors.info : colors.border,
                      backgroundColor: selected
                        ? colors.info + "12"
                        : colors.bg.tertiary,
                    }}
                  >
                    <Ionicons
                      name={type.icon}
                      size={18}
                      color={selected ? type.color : colors.text.tertiary}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: selected ? colors.info : colors.text.secondary,
                      }}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Basic info */}
          <View
            style={{
              ...styles.card,
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
            }}
          >
            <Text style={{ ...styles.sectionTitle, color: colors.text.primary }}>
              Basic Information
            </Text>

            <FieldLabel required>Name</FieldLabel>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Enter party name"
                  placeholderTextColor={colors.text.tertiary}
                  style={inputStyle(!!errors.name)}
                />
              )}
            />
            {errors.name ? (
              <Text style={{ ...styles.error, color: colors.error }}>
                {errors.name.message}
              </Text>
            ) : null}

            <FieldLabel>Code</FieldLabel>
            <Controller
              control={control}
              name="code"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Optional code"
                  placeholderTextColor={colors.text.tertiary}
                  style={inputStyle()}
                />
              )}
            />

            <FieldLabel>Phone</FieldLabel>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Phone number"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="phone-pad"
                  style={inputStyle()}
                />
              )}
            />

            <FieldLabel>Email</FieldLabel>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Email address"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={inputStyle(!!errors.email)}
                />
              )}
            />
            {errors.email ? (
              <Text style={{ ...styles.error, color: colors.error }}>
                {errors.email.message}
              </Text>
            ) : null}
          </View>

          {/* Address */}
          <View
            style={{
              ...styles.card,
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
            }}
          >
            <Text style={{ ...styles.sectionTitle, color: colors.text.primary }}>
              Address & Tax
            </Text>

            <FieldLabel>Street Address</FieldLabel>
            <Controller
              control={control}
              name="address.street"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Street address"
                  placeholderTextColor={colors.text.tertiary}
                  style={inputStyle()}
                />
              )}
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <FieldLabel>City</FieldLabel>
                <Controller
                  control={control}
                  name="address.city"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="City"
                      placeholderTextColor={colors.text.tertiary}
                      style={inputStyle()}
                    />
                  )}
                />
              </View>
              <View style={styles.half}>
                <FieldLabel>State</FieldLabel>
                <Controller
                  control={control}
                  name="address.state"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="State"
                      placeholderTextColor={colors.text.tertiary}
                      style={inputStyle()}
                    />
                  )}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <FieldLabel>Country</FieldLabel>
                <Controller
                  control={control}
                  name="address.country"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Country"
                      placeholderTextColor={colors.text.tertiary}
                      style={inputStyle()}
                    />
                  )}
                />
              </View>
              <View style={styles.half}>
                <FieldLabel>Postal Code</FieldLabel>
                <Controller
                  control={control}
                  name="address.postal_code"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Postal"
                      placeholderTextColor={colors.text.tertiary}
                      style={inputStyle()}
                    />
                  )}
                />
              </View>
            </View>

            <FieldLabel>Tax ID / GST</FieldLabel>
            <Controller
              control={control}
              name="tax_id"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Tax ID or GST number"
                  placeholderTextColor={colors.text.tertiary}
                  style={inputStyle()}
                />
              )}
            />
          </View>

          {/* Credit */}
          <View
            style={{
              ...styles.card,
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
            }}
          >
            <Text style={{ ...styles.sectionTitle, color: colors.text.primary }}>
              Credit Settings
            </Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <FieldLabel>Credit Limit</FieldLabel>
                <Controller
                  control={control}
                  name="credit_limit"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="0"
                      placeholderTextColor={colors.text.tertiary}
                      keyboardType="decimal-pad"
                      style={inputStyle()}
                    />
                  )}
                />
              </View>
              <View style={styles.half}>
                <FieldLabel>Payment Terms (Days)</FieldLabel>
                <Controller
                  control={control}
                  name="payment_terms_days"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="30"
                      placeholderTextColor={colors.text.tertiary}
                      keyboardType="number-pad"
                      style={inputStyle()}
                    />
                  )}
                />
              </View>
            </View>
          </View>

          {/* Notes */}
          <View
            style={{
              ...styles.card,
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
              marginBottom: 0,
            }}
          >
            <Text style={{ ...styles.sectionTitle, color: colors.text.primary }}>
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
                  placeholder="Additional notes..."
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={{ ...inputStyle(), minHeight: 96, paddingTop: 12 }}
                />
              )}
            />
          </View>
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
          disabled={busy}
          activeOpacity={0.85}
          className="rounded-2xl py-4 items-center shadow-lg"
          style={{
            backgroundColor: colors.info,
            opacity: busy ? 0.7 : 1,
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text className="text-white font-bold text-base">
                Update Party
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    marginBottom: 10,
  },
  error: {
    fontSize: 12,
    marginTop: -6,
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  half: {
    flex: 1,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  submitBtn: {
    minHeight: 52,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
