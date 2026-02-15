import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Toast from "react-native-toast-message";
import SearchableSelect, { type SelectOption } from "./searchable-select";
import { PasswordInput } from "./password-input";
import { ActionButton } from "./action-button";
import { useAuth } from "../hooks/useAuth";

const pinValueSchema = z
  .union([
    z.string().regex(/^[0-9]{5}$/, "PIN must be 5 digits"),
    z.literal(""),
    z.null(),
  ])
  .optional();

const profileSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    currency: z.string().min(1, "Select a currency"),
    language: z.string().min(1, "Select a language"),
    enablePin: z.boolean(),
    loginPin: pinValueSchema,
    confirmPin: pinValueSchema,
    hasExistingPin: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const pinProvided =
      typeof data.loginPin === "string" && data.loginPin.trim() !== "";
    const confirmProvided =
      typeof data.confirmPin === "string" && data.confirmPin.trim() !== "";

    if (data.enablePin) {
      if (!data.hasExistingPin && !pinProvided) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a 5-digit PIN",
          path: ["loginPin"],
        });
      }

      if (pinProvided !== confirmProvided) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Confirm your PIN",
          path: pinProvided ? ["confirmPin"] : ["loginPin"],
        });
      }

      if (pinProvided && confirmProvided && data.loginPin !== data.confirmPin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PINs do not match",
          path: ["confirmPin"],
        });
      }
    }
  });

type ProfileFormData = z.infer<typeof profileSchema>;

type ProfileEditModalProps = {
  visible: boolean;
  onClose: () => void;
};

const currencyOptions: SelectOption[] = [
  { label: "US Dollar ($)", value: "USD", subtitle: "$" },
  { label: "Euro (€)", value: "EUR", subtitle: "€" },
  { label: "British Pound (£)", value: "GBP", subtitle: "£" },
  { label: "Japanese Yen (¥)", value: "JPY", subtitle: "¥" },
  { label: "Canadian Dollar (C$)", value: "CAD", subtitle: "C$" },
  { label: "Australian Dollar (A$)", value: "AUD", subtitle: "A$" },
  { label: "Swiss Franc (CHF)", value: "CHF", subtitle: "CHF" },
  { label: "Chinese Yuan (¥)", value: "CNY", subtitle: "¥" },
  { label: "Indian Rupee (₹)", value: "INR", subtitle: "₹" },
  { label: "Bangladeshi Taka (৳)", value: "BDT", subtitle: "৳" },
  { label: "Saudi Riyal (﷼)", value: "SAR", subtitle: "﷼" },
  { label: "UAE Dirham (د.إ)", value: "AED", subtitle: "د.إ" },
];

const languageOptions: SelectOption[] = [
  { label: "🇺🇸 English", value: "en" },
  { label: "🇪🇸 Spanish", value: "es" },
  { label: "🇫🇷 French", value: "fr" },
  { label: "🇩🇪 German", value: "de" },
  { label: "🇮🇹 Italian", value: "it" },
  { label: "🇵🇹 Portuguese", value: "pt" },
  { label: "🇷🇺 Russian", value: "ru" },
  { label: "🇨🇳 Chinese", value: "zh" },
  { label: "🇯🇵 Japanese", value: "ja" },
  { label: "🇸🇦 Arabic", value: "ar" },
  { label: "🇮🇳 Hindi", value: "hi" },
  { label: "🇧🇩 Bengali", value: "bn" },
];

const currencySymbolMap = Object.fromEntries(
  currencyOptions.map((option) => [option.value, option.subtitle ?? "$"]),
);

export function ProfileEditModal({ visible, onClose }: ProfileEditModalProps) {
  const { state, updateProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const currentProfile = state.status === "authenticated" ? state.user : null;
  const hasExistingPin = currentProfile?.security?.has_login_pin ?? false;

  const defaultCurrency =
    currentProfile?.profile_settings?.currency_code ??
    currentProfile?.settings?.currency ??
    "USD";
  const defaultLanguage =
    currentProfile?.profile_settings?.language ??
    currentProfile?.settings?.language ??
    "en";

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: currentProfile?.name ?? "",
      email: currentProfile?.email ?? "",
      phone: currentProfile?.phone ?? "",
      currency: defaultCurrency,
      language: defaultLanguage,
      enablePin: hasExistingPin,
      loginPin: "",
      confirmPin: "",
      hasExistingPin,
    },
  });

  const enablePin = watch("enablePin");

  useEffect(() => {
    if (!currentProfile) return;
    reset({
      name: currentProfile.name ?? "",
      email: currentProfile.email ?? "",
      phone: currentProfile.phone ?? "",
      currency:
        currentProfile.profile_settings?.currency_code ??
        currentProfile.settings?.currency ??
        "USD",
      language:
        currentProfile.profile_settings?.language ??
        currentProfile.settings?.language ??
        "en",
      enablePin: currentProfile.security?.has_login_pin ?? false,
      loginPin: "",
      confirmPin: "",
      hasExistingPin: currentProfile.security?.has_login_pin ?? false,
    });
  }, [currentProfile, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async (values: ProfileFormData) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone?.trim() ? values.phone.trim() : undefined,
        profile_settings: {
          currency_code: values.currency,
          currency_symbol: currencySymbolMap[values.currency] ?? "$",
          language: values.language,
        },
      } as Parameters<typeof updateProfile>[0];

      if (values.enablePin) {
        const pinValue =
          typeof values.loginPin === "string" ? values.loginPin.trim() : "";
        if (pinValue) {
          payload.login_pin = pinValue;
        }
      } else if (values.hasExistingPin) {
        payload.login_pin = "";
      }

      await updateProfile(payload);
      Toast.show({
        type: "success",
        text1: "Profile updated",
      });
      handleClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update profile. Try again.";
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View
            className="bg-white rounded-t-3xl flex-1"
            style={{ maxHeight: "92%" }}
          >
            {/* Header */}
            <View className="flex-row justify-between items-center p-6 pb-4 border-b border-gray-100">
              <View>
                <Text className="text-gray-900 text-xl font-bold">
                  Edit Profile
                </Text>
                <Text className="text-gray-500 text-sm">
                  Update your profile information
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Form Content */}
            <ScrollView
              className="flex-1 px-6"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View className="gap-5 py-4">
                {/* Personal Information Section */}
                <View className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                  <Text className="text-base font-semibold text-gray-900 mb-3">
                    Personal Information
                  </Text>

                  <View className="gap-4">
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">
                        Full name
                      </Text>
                      <Controller
                        control={control}
                        name="name"
                        render={({ field: { value, onChange } }) => (
                          <TextInput
                            value={value}
                            onChangeText={onChange}
                            placeholder="Your name"
                            placeholderTextColor="#9ca3af"
                            className="bg-white text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                          />
                        )}
                      />
                      {errors.name ? (
                        <Text className="text-sm text-red-500 mt-1">
                          {errors.name.message}
                        </Text>
                      ) : null}
                    </View>

                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">
                        Email
                      </Text>
                      <Controller
                        control={control}
                        name="email"
                        render={({ field: { value, onChange } }) => (
                          <TextInput
                            value={value}
                            onChangeText={onChange}
                            placeholder="you@example.com"
                            placeholderTextColor="#9ca3af"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            className="bg-white text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                          />
                        )}
                      />
                      {errors.email ? (
                        <Text className="text-sm text-red-500 mt-1">
                          {errors.email.message}
                        </Text>
                      ) : null}
                    </View>

                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-2">
                        Phone (optional)
                      </Text>
                      <Controller
                        control={control}
                        name="phone"
                        render={({ field: { value, onChange } }) => (
                          <TextInput
                            value={value ?? ""}
                            onChangeText={onChange}
                            placeholder="Phone number"
                            placeholderTextColor="#9ca3af"
                            keyboardType="phone-pad"
                            className="bg-white text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                          />
                        )}
                      />
                    </View>
                  </View>
                </View>

                {/* Security Section */}
                <View className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-base font-semibold text-gray-900">
                      Security
                    </Text>
                    <Controller
                      control={control}
                      name="enablePin"
                      render={({ field: { value, onChange } }) => (
                        <Switch
                          value={value}
                          onValueChange={(next) => {
                            onChange(next);
                            if (!next) {
                              setValue("loginPin", "");
                              setValue("confirmPin", "");
                            }
                          }}
                          trackColor={{ false: "#d1d5db", true: "#2563eb" }}
                          thumbColor="#ffffff"
                        />
                      )}
                    />
                  </View>
                  <Text className="text-xs text-gray-500 mb-4">
                    {enablePin
                      ? "Enter a new 5-digit PIN to enable quick logins."
                      : hasExistingPin
                        ? "Your login PIN will be removed when you save changes."
                        : "Enable a 5-digit PIN to sign in without your password."}
                  </Text>
                  {enablePin ? (
                    <View className="gap-4">
                      <Controller
                        control={control}
                        name="loginPin"
                        render={({ field: { value, onChange } }) => (
                          <PasswordInput
                            label="New PIN"
                            value={value ?? ""}
                            onChangeText={onChange}
                            placeholder="12345"
                            keyboardType="number-pad"
                            maxLength={5}
                            error={errors.loginPin?.message}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="confirmPin"
                        render={({ field: { value, onChange } }) => (
                          <PasswordInput
                            label="Confirm PIN"
                            value={value ?? ""}
                            onChangeText={onChange}
                            placeholder="12345"
                            keyboardType="number-pad"
                            maxLength={5}
                            error={errors.confirmPin?.message}
                          />
                        )}
                      />
                    </View>
                  ) : null}
                </View>

                {/* Preferences Section */}
                <View className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                  <Text className="text-base font-semibold text-gray-900 mb-3">
                    Preferences
                  </Text>

                  <View className="gap-4">
                    <Controller
                      control={control}
                      name="currency"
                      render={({ field: { value, onChange } }) => (
                        <SearchableSelect
                          label="Currency"
                          placeholder="Select currency"
                          value={value}
                          options={currencyOptions}
                          onSelect={(val) => onChange(val)}
                        />
                      )}
                    />
                    {errors.currency ? (
                      <Text className="text-sm text-red-500">
                        {errors.currency.message}
                      </Text>
                    ) : null}

                    <Controller
                      control={control}
                      name="language"
                      render={({ field: { value, onChange } }) => (
                        <SearchableSelect
                          label="Language"
                          placeholder="Select language"
                          value={value}
                          options={languageOptions}
                          onSelect={(val) => onChange(val)}
                        />
                      )}
                    />
                    {errors.language ? (
                      <Text className="text-sm text-red-500">
                        {errors.language.message}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Submit Button - Fixed at bottom */}
            <View className="p-6 pb-8 bg-white border-t border-gray-100">
              <ActionButton
                label="Save changes"
                onPress={handleSubmit(handleSave)}
                isLoading={submitting}
                disabled={!isDirty && !submitting}
                icon="checkmark"
                variant="primary"
                size="medium"
                fullWidth
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
