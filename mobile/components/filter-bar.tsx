import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TransactionFilters } from "../services/transactions";

const ranges = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

type Props = {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
};

export const FilterBar = ({ filters, onChange }: Props) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-row gap-3"
      >
        {ranges.map((range) => (
          <TouchableOpacity
            key={range.value}
            onPress={() =>
              onChange({ ...filters, range: range.value, page: 1 })
            }
            className={`px-4 py-2 rounded-full border-2 ${
              filters.range === range.value
                ? "bg-blue-50 border-blue-500"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                filters.range === range.value
                  ? "text-blue-700"
                  : "text-gray-600"
              }`}
            >
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => setExpanded((prev) => !prev)}
          className="flex-row items-center gap-1 px-4 py-2 rounded-full border-2 border-gray-200 bg-gray-50"
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color="#3b82f6"
          />
          <Text className="text-gray-600 text-sm font-semibold">Filters</Text>
        </TouchableOpacity>
      </ScrollView>

      {expanded ? (
        <View className="mt-4 gap-4">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-gray-700 text-sm font-semibold mb-2">
                Start Date
              </Text>
              <TextInput
                value={filters.startDate ?? ""}
                onChangeText={(value) =>
                  onChange({ ...filters, startDate: value })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 text-gray-900 px-3 py-3 rounded-xl border border-gray-200"
              />
            </View>
            <View className="flex-1">
              <Text className="text-gray-700 text-sm font-semibold mb-2">
                End Date
              </Text>
              <TextInput
                value={filters.endDate ?? ""}
                onChangeText={(value) =>
                  onChange({ ...filters, endDate: value })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 text-gray-900 px-3 py-3 rounded-xl border border-gray-200"
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-gray-700 text-sm font-semibold mb-2">
                Account Name
              </Text>
              <TextInput
                value={filters.accountName ?? ""}
                onChangeText={(value) =>
                  onChange({ ...filters, accountName: value, page: 1 })
                }
                placeholder="Search account..."
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 text-gray-900 px-3 py-3 rounded-xl border border-gray-200"
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-gray-700 text-sm font-semibold mb-2">
                Amount Range
              </Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={filters.minAmount ? String(filters.minAmount) : ""}
                  onChangeText={(value) =>
                    onChange({
                      ...filters,
                      minAmount: value ? Number(value) : undefined,
                    })
                  }
                  keyboardType="numeric"
                  placeholder="Min"
                  placeholderTextColor="#9ca3af"
                  className="flex-1 bg-gray-50 text-gray-900 px-3 py-3 rounded-xl border border-gray-200"
                />
                <TextInput
                  value={filters.maxAmount ? String(filters.maxAmount) : ""}
                  onChangeText={(value) =>
                    onChange({
                      ...filters,
                      maxAmount: value ? Number(value) : undefined,
                    })
                  }
                  keyboardType="numeric"
                  placeholder="Max"
                  placeholderTextColor="#9ca3af"
                  className="flex-1 bg-gray-50 text-gray-900 px-3 py-3 rounded-xl border border-gray-200"
                />
              </View>
            </View>
          </View>

          <View>
            <Text className="text-gray-700 text-sm font-semibold mb-2">
              Search Keywords
            </Text>
            <TextInput
              value={filters.search ?? ""}
              onChangeText={(value) =>
                onChange({ ...filters, search: value, page: 1 })
              }
              placeholder="Search description or comments..."
              placeholderTextColor="#9ca3af"
              className="bg-gray-50 text-gray-900 px-3 py-3 rounded-xl border border-gray-200"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
};
