import { Text, View } from "react-native";
import type { Party } from "@/types/party";

type PartyBusinessDetailsProps = {
  party: Party;
  formatBalance: (balance: number) => string;
};

export function PartyBusinessDetails({
  party,
  formatBalance,
}: PartyBusinessDetailsProps) {
  return (
    <View className="bg-white p-4 mt-3 border-y border-gray-100">
      <Text className="text-sm font-semibold text-gray-900 mb-3">
        Business Details
      </Text>

      <View className="flex-row">
        <View className="flex-1 pr-2">
          <Text className="text-sm text-gray-500">Tax ID</Text>
          <Text className="text-base text-gray-900 mt-1">
            {party.tax_id || "Not specified"}
          </Text>
        </View>
        <View className="flex-1 pl-2">
          <Text className="text-sm text-gray-500">Credit Limit</Text>
          <Text className="text-base text-gray-900 mt-1">
            {party.credit_limit
              ? party.credit_limit.toLocaleString()
              : "No limit"}
          </Text>
        </View>
      </View>

      <View className="flex-row mt-4">
        <View className="flex-1 pr-2">
          <Text className="text-sm text-gray-500">Payment Terms</Text>
          <Text className="text-base text-gray-900 mt-1">
            {party.payment_terms_days || "0"} days
          </Text>
        </View>
        <View className="flex-1 pl-2">
          <Text className="text-sm text-gray-500">Opening Balance</Text>
          <Text className="text-base text-gray-900 mt-1">
            {party.opening_balance ? formatBalance(party.opening_balance) : "0"}
          </Text>
        </View>
      </View>
    </View>
  );
}
