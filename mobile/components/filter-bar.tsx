import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TransactionFilters } from '../services/transactions';

const ranges = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' }
];

type Props = {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
};

export const FilterBar = ({ filters, onChange }: Props) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
        {ranges.map((range) => (
          <TouchableOpacity
            key={range.value}
            onPress={() => onChange({ ...filters, range: range.value, page: 1 })}
            className={`px-3 py-1.5 rounded-full border ${
              filters.range === range.value
                ? 'bg-accent/20 border-accent'
                : 'border-slate-700 bg-slate-900/40'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                filters.range === range.value ? 'text-accent' : 'text-slate-300'
              }`}
            >
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => setExpanded((prev) => !prev)}
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/40"
        >
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#38bdf8" />
          <Text className="text-slate-300 text-sm font-medium">More</Text>
        </TouchableOpacity>
      </ScrollView>

      {expanded ? (
        <View className="mt-4 gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-xs text-slate-400 mb-1">Start date (YYYY-MM-DD)</Text>
              <TextInput
                value={filters.startDate ?? ''}
                onChangeText={(value) => onChange({ ...filters, startDate: value })}
                placeholder="2024-01-01"
                placeholderTextColor="#64748b"
                className="bg-slate-950/70 text-slate-100 px-3 py-2 rounded-xl border border-slate-800"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-slate-400 mb-1">End date</Text>
              <TextInput
                value={filters.endDate ?? ''}
                onChangeText={(value) => onChange({ ...filters, endDate: value })}
                placeholder="2024-01-31"
                placeholderTextColor="#64748b"
                className="bg-slate-950/70 text-slate-100 px-3 py-2 rounded-xl border border-slate-800"
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-xs text-slate-400 mb-1">Account</Text>
              <TextInput
                value={filters.accountName ?? ''}
                onChangeText={(value) => onChange({ ...filters, accountName: value, page: 1 })}
                placeholder="Search account name"
                placeholderTextColor="#64748b"
                className="bg-slate-950/70 text-slate-100 px-3 py-2 rounded-xl border border-slate-800"
              />
            </View>
            <View className="flex-1 flex-row gap-2">
              <TextInput
                value={filters.minAmount ? String(filters.minAmount) : ''}
                onChangeText={(value) =>
                  onChange({ ...filters, minAmount: value ? Number(value) : undefined })
                }
                keyboardType="numeric"
                placeholder="Min"
                placeholderTextColor="#64748b"
                className="flex-1 bg-slate-950/70 text-slate-100 px-3 py-2 rounded-xl border border-slate-800"
              />
              <TextInput
                value={filters.maxAmount ? String(filters.maxAmount) : ''}
                onChangeText={(value) =>
                  onChange({ ...filters, maxAmount: value ? Number(value) : undefined })
                }
                keyboardType="numeric"
                placeholder="Max"
                placeholderTextColor="#64748b"
                className="flex-1 bg-slate-950/70 text-slate-100 px-3 py-2 rounded-xl border border-slate-800"
              />
            </View>
          </View>

          <TextInput
            value={filters.search ?? ''}
            onChangeText={(value) => onChange({ ...filters, search: value, page: 1 })}
            placeholder="Search description or comment"
            placeholderTextColor="#64748b"
            className="bg-slate-950/70 text-slate-100 px-3 py-2 rounded-xl border border-slate-800"
          />
        </View>
      ) : null}
    </View>
  );
};
