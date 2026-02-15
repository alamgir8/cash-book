import { useEffect, useState, useCallback } from "react";
import {
  Modal,
  Text,
  TextInput,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import {
  createCategory,
  updateCategory,
  type Category,
} from "../../services/categories";
import { queryKeys } from "../../lib/queryKeys";
import { ActionButton } from "../action-button";

type CategoryFormModalProps = {
  visible: boolean;
  onClose: () => void;
  category?: Category | null;
  initialFlow?: "credit" | "debit";
};

type FlowType = "credit" | "debit";

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#f43f5e", // rose
  "#64748b", // slate
];

const CREDIT_TYPES = [
  { label: "Income", value: "income" },
  { label: "Sales", value: "sell" },
  { label: "Loan Received", value: "loan_in" },
  { label: "Donation Received", value: "donation_in" },
  { label: "Adjustment (In)", value: "adjustment_in" },
  { label: "Other Income", value: "other_income" },
];

const DEBIT_TYPES = [
  { label: "Expense", value: "expense" },
  { label: "Purchase", value: "purchase" },
  { label: "Loan Given", value: "loan_out" },
  { label: "Donation Given", value: "donation_out" },
  { label: "Salary", value: "salary" },
  { label: "Adjustment (Out)", value: "adjustment_out" },
  { label: "Other Expense", value: "other_expense" },
];

const getTypesForFlow = (flow: FlowType) => {
  return flow === "credit" ? CREDIT_TYPES : DEBIT_TYPES;
};

const getDefaultTypeForFlow = (flow: FlowType) => {
  const types = getTypesForFlow(flow);
  return types[0]?.value || "";
};

export const CategoryFormModal = ({
  visible,
  onClose,
  category,
  initialFlow = "debit",
}: CategoryFormModalProps) => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const isEditing = !!category;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [flow, setFlow] = useState<FlowType>(initialFlow);
  const [type, setType] = useState(getDefaultTypeForFlow(initialFlow));
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setError(null);
      if (category) {
        setName(category.name);
        setDescription(category.description || "");
        setFlow(category.flow);
        setType(category.type);
        setColor(category.color || COLORS[0]);
      } else {
        setName("");
        setDescription("");
        setFlow(initialFlow);
        setType(getDefaultTypeForFlow(initialFlow));
        setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
      }
    }
  }, [visible, category, initialFlow]);

  // Stable flow change handler
  const handleFlowChange = useCallback((newFlow: FlowType) => {
    setFlow(newFlow);
    setType(getDefaultTypeForFlow(newFlow));
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEditing && category) {
        return updateCategory(category._id, {
          name,
          description,
          flow,
          type,
          color,
        });
      } else {
        return createCategory({
          name,
          description,
          flow,
          type,
          color,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || "Something went wrong");
    },
  });

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);
    mutation.mutate();
  }, [name, mutation]);

  // Get current types based on flow
  const currentTypes = getTypesForFlow(flow);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: colors.bg.primary },
            ]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View>
                <Text
                  style={[styles.headerTitle, { color: colors.text.primary }]}
                >
                  {isEditing ? "Edit Category" : "New Category"}
                </Text>
                <Text
                  style={[
                    styles.headerSubtitle,
                    { color: colors.text.secondary },
                  ]}
                >
                  {isEditing
                    ? "Update category details"
                    : "Create a new category"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.closeButton,
                  { backgroundColor: colors.bg.tertiary },
                ]}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.formContainer}>
                {/* Error Message */}
                {error && (
                  <View
                    style={[
                      styles.errorContainer,
                      {
                        backgroundColor: colors.error + "10",
                        borderColor: colors.error + "30",
                      },
                    ]}
                  >
                    <Ionicons
                      name="alert-circle"
                      size={20}
                      color={colors.error}
                    />
                    <Text style={[styles.errorText, { color: colors.error }]}>
                      {error}
                    </Text>
                    <TouchableOpacity onPress={() => setError(null)}>
                      <Ionicons name="close" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Flow Selection */}
                <View>
                  <Text style={[styles.label, { color: colors.text.primary }]}>
                    Category Flow
                  </Text>
                  <View
                    style={[
                      styles.flowContainer,
                      { backgroundColor: colors.bg.tertiary },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => handleFlowChange("credit")}
                      style={[
                        styles.flowButton,
                        flow === "credit" && {
                          ...styles.flowButtonActive,
                          backgroundColor: colors.bg.secondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.flowButtonText,
                          flow === "credit"
                            ? styles.flowButtonTextCredit
                            : styles.flowButtonTextInactive,
                        ]}
                      >
                        Income (Credit)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleFlowChange("debit")}
                      style={[
                        styles.flowButton,
                        flow === "debit" && styles.flowButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.flowButtonText,
                          flow === "debit"
                            ? styles.flowButtonTextDebit
                            : styles.flowButtonTextInactive,
                        ]}
                      >
                        Expense (Debit)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Name Input */}
                <View>
                  <Text style={[styles.label, { color: colors.text.primary }]}>
                    Category Name
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., Groceries"
                    placeholderTextColor={colors.text.tertiary}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bg.tertiary,
                        color: colors.text.primary,
                        borderColor: colors.border,
                      },
                    ]}
                  />
                </View>

                {/* Type Selection */}
                <View>
                  <Text style={[styles.label, { color: colors.text.primary }]}>
                    Category Type
                  </Text>
                  <View style={styles.typeContainer}>
                    {currentTypes.map((t) => (
                      <TouchableOpacity
                        key={t.value}
                        onPress={() => setType(t.value)}
                        style={[
                          styles.typeButton,
                          type === t.value
                            ? {
                                ...styles.typeButtonActive,
                                backgroundColor: colors.info + "15",
                                borderColor: colors.info + "40",
                              }
                            : {
                                ...styles.typeButtonInactive,
                                backgroundColor: colors.bg.tertiary,
                                borderColor: colors.border,
                              },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeButtonText,
                            type === t.value
                              ? {
                                  ...styles.typeButtonTextActive,
                                  color: colors.info,
                                }
                              : {
                                  ...styles.typeButtonTextInactive,
                                  color: colors.text.secondary,
                                },
                          ]}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Color Selection */}
                <View>
                  <Text style={[styles.label, { color: colors.text.primary }]}>
                    Color Tag
                  </Text>
                  <View style={styles.colorContainer}>
                    {COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setColor(c)}
                        style={[
                          styles.colorButton,
                          { backgroundColor: c },
                          color === c && {
                            ...styles.colorButtonActive,
                            borderColor: colors.text.primary,
                          },
                        ]}
                      >
                        {color === c && (
                          <Ionicons name="checkmark" size={20} color="white" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Description Input */}
                <View>
                  <Text style={[styles.label, { color: colors.text.primary }]}>
                    Description (Optional)
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Add a note..."
                    placeholderTextColor={colors.text.tertiary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: colors.bg.tertiary,
                        color: colors.text.primary,
                        borderColor: colors.border,
                      },
                    ]}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <ActionButton
                label={isEditing ? "Update Category" : "Create Category"}
                onPress={handleSubmit}
                disabled={mutation.isPending}
                isLoading={mutation.isPending}
                icon="checkmark-circle"
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
};

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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  headerSubtitle: {
    fontSize: 14,
  },
  closeButton: {
    width: 32,
    height: 32,
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
  errorContainer: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  flowContainer: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
  },
  flowButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  flowButtonActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  flowButtonText: {
    fontWeight: "600",
  },
  flowButtonTextCredit: {
    color: "#16a34a",
  },
  flowButtonTextDebit: {
    color: "#dc2626",
  },
  flowButtonTextInactive: {
    color: "#6b7280",
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  typeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeButtonActive: {},
  typeButtonInactive: {},
  typeButtonText: {
    fontSize: 14,
  },
  typeButtonTextActive: {},
  typeButtonTextInactive: {},
  colorContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  colorButtonActive: {
    borderWidth: 2,
  },
  textArea: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 96,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
});
