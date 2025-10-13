import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import Toast from "react-native-toast-message";
import { VoiceInputButton } from "../../components/voice-input-button";
import {
  createAccount,
  fetchAccounts,
  updateAccount,
  type Account,
} from "../../services/accounts";
import { queryKeys } from "../../lib/queryKeys";

const schema = z.object({
  name: z.string().min(2, "Account name is required"),
  type: z.enum(["debit", "credit"]),
  description: z.string().optional(),
  createdViaVoice: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

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
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const defaultValues: FormValues = {
    name: "",
    type: "debit",
    description: "",
    createdViaVoice: false,
  };

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts,
  });

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: async () => {
      Toast.show({ type: "success", text1: "Account added" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      setModalVisible(false);
      setSelectedAccount(null);
      reset(defaultValues);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: async () => {
      Toast.show({ type: "success", text1: "Account updated" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      setModalVisible(false);
      setSelectedAccount(null);
      reset(defaultValues);
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
    defaultValues,
  });

  const openModal = (account?: Account) => {
    if (account) {
      setSelectedAccount(account);
      reset({
        name: account.name,
        type: account.type,
        description: account.description ?? "",
      });
    } else {
      setSelectedAccount(null);
      reset(defaultValues);
    }
    setModalVisible(true);
  };

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

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 pt-16 pb-6 border-b border-gray-100">
        <View className="flex-row justify-between items-center">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-gray-900">Accounts</Text>
            <Text className="text-gray-600 text-base mt-1">
              Manage your credit and debit accounts
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => openModal()}
            className="bg-blue-500 px-5 py-3 rounded-xl shadow-sm"
            style={{
              shadowColor: '#3b82f6',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="add" size={18} color="white" />
              <Text className="text-white font-bold">Add Account</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={accountsQuery.data ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 20, gap: 16 }}
        ListEmptyComponent={
          accountsQuery.isLoading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 48 }} />
          ) : (
            <View className="items-center mt-16 gap-4 bg-white rounded-2xl p-8 mx-4">
              <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center">
                <Ionicons name="wallet-outline" size={40} color="#3b82f6" />
              </View>
              <Text className="text-gray-900 text-lg font-bold">No Accounts Yet</Text>
              <Text className="text-gray-600 text-center">
                Create your first account to start tracking your finances
              </Text>
              <TouchableOpacity
                onPress={() => openModal()}
                className="bg-blue-500 px-6 py-3 rounded-xl mt-2"
              >
                <Text className="text-white font-bold">Create Account</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openModal(item)}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View className="flex-row justify-between items-start">
              <View className="flex-1 mr-4">
                <View className="flex-row items-center gap-3">
                  <View className={`w-4 h-4 rounded-full ${
                    item.type === 'credit' ? 'bg-green-500' : 'bg-blue-500'
                  }`} />
                  <Text className="text-gray-900 text-xl font-bold">
                    {item.name}
                  </Text>
                </View>
                <View className={`px-3 py-1 rounded-full mt-2 self-start ${
                  item.type === 'credit' ? 'bg-green-50' : 'bg-blue-50'
                }`}>
                  <Text className={`text-xs font-bold uppercase ${
                    item.type === 'credit' ? 'text-green-700' : 'text-blue-700'
                  }`}>
                    {item.type} Account
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-gray-500 text-sm font-medium">Balance</Text>
                <Text className={`text-2xl font-bold ${
                  item.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${Math.abs(item.balance).toFixed(2)}
                </Text>
              </View>
            </View>
            {item.description ? (
              <Text className="text-gray-600 text-sm mt-4 leading-5">
                {item.description}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6 gap-6 max-h-[85%]">
            {/* Header */}
            <View className="flex-row justify-between items-center pb-2 border-b border-gray-100">
              <View>
                <Text className="text-gray-900 text-2xl font-bold">
                  {selectedAccount ? "Edit Account" : "New Account"}
                </Text>
                <Text className="text-gray-500 text-sm">
                  {selectedAccount ? "Update account details" : "Create a new account to track"}
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
                      className="bg-gray-50 text-gray-900 px-4 py-3 rounded-xl border border-gray-200 text-base"
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
                <Text className="text-gray-700 text-sm font-semibold mb-3">Account Type</Text>
                <Controller
                  control={control}
                  name="type"
                  render={({ field: { value, onChange } }) => (
                    <View className="flex-row gap-3">
                      {(["debit", "credit"] as const).map((option) => (
                        <TouchableOpacity
                          key={option}
                          onPress={() => onChange(option)}
                          className={`flex-1 py-4 rounded-xl border-2 ${
                            value === option
                              ? option === 'debit'
                                ? "border-blue-500 bg-blue-50"
                                : "border-green-500 bg-green-50"
                              : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          <View className="items-center gap-2">
                            <Ionicons 
                              name={option === 'debit' ? "card-outline" : "cash-outline"} 
                              size={24} 
                              color={
                                value === option
                                  ? option === 'debit' ? "#3b82f6" : "#10b981"
                                  : "#6b7280"
                              } 
                            />
                            <Text
                              className={`font-bold text-sm ${
                                value === option
                                  ? option === 'debit'
                                    ? "text-blue-700"
                                    : "text-green-700"
                                  : "text-gray-600"
                              }`}
                            >
                              {option.toUpperCase()}
                            </Text>
                            <Text className={`text-xs text-center ${
                              value === option
                                ? option === 'debit'
                                  ? "text-blue-600"
                                  : "text-green-600"
                                : "text-gray-500"
                            }`}>
                              {option === 'debit' ? 'Money going out' : 'Money coming in'}
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
                <Text className="text-gray-700 text-sm font-semibold mb-2">Description</Text>
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      value={value || ""}
                      onChangeText={onChange}
                      placeholder="Optional details about this account..."
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

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSubmit(onSubmit)}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-blue-500 rounded-2xl py-4 mt-2 items-center shadow-lg shadow-blue-500/25"
                style={{
                  shadowColor: '#3b82f6',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Ionicons 
                      name={selectedAccount ? "checkmark-circle" : "add-circle"} 
                      size={20} 
                      color="white" 
                    />
                    <Text className="text-white font-bold text-base">
                      {selectedAccount ? "Update Account" : "Create Account"}
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
