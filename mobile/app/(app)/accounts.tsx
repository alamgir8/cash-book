import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs from "dayjs";
import Toast from "react-native-toast-message";
import { SafeAreaView } from "react-native-safe-area-context";
import { VoiceInputButton } from "../../components/voice-input-button";
import { ScreenHeader } from "../../components/screen-header";
import { EmptyState } from "../../components/empty-state";
import { ActionButton } from "../../components/action-button";
import { FloatingActionButton } from "../../components/floating-action-button";
import {
  createAccount,
  fetchAccountsOverview,
  updateAccount,
  type Account,
  type AccountOverview,
} from "../../services/accounts";
import { queryKeys } from "../../lib/queryKeys";
import { usePreferences } from "../../hooks/usePreferences";

const schema = z.object({
  name: z.string().min(2, "Account name is required"),
  type: z.enum(["debit", "credit"]),
  description: z.string().optional(),
  createdViaVoice: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_FORM_VALUES: FormValues = {
  name: "",
  type: "debit",
  description: "",
  createdViaVoice: false,
};

const parseVoiceForAccount = (transcript: string): Partial<FormValues> => {
  const lower = transcript.toLowerCase();
  const parsed: Partial<FormValues> = {
    description: transcript,
    createdViaVoice: true,
  };

  const nameMatch = transcript.match(
    /account (named|called)? ([a-zA-Z0-9 ]+)/i
  );
  if (nameMatch) {
    parsed.name = nameMatch[2].trim();
  } else {
    parsed.name = transcript.split(" account")[0] || transcript;
  }

  if (lower.includes("debit")) {
    parsed.type = "debit";
  } else if (lower.includes("credit")) {
    parsed.type = "credit";
  }

  return parsed;
};

export default function AccountsScreen() {
  const { formatAmount: prefFormatAmount } = usePreferences();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();

  const accountsQuery = useQuery({
    queryKey: queryKeys.accountsOverview,
    queryFn: fetchAccountsOverview,
  });

  const invalidateAccountData = async (accountId?: string) => {
    const tasks: Promise<unknown>[] = [
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsOverview }),
    ];

    if (accountId) {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.accountDetail(accountId),
        })
      );
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: ["account", accountId],
          exact: false,
        })
      );
    }

    await Promise.all(tasks);
  };

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: async () => {
      Toast.show({ type: "success", text1: "Account added" });
      await invalidateAccountData();
      setModalVisible(false);
      setSelectedAccount(null);
      reset({ ...DEFAULT_FORM_VALUES });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: async () => {
      Toast.show({ type: "success", text1: "Account updated" });
      await invalidateAccountData(selectedAccount?._id);
      setModalVisible(false);
      setSelectedAccount(null);
      reset({ ...DEFAULT_FORM_VALUES });
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...DEFAULT_FORM_VALUES },
  });

  const openModal = useCallback(
    (account?: Account | AccountOverview) => {
      if (account) {
        const baseAccount: Account = {
          _id: account._id,
          name: account.name,
          type: account.type,
          description: account.description,
          balance: account.balance,
        };
        setSelectedAccount(baseAccount);
        reset({
          name: account.name,
          type: account.type,
          description: account.description ?? "",
        });
      } else {
        setSelectedAccount(null);
        reset({ ...DEFAULT_FORM_VALUES });
      }
      setModalVisible(true);
    },
    [reset]
  );

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        name: values.name,
        type: values.type,
        description: values.description,
        createdViaVoice: values.createdViaVoice,
      };
      if (selectedAccount) {
        const { createdViaVoice, ...updatePayload } = payload;
        await updateMutation.mutateAsync({
          accountId: selectedAccount._id,
          ...updatePayload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleVoiceResult = (transcript: string) => {
    const parsed = parseVoiceForAccount(transcript);
    Object.entries(parsed).forEach(([key, value]) => {
      setValue(key as keyof FormValues, value as never, { shouldDirty: true });
    });
  };

  useEffect(() => {
    const accountParam = Array.isArray(params.accountId)
      ? params.accountId[0]
      : params.accountId;

    if (!accountParam || !accountsQuery.data) {
      return;
    }

    const target = accountsQuery.data.find(
      (account) => account._id === accountParam
    );
    if (target) {
      openModal(target);
      router.replace("/(app)/accounts");
    }
  }, [params.accountId, accountsQuery.data, openModal, router]);

  const accounts = useMemo(
    () => accountsQuery.data ?? [],
    [accountsQuery.data]
  );

  const totals = useMemo(() => {
    const aggregate = {
      totalAccounts: accounts.length,
      totalDebit: 0,
      totalCredit: 0,
      netBalance: 0,
      totalTransactions: 0,
      lastActivity: null as Date | null,
    };

    accounts.forEach((account) => {
      aggregate.totalDebit += account.summary.totalDebit ?? 0;
      aggregate.totalCredit += account.summary.totalCredit ?? 0;
      aggregate.netBalance += account.balance ?? 0;
      aggregate.totalTransactions += account.summary.totalTransactions ?? 0;

      if (account.summary.lastTransactionDate) {
        const activityDate = new Date(account.summary.lastTransactionDate);
        if (!aggregate.lastActivity || activityDate > aggregate.lastActivity) {
          aggregate.lastActivity = activityDate;
        }
      }
    });

    return aggregate;
  }, [accounts]);

  const formatAmount = (value: number) => prefFormatAmount(value);
  const formatSignedAmount = (value: number) => {
    const base = prefFormatAmount(Math.abs(value));
    return `${value >= 0 ? "+" : "-"}${base}`;
  };

  const lastActivityLabel = totals.lastActivity
    ? dayjs(totals.lastActivity).format("MMM D, YYYY")
    : "No activity yet";
  const netPositive = totals.netBalance >= 0;

  const renderHeader = () => (
    <View className="gap-4 mb-2">
      <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-900 text-lg font-bold">
            Portfolio Overview
          </Text>
          <View className="px-3 py-1 rounded-full bg-blue-50">
            <Text className="text-blue-600 text-xs font-semibold">
              {totals.totalAccounts} Accounts
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3 mt-4">
          <View className="flex-1 bg-green-50 rounded-xl p-4 border border-green-100">
            <Text className="text-xs font-semibold text-green-700 uppercase">
              Total Credit
            </Text>
            <Text className="text-2xl font-bold text-green-700 mt-2">
              {formatAmount(totals.totalCredit)}
            </Text>
            <Text className="text-xs text-green-600 mt-1">
              Across all accounts
            </Text>
          </View>
          <View className="flex-1 bg-red-50 rounded-xl p-4 border border-red-100">
            <Text className="text-xs font-semibold text-red-700 uppercase">
              Total Debit
            </Text>
            <Text className="text-2xl font-bold text-red-700 mt-2">
              {formatAmount(totals.totalDebit)}
            </Text>
            <Text className="text-xs text-red-600 mt-1">Overall spending</Text>
          </View>
        </View>

        <View className="flex-row gap-3 mt-3">
          <View
            className={`flex-1 rounded-xl p-4 border ${
              netPositive
                ? "bg-emerald-50 border-emerald-100"
                : "bg-rose-50 border-rose-100"
            }`}
          >
            <Text
              className={`text-xs font-semibold uppercase ${
                netPositive ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              Net Balance
            </Text>
            <Text
              className={`text-2xl font-bold mt-2 ${
                netPositive ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {formatAmount(Math.abs(totals.netBalance))}
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              {netPositive ? "Surplus across accounts" : "Outstanding balance"}
            </Text>
          </View>
          <View className="flex-1 bg-indigo-50 rounded-xl p-4 border border-indigo-100">
            <Text className="text-xs font-semibold text-indigo-700 uppercase">
              Transactions
            </Text>
            <Text className="text-2xl font-bold text-indigo-700 mt-2">
              {totals.totalTransactions}
            </Text>
            <Text className="text-xs text-indigo-600 mt-1">
              Last activity: {lastActivityLabel}
            </Text>
          </View>
        </View>
      </View>

      <Text className="text-gray-500 text-sm font-semibold uppercase tracking-wide px-1">
        Accounts
      </Text>
    </View>
  );

  // console.log("accounts", accounts);

  return (
    <View className="flex-1 bg-slate-50">
      <ScreenHeader
        title="Accounts"
        subtitle="Manage your financial accounts"
        actionButton={{
          label: "Add",
          onPress: () => openModal(),
          icon: "add",
        }}
        icon="analytics"
      />

      <FlatList
        data={accounts}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 16,
          paddingBottom: 88,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        // ListEmptyComponent={
        //   <EmptyState
        //     isLoading={accountsQuery?.isLoading}
        //     loadingText="Loading accounts..."
        //     icon="wallet-outline"
        //     title="No Accounts Yet"
        //     description="Create your first account to start tracking your finances."
        //     actionButton={{
        //       label: "Create Account",
        //       onPress: () => openModal(),
        //     }}
        //   />
        // }
        renderItem={({ item }) => {
          const lastActivity = item.summary.lastTransactionDate
            ? dayjs(item.summary.lastTransactionDate).format("MMM D, YYYY")
            : "No activity yet";
          const netFlow =
            (item.summary.totalCredit ?? 0) - (item.summary.totalDebit ?? 0);
          const netFlowPositive = netFlow >= 0;

          return (
            <View
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
                elevation: 4,
              }}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1 mr-4">
                  <Text className="text-gray-900 text-xl font-bold">
                    {item.name}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-2">
                    <View
                      className={`px-3 py-1 rounded-full ${
                        item.type === "credit"
                          ? "bg-green-50 border border-green-200"
                          : "bg-blue-50 border border-blue-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold uppercase ${
                          item.type === "credit"
                            ? "text-green-700"
                            : "text-blue-600"
                        }`}
                      >
                        {item.type} Account
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-500">
                      Last activity: {lastActivity}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-gray-500 text-xs font-medium uppercase">
                    Balance
                  </Text>
                  <Text
                    className={`text-2xl font-bold ${
                      item.balance >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {formatAmount(Math.abs(item.balance))}
                  </Text>
                </View>
              </View>

              {item.description ? (
                <Text className="text-gray-600 text-sm mt-4 leading-5">
                  {item.description}
                </Text>
              ) : null}

              <View className="flex-row gap-3 mt-4">
                <View className="flex-1 bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <Text className="text-xs font-semibold text-blue-600 uppercase">
                    Total Credit
                  </Text>
                  <Text className="text-lg font-bold text-blue-700 mt-1">
                    {formatAmount(item.summary.totalCredit ?? 0)}
                  </Text>
                </View>
                <View className="flex-1 bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <Text className="text-xs font-semibold text-amber-600 uppercase">
                    Total Debit
                  </Text>
                  <Text className="text-lg font-bold text-amber-700 mt-1">
                    {formatAmount(item.summary.totalDebit ?? 0)}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-3 mt-3">
                <View className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <Text className="text-xs font-semibold text-gray-500 uppercase">
                    Transactions
                  </Text>
                  <Text className="text-lg font-bold text-gray-700 mt-1">
                    {item.summary.totalTransactions}
                  </Text>
                </View>
                <View
                  className={`flex-1 rounded-xl p-3 border ${
                    netFlowPositive
                      ? "bg-emerald-50 border-emerald-100"
                      : "bg-rose-50 border-rose-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold uppercase ${
                      netFlowPositive ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    Net Flow
                  </Text>
                  <Text
                    className={`text-lg font-bold mt-1 ${
                      netFlowPositive ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {formatSignedAmount(netFlow)}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/accounts/[accountId]",
                      params: { accountId: item._id },
                    } as any)
                  }
                  className="flex-1 flex-row items-center justify-center gap-2 bg-blue-500 rounded-xl py-2.5 active:opacity-90"
                >
                  <Ionicons name="time-outline" size={18} color="#fff" />
                  <Text className="text-white font-semibold">View History</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openModal(item)}
                  className="flex-1 flex-row items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 bg-gray-50 active:bg-gray-100"
                >
                  <Ionicons name="pencil" size={18} color="#334155" />
                  <Text className="text-gray-700 font-semibold">Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
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
                    {selectedAccount ? "Edit Account" : "New Account"}
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    {selectedAccount
                      ? "Update account details"
                      : "Create a new account to track"}
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
              <View className="flex-1">
                <ScrollView
                  className="px-6"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  <View className="gap-5 py-4">
                    {/* Account Name */}
                    <View>
                      <Text className="text-gray-700 text-sm font-semibold mb-2">
                        Account Name
                      </Text>
                      <Controller
                        control={control}
                        name="name"
                        render={({ field: { onChange, value } }) => (
                          <TextInput
                            value={value}
                            onChangeText={onChange}
                            placeholder="e.g. Business Checking, Savings Account"
                            placeholderTextColor="#9ca3af"
                            className="bg-gray-50 text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 text-base"
                          />
                        )}
                      />
                      {errors.name ? (
                        <Text className="text-red-500 text-sm mt-2">
                          {errors.name.message}
                        </Text>
                      ) : null}
                    </View>

                    {/* Account Type */}
                    <View>
                      <Text className="text-gray-700 text-sm font-semibold mb-3">
                        Account Type
                      </Text>
                      <Controller
                        control={control}
                        name="type"
                        render={({ field: { value, onChange } }) => (
                          <View className="flex-row gap-3">
                            {(["debit", "credit"] as const).map((option) => (
                              <TouchableOpacity
                                key={option}
                                onPress={() => onChange(option)}
                                className={`flex-1 py-3 rounded-xl border-2 ${
                                  value === option
                                    ? option === "debit"
                                      ? "border-blue-500 bg-blue-50"
                                      : "border-green-500 bg-green-50"
                                    : "border-gray-200 bg-gray-50"
                                }`}
                              >
                                <View className="items-center gap-2">
                                  <Ionicons
                                    name={
                                      option === "debit"
                                        ? "card-outline"
                                        : "cash-outline"
                                    }
                                    size={24}
                                    color={
                                      value === option
                                        ? option === "debit"
                                          ? "#3b82f6"
                                          : "#10b981"
                                        : "#6b7280"
                                    }
                                  />
                                  <Text
                                    className={`font-bold text-sm ${
                                      value === option
                                        ? option === "debit"
                                          ? "text-blue-700"
                                          : "text-green-700"
                                        : "text-gray-600"
                                    }`}
                                  >
                                    {option.toUpperCase()}
                                  </Text>
                                  <Text
                                    className={`text-xs text-center ${
                                      value === option
                                        ? option === "debit"
                                          ? "text-blue-600"
                                          : "text-green-600"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {option === "debit"
                                      ? "Money going out"
                                      : "Money coming in"}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      />
                    </View>

                    {/* Description */}
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
                            placeholder="Optional details about this account..."
                            placeholderTextColor="#9ca3af"
                            className="bg-gray-50 text-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 min-h-[80px]"
                            multiline
                            textAlignVertical="top"
                          />
                        )}
                      />
                    </View>

                    {/* Voice Input */}
                    <VoiceInputButton onResult={handleVoiceResult} />
                  </View>
                </ScrollView>
              </View>

              {/* Submit Button - Fixed at bottom */}
              <View className="p-6 pt-4 border-t border-gray-100">
                <ActionButton
                  label={selectedAccount ? "Update Account" : "Create Account"}
                  onPress={handleSubmit(onSubmit)}
                  isLoading={
                    createMutation.isPending || updateMutation.isPending
                  }
                  variant="primary"
                  size="medium"
                  icon={selectedAccount ? "checkmark-circle" : "add-circle"}
                  fullWidth
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
