import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import {
  PartyHeaderCard,
  PartyBalanceCard,
  PartyQuickActions,
  PartyContactInfo,
  PartyBusinessDetails,
} from "@/components/parties";
import { useParty, useDeleteParty } from "@/hooks/use-parties";
import { formatPartyBalance, getPartyBalanceColor } from "@/lib/party-utils";
import { useTheme } from "@/hooks/useTheme";

export default function PartyDetailScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const { data: party, isLoading } = useParty(partyId!);
  const deleteMutation = useDeleteParty();

  const handleDelete = () => {
    if (!party) return;

    Alert.alert(
      "Delete Party",
      `Are you sure you want to delete "${party.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(partyId!, {
              onSuccess: () => router.back(),
            });
          },
        },
      ],
    );
  };

  const handleViewLedger = () => {
    router.push(`/parties/${partyId}/ledger`);
  };

  const handleNewInvoice = () => {
    router.push(`/invoices/new?partyId=${partyId}`);
  };

  const handleEdit = () => {
    router.push(`/parties/${partyId}/edit`);
  };

  if (isLoading || !party) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <ScreenHeader title="Party Details" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Party Details"
        showBack
        rightAction={
          <TouchableOpacity className="p-2" onPress={handleEdit}>
            <Ionicons name="pencil" size={22} color={colors.info} />
          </TouchableOpacity>
        }
      />

      <ScrollView className="flex-1">
        {/* Header Card */}
        <PartyHeaderCard party={party} onEdit={handleEdit} />

        {/* Balance */}
        <View
          className="px-6 pb-6 border-b"
          style={{
            backgroundColor: colors.bg.secondary,
            borderColor: colors.border,
          }}
        >
          <PartyBalanceCard
            balance={party.current_balance}
            formatBalance={formatPartyBalance}
            getBalanceColor={getPartyBalanceColor}
          />

          {/* Quick Actions */}
          <PartyQuickActions
            onViewLedger={handleViewLedger}
            onNewInvoice={handleNewInvoice}
          />
        </View>

        {/* Contact Info */}
        <PartyContactInfo party={party} />

        {/* Business Info */}
        <PartyBusinessDetails
          party={party}
          formatBalance={formatPartyBalance}
        />

        {/* Notes */}
        {party.notes && (
          <View
            className="p-4 mt-3 border-y"
            style={{
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
            }}
          >
            <Text
              className="text-sm font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              Notes
            </Text>
            <Text
              className="text-base"
              style={{ color: colors.text.secondary }}
            >
              {party.notes}
            </Text>
          </View>
        )}

        {/* Meta Info */}
        <View
          className="p-4 mt-3 border-y"
          style={{
            backgroundColor: colors.bg.secondary,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row">
            <View className="flex-1">
              <Text
                className="text-sm"
                style={{ color: colors.text.secondary }}
              >
                Created
              </Text>
              <Text
                className="text-sm mt-1"
                style={{ color: colors.text.primary }}
              >
                {new Date(party.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                className="text-sm"
                style={{ color: colors.text.secondary }}
              >
                Last Updated
              </Text>
              <Text
                className="text-sm mt-1"
                style={{ color: colors.text.primary }}
              >
                {new Date(party.updatedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Delete Button */}
        <View className="p-4">
          <TouchableOpacity
            className="py-4 bg-red-50 rounded-xl border border-red-200"
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Text className="text-center text-red-600 font-medium">
              {deleteMutation.isPending ? "Deleting..." : "Delete Party"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
