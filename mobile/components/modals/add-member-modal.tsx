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
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
const memberSchema = z
  .object({
    display_name: z.string().min(2, "Name must be at least 2 characters"),
    email: z
      .string()
      .email("Invalid email address")
      .optional()
      .or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    role: z.enum(["manager", "cashier", "viewer"]),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone number is required",
    path: ["email"],
  });

type MemberFormData = z.infer<typeof memberSchema>;

interface AddMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    email?: string;
    phone?: string;
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
      role: "cashier",
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFormSubmit = (data: MemberFormData) => {
    onSubmit({
      display_name: data.display_name.trim(),
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
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
        style={styles.keyboardView}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Add Team Member</Text>
                <Text style={styles.headerSubtitle}>
                  Invite someone to join your organization
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.formContainer}>
                {/* Display Name */}
                <View>
                  <Text style={styles.label}>Display Name *</Text>
                  <Controller
                    control={control}
                    name="display_name"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={[
                          styles.input,
                          errors.display_name && styles.inputError,
                        ]}
                        placeholder="Member's full name"
                        placeholderTextColor="#9ca3af"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                    )}
                  />
                  {errors.display_name && (
                    <Text style={styles.errorText}>
                      {errors.display_name.message}
                    </Text>
                  )}
                </View>

                {/* Email Address */}
                <View>
                  <Text style={styles.label}>Email Address</Text>
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={[
                          styles.input,
                          errors.email && styles.inputError,
                        ]}
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
                    <Text style={styles.errorText}>{errors.email.message}</Text>
                  )}
                </View>

                <Text style={styles.orText}>or</Text>

                {/* Phone Number */}
                <View>
                  <Text style={styles.label}>Phone Number</Text>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={styles.input}
                        placeholder="+1 234 567 8900"
                        placeholderTextColor="#9ca3af"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="phone-pad"
                      />
                    )}
                  />
                </View>

                {/* Role Selection */}
                <View>
                  <Text style={styles.label}>Role *</Text>
                  <Controller
                    control={control}
                    name="role"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.roleContainer}>
                        {ROLES.map((role) => (
                          <TouchableOpacity
                            key={role.value}
                            style={[
                              styles.roleButton,
                              value === role.value
                                ? styles.roleButtonActive
                                : styles.roleButtonInactive,
                            ]}
                            onPress={() => onChange(role.value)}
                          >
                            <Text
                              style={[
                                styles.roleButtonTitle,
                                value === role.value
                                  ? styles.roleButtonTitleActive
                                  : styles.roleButtonTitleInactive,
                              ]}
                            >
                              {role.label}
                            </Text>
                            <Text
                              style={[
                                styles.roleButtonDescription,
                                value === role.value
                                  ? styles.roleButtonDescriptionActive
                                  : styles.roleButtonDescriptionInactive,
                              ]}
                            >
                              {role.description}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>

                <View style={styles.infoBox}>
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color="#3b82f6"
                  />
                  <Text style={styles.infoText}>
                    The user must already have an account. They will receive an
                    invitation to join this organization.
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isLoading && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit(handleFormSubmit)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={20} color="white" />
                    <Text style={styles.submitButtonText}>Add Member</Text>
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

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#6b7280",
    fontSize: 14,
  },
  closeButton: {
    width: 32,
    height: 32,
    backgroundColor: "#f3f4f6",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  formContainer: {
    gap: 20,
  },
  label: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f9fafb",
    color: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    fontSize: 16,
  },
  inputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  orText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 14,
  },
  roleContainer: {
    gap: 12,
  },
  roleButton: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleButtonActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  roleButtonInactive: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },
  roleButtonTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  roleButtonTitleActive: {
    color: "#1e40af",
  },
  roleButtonTitleInactive: {
    color: "#374151",
  },
  roleButtonDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  roleButtonDescriptionActive: {
    color: "#3b82f6",
  },
  roleButtonDescriptionInactive: {
    color: "#6b7280",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: "#1e40af",
    fontSize: 12,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  submitButton: {
    backgroundColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
