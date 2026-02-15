import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PasswordInput } from "../password-input";

const ROLES = [
  {
    value: "manager",
    label: "Manager",
    description: "Manage members, transactions, categories, and view reports",
  },
  {
    value: "cashier",
    label: "Cashier",
    description: "Create transactions and view reports",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access",
  },
];

// Zod validation schema
const memberSchema = z.object({
  display_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["manager", "cashier", "viewer"]),
});

type MemberFormData = z.infer<typeof memberSchema>;

interface AddMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    email: string;
    phone: string;
    password: string;
    role: string;
    display_name: string;
  }) => void;
  isLoading?: boolean;
}

export function AddMemberModal({
  visible,
  onClose,
  onSubmit,
  isLoading = false,
}: AddMemberModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      display_name: "",
      email: "",
      phone: "",
      password: "",
      role: "cashier",
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFormSubmit = (data: MemberFormData) => {
    const trimmedEmail = data.email.trim();
    const trimmedPhone = data.phone.trim();

    onSubmit({
      display_name: data.display_name.trim(),
      email: trimmedEmail,
      phone: trimmedPhone,
      password: data.password,
      role: data.role,
    });
    reset();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl flex-1 max-h-[90%]">
            <View className="flex-row justify-between items-center p-6 pb-4 border-b border-gray-100">
              <View>
                <Text className="text-gray-900 text-xl font-bold">
                  Add Team Member
                </Text>
                <Text className="text-gray-500 text-sm">
                  Invite someone to join your organization
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 px-6 py-4"
              showsVerticalScrollIndicator={false}
              contentContainerClassName="pb-5"
            >
              <View className="gap-5">
                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Display Name *
                  </Text>
                  <Controller
                    control={control}
                    name="display_name"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className={`bg-gray-50 text-gray-900 border rounded-xl px-4 py-3 ${
                          errors.display_name
                            ? "border-red-500"
                            : "border-gray-200"
                        }`}
                        placeholder="Member's full name"
                        placeholderTextColor="#9ca3af"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                    )}
                  />
                  {errors.display_name && (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.display_name.message}
                    </Text>
                  )}
                </View>

                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Email Address <Text className="text-red-500">*</Text>
                  </Text>
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className={`bg-gray-50 text-gray-900 border rounded-xl px-4 py-3 ${
                          errors.email ? "border-red-500" : "border-gray-200"
                        }`}
                        placeholder="member@example.com"
                        placeholderTextColor="#9ca3af"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    )}
                  />
                  {errors.email && (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.email.message}
                    </Text>
                  )}
                </View>

                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Phone Number <Text className="text-red-500">*</Text>
                  </Text>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className={`bg-gray-50 text-gray-900 border rounded-xl px-4 py-3 ${
                          errors.phone ? "border-red-500" : "border-gray-200"
                        }`}
                        placeholder="+1 234 567 8900"
                        placeholderTextColor="#9ca3af"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="phone-pad"
                      />
                    )}
                  />
                  {errors.phone && (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.phone.message}
                    </Text>
                  )}
                </View>

                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Password *
                  </Text>
                  <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <PasswordInput
                        label=""
                        value={value}
                        onChangeText={onChange}
                        placeholder="Minimum 6 characters"
                        error={errors.password?.message}
                        containerClassName="gap-0"
                        labelClassName="hidden"
                      />
                    )}
                  />
                </View>

                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Role *
                  </Text>
                  <Controller
                    control={control}
                    name="role"
                    render={({ field: { onChange, value } }) => (
                      <View className="gap-3">
                        {ROLES.map((role) => (
                          <TouchableOpacity
                            key={role.value}
                            className={`p-3 rounded-xl border ${
                              value === role.value
                                ? "bg-blue-50 border-blue-500"
                                : "bg-gray-50 border-gray-200"
                            }`}
                            onPress={() => onChange(role.value)}
                          >
                            <Text
                              className={`text-base font-semibold ${
                                value === role.value
                                  ? "text-blue-900"
                                  : "text-gray-700"
                              }`}
                            >
                              {role.label}
                            </Text>
                            <Text
                              className={`text-sm mt-1 ${
                                value === role.value
                                  ? "text-blue-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {role.description}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>

                <View className="flex-row bg-blue-50 p-3 rounded-xl gap-2">
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color="#3b82f6"
                  />
                  <Text className="flex-1 text-blue-900 text-xs">
                    A new user account will be created. The member can log in
                    immediately with the provided email/phone and password.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View className="p-6 pt-4 pb-8 border-t border-gray-100">
              <TouchableOpacity
                className={`bg-blue-500 flex-row items-center justify-center py-3.5 rounded-xl gap-2 ${
                  isLoading ? "opacity-60" : ""
                }`}
                onPress={handleSubmit(handleFormSubmit)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={20} color="white" />
                    <Text className="text-white text-base font-semibold">
                      Add Member
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
