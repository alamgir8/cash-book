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
import {
  createCategory,
  updateCategory,
  type Category,
} from "../services/categories";
import { queryKeys } from "../lib/queryKeys";
import { ActionButton } from "./action-button";

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
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>
                  {isEditing ? "Edit Category" : "New Category"}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {isEditing
                    ? "Update category details"
                    : "Create a new category"}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={20} color="#6b7280" />
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
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#dc2626" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={() => setError(null)}>
                      <Ionicons name="close" size={18} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Flow Selection */}
                <View>
                  <Text style={styles.label}>Category Flow</Text>
                  <View style={styles.flowContainer}>
                    <TouchableOpacity
                      onPress={() => handleFlowChange("credit")}
                      style={[
                        styles.flowButton,
                        flow === "credit" && styles.flowButtonActive,
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
                  <Text style={styles.label}>Category Name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., Groceries"
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                  />
                </View>

                {/* Type Selection */}
                <View>
                  <Text style={styles.label}>Category Type</Text>
                  <View style={styles.typeContainer}>
                    {currentTypes.map((t) => (
                      <TouchableOpacity
                        key={t.value}
                        onPress={() => setType(t.value)}
                        style={[
                          styles.typeButton,
                          type === t.value
                            ? styles.typeButtonActive
                            : styles.typeButtonInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeButtonText,
                            type === t.value
                              ? styles.typeButtonTextActive
                              : styles.typeButtonTextInactive,
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
                  <Text style={styles.label}>Color Tag</Text>
                  <View style={styles.colorContainer}>
                    {COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setColor(c)}
                        style={[
                          styles.colorButton,
                          { backgroundColor: c },
                          color === c && styles.colorButtonActive,
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
                  <Text style={styles.label}>Description (Optional)</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Add a note..."
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={styles.textArea}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
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
  errorContainer: {
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    flex: 1,
  },
  label: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  flowContainer: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
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
    backgroundColor: "white",
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
    backgroundColor: "#f9fafb",
    color: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
  typeButtonActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  typeButtonInactive: {
    backgroundColor: "white",
    borderColor: "#e5e7eb",
  },
  typeButtonText: {
    fontSize: 14,
  },
  typeButtonTextActive: {
    color: "#1d4ed8",
  },
  typeButtonTextInactive: {
    color: "#4b5563",
  },
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
    borderColor: "#9ca3af",
  },
  textArea: {
    backgroundColor: "#f9fafb",
    color: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minHeight: 96,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
});
