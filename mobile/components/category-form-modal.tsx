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
  TouchableOpacity,
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
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View
            className="bg-white rounded-t-3xl flex-1"
            style={{ maxHeight: "90%" }}
          >
            {/* Header */}
            <View className="flex-row justify-between items-center p-6 pb-4 border-b border-gray-100">
              <View>
                <Text className="text-gray-900 text-xl font-bold">
                  {isEditing ? "Edit Category" : "New Category"}
                </Text>
                <Text className="text-gray-500 text-sm">
                  {isEditing
                    ? "Update category details"
                    : "Create a new category"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 px-6 py-4"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View className="gap-5">
                {/* Error Message */}
                {error && (
                  <View className="bg-red-50 p-3 rounded-xl border border-red-200 flex-row items-center gap-2">
                    <Ionicons name="alert-circle" size={20} color="#dc2626" />
                    <Text className="text-red-600 text-sm flex-1">{error}</Text>
                    <Pressable onPress={() => setError(null)}>
                      <Ionicons name="close" size={18} color="#dc2626" />
                    </Pressable>
                  </View>
                )}

                {/* Flow Selection */}
                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Category Flow
                  </Text>
                  <View className="flex-row bg-gray-100 p-1 rounded-xl">
                    <Pressable
                      onPress={() => handleFlowChange("credit")}
                      className={`flex-1 py-3 rounded-lg items-center ${
                        flow === "credit" ? "bg-white shadow-sm" : ""
                      }`}
                    >
                      <Text
                        className={`font-semibold ${
                          flow === "credit" ? "text-green-600" : "text-gray-500"
                        }`}
                      >
                        Income (Credit)
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleFlowChange("debit")}
                      className={`flex-1 py-3 rounded-lg items-center ${
                        flow === "debit" ? "bg-white shadow-sm" : ""
                      }`}
                    >
                      <Text
                        className={`font-semibold ${
                          flow === "debit" ? "text-red-600" : "text-gray-500"
                        }`}
                      >
                        Expense (Debit)
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Name Input */}
                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Category Name
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., Groceries"
                    placeholderTextColor="#9ca3af"
                    className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 text-base"
                  />
                </View>

                {/* Type Selection */}
                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Category Type
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {currentTypes.map((t) => (
                      <Pressable
                        key={t.value}
                        onPress={() => setType(t.value)}
                        className={`px-3 py-2 rounded-lg border ${
                          type === t.value
                            ? "bg-blue-50 border-blue-200"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <Text
                          className={`text-sm ${
                            type === t.value ? "text-blue-700" : "text-gray-600"
                          }`}
                        >
                          {t.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Color Selection */}
                <View>
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Color Tag
                  </Text>
                  <View className="flex-row flex-wrap gap-3">
                    {COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-10 h-10 rounded-full items-center justify-center ${
                          color === c ? "border-2 border-gray-400" : ""
                        }`}
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
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Description (Optional)
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Add a note..."
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 min-h-[96px]"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View className="p-6 pt-4 pb-8 border-t border-gray-100">
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
