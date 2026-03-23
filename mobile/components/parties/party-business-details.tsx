import { Text, View } from "react-native";
import type { Party } from "@/types/party";
import { useTheme } from "@/hooks/useTheme";

type PartyBusinessDetailsProps = {
  party: Party;
  formatBalance: (balance: number) => string;
};

export function PartyBusinessDetails({
  party,
  formatBalance,
}: PartyBusinessDetailsProps) {
  const { colors } = useTheme();

  return (
    <View className="p-4 mt-3 border-y" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
      <Text className="text-sm font-semibold mb-3" style={{ color: colors.text.primary }}>
        Business Details
      </Text>

      <View className="flex-row">
        <View className="flex-1 pr-2">
          <Text className="text-sm" style={{ color: colors.text.tertiary }}>Tax ID</Text>
          <Text className="text-base mt-1" style={{ color: colors.text.primary }}>
            {party.tax_id || "Not specified"}
          </Text>
        </View>
        <View className="flex-1 pl-2">
          <Text className="text-sm" style={{ color: colors.text.tertiary }}>Credit Limit</Text>
          <Text className="text-base mt-1" style={{ color: colors.text.primary }}>
            {party.credit_limit
              ? party.credit_limit.toLocaleString()
              : "No limit"}
          </Text>
        </View>
      </View>

      <View className="flex-row mt-4">
        <View className="flex-1 pr-2">
          <Text className="text-sm" style={{ color: colors.text.tertiary }}>Payment Terms</Text>
          <Text className="text-base mt-1" style={{ color: colors.text.primary }}>
            {party.payment_terms_days || "0"} days
          </Text>
        </View>
        <View className="flex-1 pl-2">
          <Text className="text-sm" style={{ color: colors.text.tertiary }}>Opening Balance</Text>
          <Text className="text-base mt-1" style={{ color: colors.text.primary }}>
            {party.opening_balance ? formatBalance(party.opening_balance) : "0"}
          </Text>
        </View>
      </View>
    </View>
  );
}
