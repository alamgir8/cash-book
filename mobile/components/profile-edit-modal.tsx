import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Toast from "react-native-toast-message";
import SearchableSelect, {
  type SelectOption,
} from "./searchable-select";
import { ActionButton } from "./action-button";
import { useAuth } from "../hooks/useAuth";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  currency: z.string().min(1, "Select a currency"),
  language: z.string().min(1, "Select a language"),
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
  currencyOptions.map((option) => [option.value, option.subtitle ?? "$"])
);

export function ProfileEditModal({ visible, onClose }: ProfileEditModalProps) {
  const { state, updateProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const currentProfile = state.status === "authenticated" ? state.user : null;

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
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: currentProfile?.name ?? "",
      email: currentProfile?.email ?? "",
      phone: currentProfile?.phone ?? "",
      currency: defaultCurrency,
      language: defaultLanguage,
    },
  });

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
      await updateProfile({
        name: values.name,
        email: values.email,
        phone: values.phone?.trim() ? values.phone.trim() : undefined,
        profile_settings: {
          currency_code: values.currency,
          currency_symbol: currencySymbolMap[values.currency] ?? "$",
          language: values.language,
        },
      });
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
            <TouchableOpacity onPress={handleClose} className="p-2">
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-900">Edit Profile</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
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
                        className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
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
                        className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
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
                        className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                      />
                    )}
                  />
                </View>
              </View>
            </View>

            <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
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

            <ActionButton
              label="Save changes"
              onPress={handleSubmit(handleSave)}
              isLoading={submitting}
              disabled={!isDirty && !submitting}
              icon="checkmark"
              variant="primary"
              size="large"
              fullWidth
            />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
