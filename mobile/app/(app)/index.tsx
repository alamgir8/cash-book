import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { FilterBar } from '../../components/filter-bar';
import { TransactionCard } from '../../components/transaction-card';
import { VoiceInputButton } from '../../components/voice-input-button';
import { exportTransactionsPdf } from '../../services/reports';
import {
  createTransaction,
  fetchTransactions,
  type TransactionFilters
} from '../../services/transactions';
import { fetchAccounts, type Account } from '../../services/accounts';
import { queryKeys } from '../../lib/queryKeys';
import Toast from 'react-native-toast-message';

const transactionSchema = z.object({
  accountId: z.string().min(1, 'Select an account'),
  amount: z.number().positive('Amount must be greater than zero'),
  type: z.enum(['debit', 'credit']),
  date: z.string().optional(),
  description: z.string().optional(),
  comment: z.string().optional(),
  createdViaVoice: z.boolean().optional()
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

const defaultFilters: TransactionFilters = {
  range: 'monthly',
  page: 1,
  limit: 20
};

const parseVoiceTranscript = (
  transcript: string,
  accounts: Account[]
): Partial<TransactionFormValues> => {
  const lower = transcript.toLowerCase();
  const parsed: Partial<TransactionFormValues> = {
    createdViaVoice: true,
    comment: transcript
  };

  const amountMatch = transcript.match(/(\d+(\.\d+)?)/);
  if (amountMatch) {
    parsed.amount = Number(amountMatch[1]);
  }

  if (lower.includes('credit') || lower.includes('deposit')) {
    parsed.type = 'credit';
  } else if (lower.includes('debit') || lower.includes('withdraw')) {
    parsed.type = 'debit';
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
    parsed.date = dayjs(dateMatch[0].replaceAll('/', '-')).format('YYYY-MM-DD');
  }

  return parsed;
};

export default function DashboardScreen() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters);
  const [isModalVisible, setModalVisible] = useState(false);

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts
  });

  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => fetchTransactions(filters),
    keepPreviousData: true
  });

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: async () => {
      Toast.show({ type: 'success', text1: 'Transaction recorded' });
      setModalVisible(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
      ]);
    }
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      accountId: '',
      amount: 0,
      type: 'debit',
      date: dayjs().format('YYYY-MM-DD'),
      description: '',
      comment: ''
    }
  });

  const currentAmount = watch('amount');

  const totals = useMemo(() => {
    if (!transactionsQuery.data?.transactions) return { debit: 0, credit: 0 };
    return transactionsQuery.data.transactions.reduce(
      (acc, txn) => {
        acc[txn.type] += txn.amount;
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [transactionsQuery.data?.transactions]);

  const onSubmit = async (values: TransactionFormValues) => {
    try {
      await createMutation.mutateAsync(values);
      reset({
        accountId: '',
        amount: 0,
        type: 'debit',
        date: dayjs().format('YYYY-MM-DD'),
        description: '',
        comment: '',
        createdViaVoice: false
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleVoiceResult = (transcript: string) => {
    if (!accountsQuery.data) return;
    const parsed = parseVoiceTranscript(transcript, accountsQuery.data);
    Object.entries(parsed).forEach(([key, value]) => {
      setValue(key as keyof TransactionFormValues, value as never, { shouldDirty: true });
    });
  };

  const renderHeader = () => (
    <View className="gap-4">
      <View className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800">
        <Text className="text-slate-400 text-sm">This period</Text>
        <View className="flex-row justify-between mt-3">
          <View className="flex-1">
            <Text className="text-slate-500 text-xs uppercase">Total debit</Text>
            <Text className="text-2xl font-semibold text-rose-400">
              ${totals.debit.toFixed(2)}
            </Text>
          </View>
          <View className="flex-1 items-end">
            <Text className="text-slate-500 text-xs uppercase">Total credit</Text>
            <Text className="text-2xl font-semibold text-emerald-400">
              ${totals.credit.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      <FilterBar
        filters={filters}
        onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
      />

      <TouchableOpacity
        onPress={async () => {
          try {
            await exportTransactionsPdf(filters);
            Toast.show({ type: 'success', text1: 'PDF exported' });
          } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Failed to export PDF' });
          }
        }}
        className="flex-row items-center justify-center gap-2 bg-slate-900/60 border border-slate-700 rounded-2xl py-3"
      >
        <Ionicons name="document-text-outline" size={20} color="#38bdf8" />
        <Text className="text-slate-100 font-medium">Export filtered transactions</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-primary">
      <FlatList
        data={transactionsQuery.data?.transactions ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={transactionsQuery.isRefetching}
            onRefresh={() => transactionsQuery.refetch()}
            tintColor="#38bdf8"
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          transactionsQuery.isLoading ? (
            <ActivityIndicator color="#38bdf8" style={{ marginTop: 48 }} />
          ) : (
            <View className="items-center mt-12 gap-2">
              <Ionicons name="document-text-outline" size={48} color="#334155" />
              <Text className="text-slate-500 text-center">
                No transactions found for the selected filters.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <TransactionCard transaction={item} />}
      />

      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        className="absolute right-6 bottom-32 bg-accent w-16 h-16 rounded-full items-center justify-center shadow-lg shadow-sky-500/30"
      >
        <Ionicons name="add" size={32} color="#0f172a" />
      </TouchableOpacity>

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-950 rounded-t-3xl p-6 gap-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-white text-xl font-semibold">Add transaction</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View className="gap-3">
              <Text className="text-slate-400 text-xs">Account</Text>
              <View className="flex-row flex-wrap gap-2">
                {accountsQuery.data?.map((account) => {
                  const selected = watch('accountId') === account._id;
                  return (
                    <TouchableOpacity
                      key={account._id}
                      onPress={() => setValue('accountId', account._id, { shouldValidate: true })}
                      className={`px-3 py-2 rounded-xl border ${
                        selected ? 'border-accent bg-accent/20' : 'border-slate-800 bg-slate-900'
                      }`}
                    >
                      <Text className={`text-sm ${selected ? 'text-accent' : 'text-slate-200'}`}>
                        {account.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.accountId ? (
                <Text className="text-red-400 text-sm">{errors.accountId.message}</Text>
              ) : null}

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-slate-400 text-xs mb-1">Amount</Text>
                  <Controller
                    control={control}
                    name="amount"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={String(value || '')}
                        onChangeText={(text) => onChange(Number(text.replace(/[^0-9.]/g, '')) || 0)}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#64748b"
                        className="bg-slate-900 text-white px-3 py-2 rounded-xl border border-slate-800"
                      />
                    )}
                  />
                  {errors.amount ? (
                    <Text className="text-red-400 text-sm mt-1">{errors.amount.message}</Text>
                  ) : null}
                </View>
                <View className="flex-1">
                  <Text className="text-slate-400 text-xs mb-1">Type</Text>
                  <Controller
                    control={control}
                    name="type"
                    render={({ field: { value, onChange } }) => (
                      <View className="flex-row gap-2">
                        {(['debit', 'credit'] as const).map((option) => (
                          <TouchableOpacity
                            key={option}
                            onPress={() => onChange(option)}
                            className={`flex-1 py-2 rounded-xl border ${
                              value === option
                                ? 'border-accent bg-accent/20'
                                : 'border-slate-800 bg-slate-900'
                            }`}
                          >
                            <Text
                              className={`text-center font-medium ${
                                value === option ? 'text-accent' : 'text-slate-200'
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

              <View>
                <Text className="text-slate-400 text-xs mb-1">Date (YYYY-MM-DD)</Text>
                <Controller
                  control={control}
                  name="date"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="2024-05-01"
                      placeholderTextColor="#64748b"
                      className="bg-slate-900 text-white px-3 py-2 rounded-xl border border-slate-800"
                    />
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
                      value={value || ''}
                      onChangeText={onChange}
                      placeholder="What is this transaction about?"
                      placeholderTextColor="#64748b"
                      className="bg-slate-900 text-white px-3 py-2 rounded-xl border border-slate-800"
                    />
                  )}
                />
              </View>

              <View>
                <Text className="text-slate-400 text-xs mb-1">Comment</Text>
                <Controller
                  control={control}
                  name="comment"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      value={value || ''}
                      onChangeText={onChange}
                      placeholder="Additional notes"
                      placeholderTextColor="#64748b"
                      className="bg-slate-900 text-white px-3 py-2 rounded-xl border border-slate-800"
                      multiline
                    />
                  )}
                />
              </View>

              <VoiceInputButton onResult={handleVoiceResult} />

              {currentAmount > 0 ? (
                <Text className="text-slate-500 text-xs text-right">
                  Amount preview: ${currentAmount.toFixed(2)}
                </Text>
              ) : null}

              <TouchableOpacity
                onPress={handleSubmit(onSubmit)}
                disabled={createMutation.isPending}
                className="bg-accent rounded-2xl py-3 mt-2 items-center"
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text className="text-primary font-semibold text-base">Save transaction</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
