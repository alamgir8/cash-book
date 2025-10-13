import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import dayjs from "dayjs";
import Toast from "react-native-toast-message";
import { FilterBar } from "../../components/filter-bar";
import { TransactionCard } from "../../components/transaction-card";
import { VoiceInputButton } from "../../components/voice-input-button";
import { StatsCards } from "../../components/stats-cards";
import { QuickActions } from "../../components/quick-actions";
import { ScreenHeader } from "../../components/screen-header";
import { EmptyState } from "../../components/empty-state";
import { FloatingActionButton } from "../../components/floating-action-button";
import { exportTransactionsPdf } from "../../services/reports";
import {
  createTransaction,
  fetchTransactions,
  type TransactionFilters,
} from "../../services/transactions";
import { fetchAccounts, type Account } from "../../services/accounts";
import { queryKeys } from "../../lib/queryKeys";

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      ]);
    },
    onError: (error) => {
      console.error("Transaction creation error:", error);
      Toast.show({
        type: "error",
        text1: "Error saving transaction",
        text2: "Please try again.",
      });
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

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      setValue("date", dayjs(date).format("YYYY-MM-DD"), {
        shouldValidate: true,
      });
    }
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
  };

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
      const payload = {
        ...values,
        amount: Number(values.amount),
        date: values.date?.trim() ? values.date.trim() : undefined,
        description: values.description?.trim()
          ? values.description.trim()
          : undefined,
        comment: values.comment?.trim() ? values.comment.trim() : undefined,
        createdViaVoice: Boolean(values.createdViaVoice),
      };
      await createMutation.mutateAsync(payload as any);
      setModalVisible(false);
      reset({
        accountId: "",
        amount: 0,
        type: "debit",
        date: dayjs().format("YYYY-MM-DD"),
        description: "",
        comment: "",
        createdViaVoice: false,
      });
      Toast.show({
        type: "success",
        text1: "Transaction saved successfully!",
        text2: "Your transaction has been recorded.",
      });
    } catch (error) {
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Error saving transaction",
        text2: "Please try again.",
      });
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

  const renderHeader = () => {
    const transactionCount =
      (transactionsQuery.data as any)?.transactions?.length || 0;
    const accountCount = accountsQuery.data?.length || 0;

    return (
      <View className="gap-6">
        {/* Enhanced Statistics Cards */}
        <StatsCards
          totalDebit={totals.debit}
          totalCredit={totals.credit}
          transactionCount={transactionCount}
          accountCount={accountCount}
        />

        {/* Quick Actions */}
        <QuickActions
          onAddTransaction={() => setModalVisible(true)}
          onAddAccount={() => {
            router.push("/(app)/accounts");
          }}
          onExportPDF={async () => {
            try {
              await exportTransactionsPdf(filters);
              Toast.show({
                type: "success",
                text1: "PDF exported successfully!",
              });
            } catch (error) {
              console.error(error);
              Toast.show({ type: "error", text1: "Failed to export PDF" });
            }
          }}
          onVoiceInput={() => {
            setModalVisible(true);
          }}
        />

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
          onApplyFilters={() => transactionsQuery.refetch()}
          onReset={() => {
            setFilters({
              range: "daily",
              page: 1,
            });
            transactionsQuery.refetch();
          }}
        />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gradient-to-b from-blue-50 to-gray-50">
      <ScreenHeader
        title="Dashboard"
        subtitle="Track your finances easily"
        icon="analytics"
      />

      <FlatList
        data={(transactionsQuery.data as any)?.transactions ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 20,
          gap: 16,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={transactionsQuery.isRefetching}
            onRefresh={() => transactionsQuery.refetch()}
            tintColor="#1d4ed8"
            colors={["#1d4ed8"]}
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          transactionsQuery.isLoading ? (
            <View className="items-center mt-12">
              <ActivityIndicator color="#1d4ed8" size="large" />
              <Text className="text-gray-500 mt-4 text-base">
                Loading transactions...
              </Text>
            </View>
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="No transactions yet"
              description="Start tracking your finances by adding your first transaction"
              actionButton={{
                label: "Add Transaction",
                onPress: () => setModalVisible(true),
              }}
            />
          )
        }
        renderItem={({ item }) => <TransactionCard transaction={item} />}
      />

      <FloatingActionButton
        onPress={() => setModalVisible(true)}
        icon="add"
        position="bottom-right"
      />

      <Modal visible={isModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white rounded-t-3xl" style={{ height: "90%" }}>
              {/* Header */}
              <View className="flex-row justify-between items-center p-6 pb-4 border-b border-gray-100">
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

              {/* Form Content */}
              <View className="flex-1 px-6 py-4">
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
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
                                onChange(
                                  Number(text.replace(/[^0-9.]/g, "")) || 0
                                )
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
                        render={({ field: { value } }) => (
                          <View>
                            <TouchableOpacity
                              onPress={openDatePicker}
                              className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 flex-row items-center justify-between"
                            >
                              <Text className="text-gray-900 text-base">
                                {value
                                  ? dayjs(value).format("MMM DD, YYYY")
                                  : "Select Date"}
                              </Text>
                              <Ionicons
                                name="calendar-outline"
                                size={20}
                                color="#6b7280"
                              />
                            </TouchableOpacity>

                            {showDatePicker && (
                              <DateTimePicker
                                value={selectedDate}
                                mode="date"
                                display={
                                  Platform.OS === "ios" ? "compact" : "default"
                                }
                                onChange={handleDateChange}
                                maximumDate={new Date()}
                              />
                            )}
                          </View>
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
                    <VoiceInputButton onResult={handleVoiceResult} />

                    {/* Amount Preview */}
                    {currentAmount > 0 ? (
                      <View className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                        <Text className="text-blue-700 text-sm font-medium text-center">
                          💰 Amount Preview: ${currentAmount.toFixed(2)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </ScrollView>
              </View>

              {/* Submit Button - Fixed at bottom */}
              <View className="p-6 pt-4 border-t border-gray-100">
                <TouchableOpacity
                  onPress={handleSubmit(onSubmit)}
                  disabled={createMutation.isPending}
                  className="bg-blue-500 rounded-2xl py-4 items-center shadow-lg shadow-blue-500/25"
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
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="white"
                      />
                      <Text className="text-white font-bold text-base">
                        Save Transaction
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
