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
import { useTheme } from "@/hooks/useTheme";

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
  const { colors } = useTheme();
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
          <View
            className="rounded-t-3xl flex-1 max-h-[90%]"
            style={{ backgroundColor: colors.bg.primary }}
          >
            <View
              className="flex-row justify-between items-center p-6 pb-4 border-b"
              style={{ borderColor: colors.border }}
            >
              <View>
                <Text
                  className="text-xl font-bold"
                  style={{ color: colors.text.primary }}
                >
                  Add Team Member
                </Text>
                <Text
                  className="text-sm"
                  style={{ color: colors.text.secondary }}
                >
                  Invite someone to join your organization
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.bg.tertiary }}
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
              contentContainerClassName="pb-5"
            >
              <View className="gap-5">
                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    Display Name *
                  </Text>
                  <Controller
                    control={control}
                    name="display_name"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="border rounded-xl px-4 py-3"
                        style={{
                          backgroundColor: colors.bg.tertiary,
                          color: colors.text.primary,
                          borderColor: errors.display_name
                            ? colors.error
                            : colors.border,
                        }}
                        placeholder="Member's full name"
                        placeholderTextColor={colors.text.tertiary}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                    )}
                  />
                  {errors.display_name && (
                    <Text
                      className="text-xs mt-1"
                      style={{ color: colors.error }}
                    >
                      {errors.display_name.message}
                    </Text>
                  )}
                </View>

                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    Email Address <Text style={{ color: colors.error }}>*</Text>
                  </Text>
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="border rounded-xl px-4 py-3"
                        style={{
                          backgroundColor: colors.bg.tertiary,
                          color: colors.text.primary,
                          borderColor: errors.email
                            ? colors.error
                            : colors.border,
                        }}
                        placeholder="member@example.com"
                        placeholderTextColor={colors.text.tertiary}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    )}
                  />
                  {errors.email && (
                    <Text
                      className="text-xs mt-1"
                      style={{ color: colors.error }}
                    >
                      {errors.email.message}
                    </Text>
                  )}
                </View>

                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    Phone Number <Text style={{ color: colors.error }}>*</Text>
                  </Text>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="border rounded-xl px-4 py-3"
                        style={{
                          backgroundColor: colors.bg.tertiary,
                          color: colors.text.primary,
                          borderColor: errors.phone
                            ? colors.error
                            : colors.border,
                        }}
                        placeholder="+1 234 567 8900"
                        placeholderTextColor={colors.text.tertiary}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="phone-pad"
                      />
                    )}
                  />
                  {errors.phone && (
                    <Text
                      className="text-xs mt-1"
                      style={{ color: colors.error }}
                    >
                      {errors.phone.message}
                    </Text>
                  )}
                </View>

                <View>
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
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
                  <Text
                    className="text-sm font-semibold mb-2"
                    style={{ color: colors.text.primary }}
                  >
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
                            className="p-3 rounded-xl border"
                            style={{
                              backgroundColor:
                                value === role.value
                                  ? colors.info + "15"
                                  : colors.bg.tertiary,
                              borderColor:
                                value === role.value
                                  ? colors.info
                                  : colors.border,
                            }}
                            onPress={() => onChange(role.value)}
                          >
                            <Text
                              className="text-base font-semibold"
                              style={{
                                color:
                                  value === role.value
                                    ? colors.info
                                    : colors.text.primary,
                              }}
                            >
                              {role.label}
                            </Text>
                            <Text
                              className="text-sm mt-1"
                              style={{
                                color:
                                  value === role.value
                                    ? colors.info
                                    : colors.text.secondary,
                              }}
                            >
                              {role.description}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>

                <View
                  className="flex-row p-3 rounded-xl gap-2"
                  style={{ backgroundColor: colors.info + "15" }}
                >
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={colors.info}
                  />
                  <Text
                    className="flex-1 text-xs"
                    style={{ color: colors.text.primary }}
                  >
                    A new user account will be created. The member can log in
                    immediately with the provided email/phone and password.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View
              className="p-6 pt-4 pb-8 border-t"
              style={{ borderColor: colors.border }}
            >
              <TouchableOpacity
                className={`flex-row items-center justify-center py-3.5 rounded-xl gap-2 ${
                  isLoading ? "opacity-60" : ""
                }`}
                style={{ backgroundColor: colors.info }}
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
