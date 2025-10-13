import { useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Toast from "react-native-toast-message";
import { ActionButton } from "./action-button";

// Profile edit schema
const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  currency: z.string().min(1, "Currency is required"),
  language: z.string().min(1, "Language is required"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: ProfileFormData) => Promise<void>;
  currentProfile: {
    name: string;
    email: string;
    phone?: string;
    currency?: string;
    language?: string;
  };
}

// Currency options
const currencies = [
  { label: "US Dollar ($)", value: "USD", symbol: "$" },
  { label: "Euro (€)", value: "EUR", symbol: "€" },
  { label: "British Pound (£)", value: "GBP", symbol: "£" },
  { label: "Japanese Yen (¥)", value: "JPY", symbol: "¥" },
  { label: "Canadian Dollar (C$)", value: "CAD", symbol: "C$" },
  { label: "Australian Dollar (A$)", value: "AUD", symbol: "A$" },
  { label: "Swiss Franc (CHF)", value: "CHF", symbol: "CHF" },
  { label: "Chinese Yuan (¥)", value: "CNY", symbol: "¥" },
  { label: "Indian Rupee (₹)", value: "INR", symbol: "₹" },
  { label: "Bangladesh Taka (৳)", value: "BDT", symbol: "৳" },
];

// Language options
const languages = [
  { label: "English", value: "en", flag: "🇺🇸" },
  { label: "Spanish", value: "es", flag: "🇪🇸" },
  { label: "French", value: "fr", flag: "🇫🇷" },
  { label: "German", value: "de", flag: "🇩🇪" },
  { label: "Italian", value: "it", flag: "🇮🇹" },
  { label: "Portuguese", value: "pt", flag: "🇵🇹" },
  { label: "Russian", value: "ru", flag: "🇷🇺" },
  { label: "Chinese", value: "zh", flag: "🇨🇳" },
  { label: "Japanese", value: "ja", flag: "🇯🇵" },
  { label: "Arabic", value: "ar", flag: "🇸🇦" },
  { label: "Hindi", value: "hi", flag: "🇮🇳" },
  { label: "Bengali", value: "bn", flag: "🇧🇩" },
];

export function ProfileEditModal({
  visible,
  onClose,
  onSave,
  currentProfile,
}: ProfileEditModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: currentProfile.name,
      email: currentProfile.email,
      phone: currentProfile.phone || "",
      currency: currentProfile.currency || "USD",
      language: currentProfile.language || "en",
    },
  });

  const selectedCurrency = watch("currency");
  const selectedLanguage = watch("language");

  const handleSave = async (data: ProfileFormData) => {
    try {
      setIsLoading(true);
      await onSave(data);
      Toast.show({
        type: "success",
        text1: "Profile updated successfully",
      });
      onClose();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Failed to update profile",
        text2: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrencyLabel = (value: string) => {
    const currency = currencies.find((c) => c.value === value);
    return currency ? currency.label : value;
  };

  const getLanguageLabel = (value: string) => {
    const language = languages.find((l) => l.value === value);
    return language ? `${language.flag} ${language.label}` : value;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-gray-50"
      >
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-4 pt-16">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-900">
              Edit Profile
            </Text>
            <View className="w-10" />
          </View>
        </View>

        <ScrollView className="flex-1 px-4 py-6">
          {/* Profile Information */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-gray-900 mb-4">
              Personal Information
            </Text>

            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-semibold mb-2">
                Full Name
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Enter your full name"
                    className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                  />
                )}
              />
              {errors.name && (
                <Text className="text-red-500 text-sm mt-1">
                  {errors.name.message}
                </Text>
              )}
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-semibold mb-2">
                Email Address
              </Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Enter your email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                  />
                )}
              />
              {errors.email && (
                <Text className="text-red-500 text-sm mt-1">
                  {errors.email.message}
                </Text>
              )}
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-semibold mb-2">
                Phone Number (Optional)
              </Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Enter your phone number"
                    keyboardType="phone-pad"
                    className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                  />
                )}
              />
            </View>
          </View>

          {/* App Preferences */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-gray-900 mb-4">
              App Preferences
            </Text>

            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-semibold mb-2">
                Default Currency
              </Text>
              <TouchableOpacity
                onPress={() => setShowCurrencyPicker(true)}
                className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 flex-row items-center justify-between"
              >
                <Text className="text-gray-900">
                  {getCurrencyLabel(selectedCurrency)}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-semibold mb-2">
                Language
              </Text>
              <TouchableOpacity
                onPress={() => setShowLanguagePicker(true)}
                className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 flex-row items-center justify-between"
              >
                <Text className="text-gray-900">
                  {getLanguageLabel(selectedLanguage)}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <ActionButton
            label="Save Changes"
            onPress={handleSubmit(handleSave)}
            isLoading={isLoading}
            variant="primary"
            size="large"
            icon="checkmark"
            fullWidth
          />
        </ScrollView>

        {/* Currency Picker Modal */}
        <Modal
          visible={showCurrencyPicker}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View className="flex-1 bg-white">
            <View className="border-b border-gray-200 px-4 py-4 pt-16">
              <View className="flex-row items-center justify-between">
                <TouchableOpacity onPress={() => setShowCurrencyPicker(false)}>
                  <Text className="text-blue-600 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <Text className="text-lg font-bold">Select Currency</Text>
                <View className="w-12" />
              </View>
            </View>
            <ScrollView className="flex-1">
              {currencies.map((currency) => (
                <TouchableOpacity
                  key={currency.value}
                  onPress={() => {
                    setValue("currency", currency.value);
                    setShowCurrencyPicker(false);
                  }}
                  className="px-4 py-4 border-b border-gray-100 flex-row items-center justify-between"
                >
                  <Text className="text-gray-900 text-base">
                    {currency.label}
                  </Text>
                  {selectedCurrency === currency.value && (
                    <Ionicons name="checkmark" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Language Picker Modal */}
        <Modal
          visible={showLanguagePicker}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View className="flex-1 bg-white">
            <View className="border-b border-gray-200 px-4 py-4 pt-16">
              <View className="flex-row items-center justify-between">
                <TouchableOpacity onPress={() => setShowLanguagePicker(false)}>
                  <Text className="text-blue-600 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <Text className="text-lg font-bold">Select Language</Text>
                <View className="w-12" />
              </View>
            </View>
            <ScrollView className="flex-1">
              {languages.map((language) => (
                <TouchableOpacity
                  key={language.value}
                  onPress={() => {
                    setValue("language", language.value);
                    setShowLanguagePicker(false);
                  }}
                  className="px-4 py-4 border-b border-gray-100 flex-row items-center justify-between"
                >
                  <Text className="text-gray-900 text-base">
                    {language.flag} {language.label}
                  </Text>
                  {selectedLanguage === language.value && (
                    <Ionicons name="checkmark" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}
