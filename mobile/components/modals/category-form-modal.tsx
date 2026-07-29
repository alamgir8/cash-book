import { useEffect, useState, useCallback } from "react";
import {
  Text,
  TextInput,
  View,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { FormSheetModal } from "@/components/form-sheet-modal";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/use-theme";
import {
  createCategory,
  updateCategory,
  type Category,
} from "../../services/categories";
import { queryKeys } from "../../lib/queryKeys";

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
    <FormSheetModal
      visible={visible}
      onClose={onClose}
      title={isEditing ? "Edit Category" : "New Category"}
      subtitle={
        isEditing ? "Update category details" : "Create a new category"
      }
      submitLabel={isEditing ? "Save Changes" : "Create Category"}
      submitIcon={isEditing ? "checkmark-circle" : "add-circle"}
      onSubmit={handleSubmit}
      isSubmitting={mutation.isPending}
      submittingLabel="Saving…"
    >
      <View className="gap-5">
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
                    {
                      backgroundColor: colors.bg.tertiary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => handleFlowChange("credit")}
                    activeOpacity={0.8}
                    style={[
                      styles.flowButton,
                      flow === "credit"
                        ? styles.flowButtonActiveCredit
                        : { backgroundColor: "transparent" },
                    ]}
                  >
                    <Ionicons
                      name="arrow-down-circle"
                      size={18}
                      color={flow === "credit" ? "#fff" : colors.text.tertiary}
                    />
                    <View>
                      <Text
                        style={[
                          styles.flowButtonLabel,
                          {
                            color:
                              flow === "credit"
                                ? "#fff"
                                : colors.text.secondary,
                          },
                        ]}
                      >
                        Income
                      </Text>
                      <Text
                        style={[
                          styles.flowButtonSub,
                          {
                            color:
                              flow === "credit"
                                ? "rgba(255,255,255,0.75)"
                                : colors.text.tertiary,
                          },
                        ]}
                      >
                        Credit
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.flowDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />

                  <TouchableOpacity
                    onPress={() => handleFlowChange("debit")}
                    activeOpacity={0.8}
                    style={[
                      styles.flowButton,
                      flow === "debit"
                        ? styles.flowButtonActiveDebit
                        : { backgroundColor: "transparent" },
                    ]}
                  >
                    <Ionicons
                      name="arrow-up-circle"
                      size={18}
                      color={flow === "debit" ? "#fff" : colors.text.tertiary}
                    />
                    <View>
                      <Text
                        style={[
                          styles.flowButtonLabel,
                          {
                            color:
                              flow === "debit" ? "#fff" : colors.text.secondary,
                          },
                        ]}
                      >
                        Expense
                      </Text>
                      <Text
                        style={[
                          styles.flowButtonSub,
                          {
                            color:
                              flow === "debit"
                                ? "rgba(255,255,255,0.75)"
                                : colors.text.tertiary,
                          },
                        ]}
                      >
                        Debit
                      </Text>
                    </View>
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
    </FormSheetModal>
  );
};

const styles = StyleSheet.create({
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
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    height: 64,
  },
  flowButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  flowButtonActiveCredit: {
    backgroundColor: "#16a34a",
  },
  flowButtonActiveDebit: {
    backgroundColor: "#e11d48",
  },
  flowButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  flowButtonSub: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  flowDivider: {
    width: 1,
    marginVertical: 12,
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
});
