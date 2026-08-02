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
import { formatPartyBalance } from "@/lib/party-utils";
import { useTheme } from "@/hooks/use-theme";
import { useDeleteMode } from "@/hooks/use-delete-mode";
import { toast } from "@/lib/toast";
import { safeGoBack } from "@/lib/navigation";

export default function PartyDetailScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { isDeleteModeActive } = useDeleteMode();

  const { data: party, isLoading } = useParty(partyId!);
  const deleteMutation = useDeleteParty();

  const goBack = () => safeGoBack("/(app)/parties", router);

  const handleDelete = () => {
    if (!party) return;

    Alert.alert(
      "Delete party?",
      `Remove "${party.name}"?\n\nIf it has linked transactions, you'll need to merge or delete those first.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteMutation.mutateAsync(partyId!);
                goBack();
              } catch (error: any) {
                const data = error?.response?.data;
                if (data?.canMerge || data?.transactionCount > 0) {
                  Alert.alert(
                    "Cannot delete",
                    data?.message ||
                      `"${party.name}" has linked transactions. Go back and use Merge on the Customers & Suppliers screen.`,
                  );
                } else {
                  toast.error(
                    "Failed to delete party",
                    data?.message || error?.message,
                  );
                }
              }
            })();
          },
        },
      ],
    );
  };

  const handleViewLedger = () => {
    router.push(`/(app)/parties/${partyId}/ledger` as any);
  };

  const handleNewInvoice = () => {
    router.push(`/(app)/invoices/create?partyId=${partyId}` as any);
  };

  const handleEdit = () => {
    router.push(`/(app)/parties/${partyId}/edit` as any);
  };

  if (isLoading || !party) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <ScreenHeader
          title="Party Details"
          showBack
          onBack={goBack}
        />
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
        onBack={goBack}
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

        {/* Delete Button — only in Delete Mode */}
        {isDeleteModeActive ? (
          <View className="p-4">
            <TouchableOpacity
              className="py-4 rounded-xl border"
              style={{
                backgroundColor: colors.error + "18",
                borderColor: colors.error + "55",
              }}
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Text
                className="text-center font-medium"
                style={{ color: colors.error }}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Party"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
