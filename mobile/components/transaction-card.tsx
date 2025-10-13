import { View, Text } from 'react-native';
import dayjs from 'dayjs';
import type { Transaction } from '../services/transactions';

type Props = {
  transaction: Transaction;
};

export const TransactionCard = ({ transaction }: Props) => {
  const isCredit = transaction.type === 'credit';
  const amountColor = isCredit ? 'text-emerald-400' : 'text-rose-400';

  return (
    <View className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800">
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-slate-200 font-semibold text-lg">
            {transaction.account?.name ?? 'N/A'}
          </Text>
          <Text className="text-slate-500 text-xs">
            {dayjs(transaction.date).format('MMM D, YYYY')}
          </Text>
        </View>
        <Text className={`text-xl font-semibold ${amountColor}`}>
          {isCredit ? '+' : '-'}${transaction.amount.toFixed(2)}
        </Text>
      </View>

      {transaction.description ? (
        <Text className="text-slate-300 mt-3 text-sm">{transaction.description}</Text>
      ) : null}

      <View className="flex-row justify-between items-center mt-4">
        <Text className="text-xs text-slate-500 uppercase tracking-wide">
          {transaction.type} · {transaction.account?.type}
        </Text>
        {transaction.createdViaVoice ? (
          <Text className="text-xs text-accent font-medium">Voice entry</Text>
        ) : null}
      </View>
    </View>
  );
};
