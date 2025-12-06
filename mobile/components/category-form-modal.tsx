import { useEffect, useState, useCallback } from "react";
import {
  Modal,
  Text,
  TextInput,
  Pressable,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  updateCategory,
  type Category,
} from "../services/categories";
import { queryKeys } from "../lib/queryKeys";

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
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: "white",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            height: "85%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            <Pressable onPress={onClose} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
            <Text
              style={{ fontSize: 18, fontWeight: "bold", color: "#111827" }}
            >
              {isEditing ? "Edit Category" : "New Category"}
            </Text>
            <Pressable
              onPress={handleSubmit}
              disabled={mutation.isPending}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: mutation.isPending ? "#f3f4f6" : "#3b82f6",
              }}
            >
              <Text
                style={{
                  fontWeight: "600",
                  color: mutation.isPending ? "#9ca3af" : "white",
                }}
              >
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }}>
            <View style={{ gap: 24, paddingBottom: 40 }}>
              {/* Error Message - Inside modal, at top */}
              {error && (
                <View
                  style={{
                    backgroundColor: "#fef2f2",
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#fecaca",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="alert-circle" size={20} color="#dc2626" />
                  <Text style={{ color: "#dc2626", fontSize: 14, flex: 1 }}>
                    {error}
                  </Text>
                  <Pressable onPress={() => setError(null)}>
                    <Ionicons name="close" size={18} color="#dc2626" />
                  </Pressable>
                </View>
              )}

              {/* Flow Selection - Simplified toggle */}
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  Category Flow
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: "#f3f4f6",
                    padding: 4,
                    borderRadius: 12,
                  }}
                >
                  <Pressable
                    onPress={() => handleFlowChange("credit")}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 8,
                      alignItems: "center",
                      backgroundColor:
                        flow === "credit" ? "white" : "transparent",
                      shadowColor: flow === "credit" ? "#000" : "transparent",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: flow === "credit" ? 0.1 : 0,
                      shadowRadius: 2,
                      elevation: flow === "credit" ? 2 : 0,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "600",
                        color: flow === "credit" ? "#16a34a" : "#6b7280",
                      }}
                    >
                      Income (Credit)
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleFlowChange("debit")}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 8,
                      alignItems: "center",
                      backgroundColor:
                        flow === "debit" ? "white" : "transparent",
                      shadowColor: flow === "debit" ? "#000" : "transparent",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: flow === "debit" ? 0.1 : 0,
                      shadowRadius: 2,
                      elevation: flow === "debit" ? 2 : 0,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "600",
                        color: flow === "debit" ? "#dc2626" : "#6b7280",
                      }}
                    >
                      Expense (Debit)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Name Input */}
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  Category Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Groceries"
                  style={{
                    backgroundColor: "#f9fafb",
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                  }}
                />
              </View>

              {/* Type Selection */}
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  Category Type
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {currentTypes.map((t) => (
                    <Pressable
                      key={t.value}
                      onPress={() => setType(t.value)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        backgroundColor: type === t.value ? "#eff6ff" : "white",
                        borderColor: type === t.value ? "#bfdbfe" : "#e5e7eb",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          color: type === t.value ? "#1d4ed8" : "#4b5563",
                        }}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Color Selection */}
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  Color Tag
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
                >
                  {COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: c,
                        borderWidth: color === c ? 2 : 0,
                        borderColor: "#9ca3af",
                      }}
                    >
                      {color === c && (
                        <Ionicons name="checkmark" size={20} color="white" />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Description Input */}
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  Description (Optional)
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add a note..."
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: "#f9fafb",
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    height: 96,
                    textAlignVertical: "top",
                  }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
