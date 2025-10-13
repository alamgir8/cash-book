import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { FilterBar } from "../../components/filter-bar";
import { TransactionCard } from "../../components/transaction-card";
import { VoiceInputButton } from "../../components/voice-input-button";
import { exportTransactionsPdf } from "../../services/reports";
import {
  createTransaction,
  fetchTransactions,
  type TransactionFilters,
} from "../../services/transactions";
import { fetchAccounts, type Account } from "../../services/accounts";
import { queryKeys } from "../../lib/queryKeys";
import Toast from "react-native-toast-message";

const transactionSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: z.number().positive("Amount must be greater than zero"),
  type: z.enum(["debit", "credit"]),
  date: z.string().optional(),
  description: z.string().optional(),
  comment: z.string().optional(),
  createdViaVoice: z.boolean().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

const defaultFilters: TransactionFilters = {
  range: "monthly",
  page: 1,
  limit: 20,
};

const parseVoiceTranscript = (
  transcript: string,
  accounts: Account[]
): Partial<TransactionFormValues> => {
  const lower = transcript.toLowerCase();
  const parsed: Partial<TransactionFormValues> = {
    createdViaVoice: true,
    comment: transcript,
  };

  const amountMatch = transcript.match(/(\d+(\.\d+)?)/);
  if (amountMatch) {
    parsed.amount = Number(amountMatch[1]);
  }

  if (lower.includes("credit") || lower.includes("deposit")) {
    parsed.type = "credit";
  } else if (lower.includes("debit") || lower.includes("withdraw")) {
    parsed.type = "debit";
  }

  const accountMatch = accounts.find((account) =>
    lower.includes(account.name.toLowerCase())
  );

  if (accountMatch) {
    parsed.accountId = accountMatch._id;
  }

  const dateMatch = transcript.match(
    /(20\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12][0-9]|3[01]))/
  );
  if (dateMatch) {
    parsed.date = dayjs(dateMatch[0].replaceAll("/", "-")).format("YYYY-MM-DD");
  }

  return parsed;
};

export default function DashboardScreen() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters);
  const [isModalVisible, setModalVisible] = useState(false);

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts,
  });

  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => fetchTransactions(filters),
    placeholderData: (previousData) => previousData,
  });

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: async () => {
      Toast.show({ type: "success", text1: "Transaction recorded" });
      setModalVisible(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      accountId: "",
      amount: 0,
      type: "debit",
      date: dayjs().format("YYYY-MM-DD"),
      description: "",
      comment: "",
    },
  });

  const currentAmount = watch("amount");

  const totals = useMemo(() => {
    const data = transactionsQuery.data as any;
    if (!data?.transactions) return { debit: 0, credit: 0 };
    return data.transactions.reduce(
      (acc: any, txn: any) => {
        acc[txn.type] += txn.amount;
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [transactionsQuery.data]);

  const onSubmit = async (values: TransactionFormValues) => {
    try {
      await createMutation.mutateAsync(values as any);
      reset({
        accountId: "",
        amount: 0,
        type: "debit",
        date: dayjs().format("YYYY-MM-DD"),
        description: "",
        comment: "",
        createdViaVoice: false,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleVoiceResult = (transcript: string) => {
    if (!accountsQuery.data) return;
    const parsed = parseVoiceTranscript(transcript, accountsQuery.data);
    Object.entries(parsed).forEach(([key, value]) => {
      setValue(key as keyof TransactionFormValues, value as never, {
        shouldDirty: true,
      });
    });
  };

  const renderHeader = () => (
    <View className="gap-6">
      {/* Modern Balance Cards */}
      <View className="flex-row gap-4">
        <View className="flex-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center">
              <Ionicons name="trending-down" size={20} color="#ef4444" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs uppercase font-medium">
                Total Debit
              </Text>
              <Text className="text-red-500 text-xl font-bold">
                ${totals.debit.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center">
              <Ionicons name="trending-up" size={20} color="#10b981" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs uppercase font-medium">
                Total Credit
              </Text>
              <Text className="text-green-500 text-xl font-bold">
                ${totals.credit.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Net Balance Card */}
      <View className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-gray-600 text-sm font-medium">
              Net Balance
            </Text>
            <Text
              className={`text-2xl font-bold ${
                totals.credit - totals.debit >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              ${Math.abs(totals.credit - totals.debit).toFixed(2)}
            </Text>
            <Text className="text-gray-500 text-xs mt-1">
              {totals.credit - totals.debit >= 0 ? "Surplus" : "Deficit"}
            </Text>
          </View>
          <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center">
            <Ionicons
              name={
                totals.credit - totals.debit >= 0
                  ? "checkmark-circle"
                  : "alert-circle"
              }
              size={24}
              color={totals.credit - totals.debit >= 0 ? "#10b981" : "#ef4444"}
            />
          </View>
        </View>
      </View>

      <FilterBar
        filters={filters}
        onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
      />

      {/* Export Button with modern design */}
      <TouchableOpacity
        onPress={async () => {
          try {
            await exportTransactionsPdf(filters);
            Toast.show({ type: "success", text1: "PDF exported" });
          } catch (error) {
            console.error(error);
            Toast.show({ type: "error", text1: "Failed to export PDF" });
          }
        }}
        className="flex-row items-center justify-center gap-3 bg-white border border-gray-200 rounded-2xl py-4 shadow-sm"
      >
        <View className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center">
          <Ionicons name="document-text-outline" size={18} color="#3b82f6" />
        </View>
        <Text className="text-gray-700 font-semibold">Export Transactions</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={(transactionsQuery.data as any)?.transactions ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={transactionsQuery.isRefetching}
            onRefresh={() => transactionsQuery.refetch()}
            tintColor="#3b82f6"
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          transactionsQuery.isLoading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 48 }} />
          ) : (
            <View className="items-center mt-12 gap-3 bg-white rounded-2xl p-8 mx-4">
              <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons
                  name="document-text-outline"
                  size={32}
                  color="#6b7280"
                />
              </View>
              <Text className="text-gray-600 text-center font-medium">
                No transactions found
              </Text>
              <Text className="text-gray-400 text-center text-sm">
                Adjust your filters or add your first transaction
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <TransactionCard transaction={item} />}
      />

      {/* Modern Floating Action Button */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        className="absolute right-6 bottom-32 bg-blue-500 w-16 h-16 rounded-full items-center justify-center shadow-lg shadow-blue-500/30 border-4 border-white"
        style={{
          shadowColor: "#3b82f6",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6 gap-6 max-h-[80%]">
            {/* Header */}
            <View className="flex-row justify-between items-center pb-2 border-b border-gray-100">
              <View>
                <Text className="text-gray-900 text-xl font-bold">
                  New Transaction
                </Text>
                <Text className="text-gray-500 text-sm">
                  Record your debit or credit
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View className="gap-5">
              {/* Account Selection */}
              <View>
                <Text className="text-gray-700 text-sm font-semibold mb-3">
                  Choose Account
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {accountsQuery.data?.map((account) => {
                    const selected = watch("accountId") === account._id;
                    return (
                      <TouchableOpacity
                        key={account._id}
                        onPress={() =>
                          setValue("accountId", account._id, {
                            shouldValidate: true,
                          })
                        }
                        className={`px-4 py-3 rounded-xl border-2 ${
                          selected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            selected ? "text-blue-700" : "text-gray-600"
                          }`}
                        >
                          {account.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.accountId ? (
                  <Text className="text-red-500 text-sm mt-2">
                    {errors.accountId.message}
                  </Text>
                ) : null}
              </View>

              {/* Amount and Type Row */}
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Amount
                  </Text>
                  <Controller
                    control={control}
                    name="amount"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={String(value || "")}
                        onChangeText={(text) =>
                          onChange(Number(text.replace(/[^0-9.]/g, "")) || 0)
                        }
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#9ca3af"
                        className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 text-lg font-semibold"
                      />
                    )}
                  />
                  {errors.amount ? (
                    <Text className="text-red-500 text-sm mt-1">
                      {errors.amount.message}
                    </Text>
                  ) : null}
                </View>
                <View className="flex-1">
                  <Text className="text-gray-700 text-sm font-semibold mb-2">
                    Type
                  </Text>
                  <Controller
                    control={control}
                    name="type"
                    render={({ field: { value, onChange } }) => (
                      <View className="flex-row gap-2">
                        {(["debit", "credit"] as const).map((option) => (
                          <TouchableOpacity
                            key={option}
                            onPress={() => onChange(option)}
                            className={`flex-1 py-3 rounded-xl border-2 ${
                              value === option
                                ? option === "debit"
                                  ? "border-red-500 bg-red-50"
                                  : "border-green-500 bg-green-50"
                                : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <Text
                              className={`text-center font-semibold text-sm ${
                                value === option
                                  ? option === "debit"
                                    ? "text-red-700"
                                    : "text-green-700"
                                  : "text-gray-600"
                              }`}
                            >
                              {option.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>
              </View>

              {/* Date Field */}
              <View>
                <Text className="text-gray-700 text-sm font-semibold mb-2">
                  Date
                </Text>
                <Controller
                  control={control}
                  name="date"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9ca3af"
                      className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                    />
                  )}
                />
              </View>

              {/* Description Field */}
              <View>
                <Text className="text-gray-700 text-sm font-semibold mb-2">
                  Description
                </Text>
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      value={value || ""}
                      onChangeText={onChange}
                      placeholder="What is this transaction about?"
                      placeholderTextColor="#9ca3af"
                      className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200"
                    />
                  )}
                />
              </View>

              {/* Comment Field */}
              <View>
                <Text className="text-gray-700 text-sm font-semibold mb-2">
                  Additional Notes
                </Text>
                <Controller
                  control={control}
                  name="comment"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      value={value || ""}
                      onChangeText={onChange}
                      placeholder="Any additional details..."
                      placeholderTextColor="#9ca3af"
                      className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 min-h-[80px]"
                      multiline
                      textAlignVertical="top"
                    />
                  )}
                />
              </View>

              {/* Voice Input */}
              <View>
                <VoiceInputButton onResult={handleVoiceResult} />
              </View>

              {/* Amount Preview */}
              {currentAmount > 0 ? (
                <View className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <Text className="text-blue-700 text-sm font-medium text-center">
                    💰 Amount Preview: ${currentAmount.toFixed(2)}
                  </Text>
                </View>
              ) : null}

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSubmit(onSubmit)}
                disabled={createMutation.isPending}
                className="bg-blue-500 rounded-2xl py-4 mt-2 items-center shadow-lg shadow-blue-500/25"
                style={{
                  shadowColor: "#3b82f6",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text className="text-white font-bold text-base">
                      Save Transaction
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
