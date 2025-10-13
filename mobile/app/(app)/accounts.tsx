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
    <View className="flex-1 bg-primary">
      <View className="flex-row justify-between items-center px-6 pt-16 pb-4">
        <View>
          <Text className="text-2xl font-semibold text-white">Accounts</Text>
          <Text className="text-slate-400 text-sm">
            Manage credit and debit accounts for your business.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => openModal()}
          className="bg-accent px-4 py-2 rounded-xl"
        >
          <Text className="text-primary font-semibold">Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={accountsQuery.data ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 20, gap: 16 }}
        ListEmptyComponent={
          accountsQuery.isLoading ? (
            <ActivityIndicator color="#38bdf8" style={{ marginTop: 48 }} />
          ) : (
            <View className="items-center mt-12 gap-2">
              <Ionicons name="wallet-outline" size={48} color="#334155" />
              <Text className="text-slate-500 text-center">
                Start by adding your first account.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openModal(item)}
            className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800"
          >
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-white text-lg font-semibold">
                  {item.name}
                </Text>
                <Text className="text-slate-400 text-xs mt-1 uppercase">
                  {item.type}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-slate-500 text-xs">Balance</Text>
                <Text className="text-emerald-400 text-xl font-semibold">
                  ${item.balance.toFixed(2)}
                </Text>
              </View>
            </View>
            {item.description ? (
              <Text className="text-slate-400 text-sm mt-3">
                {item.description}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-950 rounded-t-3xl p-6 gap-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-white text-xl font-semibold">
                {selectedAccount ? "Edit account" : "Create account"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-slate-400 text-xs mb-1">
                  Account name
                </Text>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="e.g. Business Checking"
                      placeholderTextColor="#64748b"
                      className="bg-slate-900 text-white px-3 py-2 rounded-xl border border-slate-800"
                    />
                  )}
                />
                {errors.name ? (
                  <Text className="text-red-400 text-sm mt-1">
                    {errors.name.message}
                  </Text>
                ) : null}
              </View>

              <View>
                <Text className="text-slate-400 text-xs mb-1">Type</Text>
                <Controller
                  control={control}
                  name="type"
                  render={({ field: { value, onChange } }) => (
                    <View className="flex-row gap-2">
                      {(["debit", "credit"] as const).map((option) => (
                        <TouchableOpacity
                          key={option}
                          onPress={() => onChange(option)}
                          className={`flex-1 py-2 rounded-xl border ${
                            value === option
                              ? "border-accent bg-accent/20"
                              : "border-slate-800 bg-slate-900"
                          }`}
                        >
                          <Text
                            className={`text-center font-medium ${
                              value === option
                                ? "text-accent"
                                : "text-slate-200"
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

              <View>
                <Text className="text-slate-400 text-xs mb-1">Description</Text>
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      value={value || ""}
                      onChangeText={onChange}
                      placeholder="Optional details about this account"
                      placeholderTextColor="#64748b"
                      className="bg-slate-900 text-white px-3 py-2 rounded-xl border border-slate-800"
                      multiline
                    />
                  )}
                />
              </View>

              <VoiceInputButton onResult={handleVoiceResult} />

              <TouchableOpacity
                onPress={handleSubmit(onSubmit)}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-accent rounded-2xl py-3 mt-2 items-center"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text className="text-primary font-semibold text-base">
                    {selectedAccount ? "Update account" : "Save account"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
