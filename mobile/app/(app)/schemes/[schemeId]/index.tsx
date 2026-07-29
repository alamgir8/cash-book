import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Keyboard,
  Platform,
  Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { SearchableSelect } from "@/components/searchable-select";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import { usePreferences } from "@/hooks/use-preferences";
import { useActiveOrgId } from "@/hooks/use-organization";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useScheme,
  useSchemeRoster,
  useSchemeMemberPayments,
  useEnrollMember,
  useRecordSchemePayment,
  useRemoveSchemeMember,
  useUpdateSchemeMember,
} from "@/hooks/use-schemes";
import { partiesApi } from "@/services/parties";
import { fetchAccounts } from "@/services/accounts";
import { QUERY_KEYS } from "@/lib/queryKeys";
import {
  amountInputProps,
  normalizeAmountInput,
  parseAmountInput,
} from "@/lib/amount-input";
import type { SchemeRosterMember, SchemeMemberStatus } from "@/services/schemes";

type StatusFilter = "all" | SchemeMemberStatus;

const statusColor = (
  status: SchemeMemberStatus,
  colors: { success: string; warning: string; error: string },
) => {
  if (status === "paid") return colors.success;
  if (status === "partial") return colors.warning;
  return colors.error;
};

export default function SchemeDetailScreen() {
  const { schemeId } = useLocalSearchParams<{ schemeId: string }>();
  const id = Array.isArray(schemeId) ? schemeId[0] : schemeId;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { formatAmount } = usePreferences();
  const orgId = useActiveOrgId();
  const insets = useSafeAreaInsets();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] =
    useState<SchemeRosterMember | null>(null);

  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollPartyId, setEnrollPartyId] = useState("");
  const [enrollMembers, setEnrollMembers] = useState("1");
  const [enrollNotes, setEnrollNotes] = useState("");

  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [payNote, setPayNote] = useState("");
  const [editCountMember, setEditCountMember] =
    useState<SchemeRosterMember | null>(null);
  const [editCountValue, setEditCountValue] = useState("1");

  const { data: schemeData, isLoading: schemeLoading } = useScheme(id);
  const {
    data: rosterData,
    isLoading: rosterLoading,
    refetch,
    isRefetching,
  } = useSchemeRoster(id, {
    status: statusFilter,
    search: search.trim() || undefined,
  });

  const {
    data: paymentsData,
    isLoading: paymentsLoading,
    refetch: refetchPayments,
  } = useSchemeMemberPayments(id, selectedMember?._id);

  const enrollMutation = useEnrollMember(id!);
  const payMutation = useRecordSchemePayment(id!);
  const removeMutation = useRemoveSchemeMember(id!);
  const updateMemberMutation = useUpdateSchemeMember(id!);

  const { data: partiesPage } = useQuery({
    queryKey: [...QUERY_KEYS.parties, "scheme-enroll", orgId ?? "personal"],
    queryFn: () =>
      partiesApi.list({
        organization: orgId || undefined,
        limit: 200,
        archived: false,
      }),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: QUERY_KEYS.accounts,
    queryFn: fetchAccounts,
  });

  const partyOptions = useMemo(() => {
    const enrolled = new Set(
      (rosterData?.members ?? []).map((m) => m.party._id),
    );
    return (partiesPage?.parties ?? [])
      .filter((p) => !enrolled.has(p._id))
      .map((p) => ({ value: p._id, label: p.name }));
  }, [partiesPage, rosterData?.members]);

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a._id, label: a.name })),
    [accounts],
  );

  const scheme = schemeData?.scheme;
  const summary = rosterData?.summary ?? schemeData?.summary;
  const members = rosterData?.members ?? [];

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "paid", label: t("statusPaid") },
    { key: "partial", label: t("statusPartial") },
    { key: "due", label: t("statusDue") },
  ];

  const handleEnroll = async () => {
    const count = Number(enrollMembers);
    if (!enrollPartyId) {
      Toast.show({ type: "error", text1: t("selectFamilyRequired") });
      return;
    }
    if (!Number.isFinite(count) || count < 1) {
      Toast.show({ type: "error", text1: t("memberCountRequired") });
      return;
    }
    try {
      await enrollMutation.mutateAsync({
        party: enrollPartyId,
        member_count: count,
        notes: enrollNotes.trim() || undefined,
      });
      setShowEnroll(false);
      setEnrollPartyId("");
      setEnrollMembers("1");
      setEnrollNotes("");
      Toast.show({ type: "success", text1: t("familyEnrolled") });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: t("enrollFailed"),
        text2: error?.response?.data?.message || error?.message,
      });
    }
  };

  const openPay = (member: SchemeRosterMember) => {
    setSelectedMember(member);
    setPayAmount(member.due > 0 ? String(member.due) : "");
    setPayAccountId(accountOptions[0]?.value || "");
    setPayNote("");
    setShowPay(true);
  };

  const handlePay = async () => {
    if (!selectedMember) return;
    const amount = parseAmountInput(payAmount);
    if (amount <= 0) {
      Toast.show({ type: "error", text1: t("amountRequired") });
      return;
    }
    if (!payAccountId) {
      Toast.show({ type: "error", text1: t("selectAccount") });
      return;
    }
    try {
      await payMutation.mutateAsync({
        party: selectedMember.party._id,
        amount,
        accountId: payAccountId,
        description: payNote.trim() || undefined,
        organization: orgId || undefined,
      });
      setShowPay(false);
      Toast.show({ type: "success", text1: t("paymentRecorded") });
      void refetchPayments();
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: t("paymentFailed"),
        text2: error?.response?.data?.message || error?.message,
      });
    }
  };

  const handleRemove = (member: SchemeRosterMember) => {
    Alert.alert(
      t("removeFromScheme"),
      t("removeFromSchemeConfirm", { name: member.party.name }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("removeLabel"),
          style: "destructive",
          onPress: () => {
            removeMutation.mutate(member._id, {
              onSuccess: () => {
                if (selectedMember?._id === member._id) setSelectedMember(null);
                Toast.show({ type: "success", text1: t("memberRemoved") });
              },
            });
          },
        },
      ],
    );
  };

  const handleEditCount = (member: SchemeRosterMember) => {
    setEditCountMember(member);
    setEditCountValue(String(member.member_count));
  };

  const saveEditCount = async () => {
    if (!editCountMember) return;
    const count = Number(editCountValue);
    if (!Number.isFinite(count) || count < 1) {
      Toast.show({ type: "error", text1: t("memberCountRequired") });
      return;
    }
    try {
      await updateMemberMutation.mutateAsync({
        memberId: editCountMember._id,
        member_count: count,
      });
      setEditCountMember(null);
      Toast.show({ type: "success", text1: t("memberUpdated") });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: t("memberUpdateFailed"),
        text2: error?.response?.data?.message || error?.message,
      });
    }
  };

  const renderMember = useCallback(
    ({ item }: { item: SchemeRosterMember }) => {
      const badge = statusColor(item.status, colors);
      const selected = selectedMember?._id === item._id;
      return (
        <TouchableOpacity
          onPress={() =>
            setSelectedMember((prev) =>
              prev?._id === item._id ? null : item,
            )
          }
          onLongPress={() => handleRemove(item)}
          className="rounded-2xl p-4 mb-3 border"
          style={{
            backgroundColor: colors.bg.secondary,
            borderColor: selected ? colors.info : colors.border,
          }}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text
                className="text-base font-bold"
                style={{ color: colors.text.primary }}
              >
                {item.party.name}
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors.text.secondary }}
              >
                {t("membersLabel")}: {item.member_count} · {t("expected")}:{" "}
                {formatAmount(item.expected)}
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors.text.secondary }}
              >
                {t("paid")}: {formatAmount(item.paid)} · {t("due")}:{" "}
                {formatAmount(item.due)}
              </Text>
            </View>
            <View
              className="px-2 py-1 rounded-full"
              style={{ backgroundColor: badge + "22" }}
            >
              <Text className="text-xs font-semibold" style={{ color: badge }}>
                {item.status === "paid"
                  ? t("statusPaid")
                  : item.status === "partial"
                    ? t("statusPartial")
                    : t("statusDue")}
              </Text>
            </View>
          </View>

          {selected ? (
            <View className="mt-3 pt-3 border-t" style={{ borderColor: colors.border }}>
              <View className="flex-row gap-2 mb-3">
                <TouchableOpacity
                  onPress={() => openPay(item)}
                  className="flex-1 py-2 rounded-xl items-center"
                  style={{ backgroundColor: colors.info }}
                >
                  <Text className="text-white text-sm font-semibold">
                    {t("recordPayment")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleEditCount(item)}
                  className="px-3 py-2 rounded-xl items-center"
                  style={{ backgroundColor: colors.bg.tertiary }}
                >
                  <Ionicons name="people-outline" size={18} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              {paymentsLoading && selectedMember?._id === item._id ? (
                <ActivityIndicator color={colors.info} />
              ) : (
                (paymentsData?.payments ?? []).map((p) => (
                  <View
                    key={p._id}
                    className="flex-row justify-between py-2 border-b"
                    style={{ borderColor: colors.border + "80" }}
                  >
                    <Text
                      className="text-sm"
                      style={{ color: colors.text.secondary }}
                    >
                      {dayjs(p.date).format("DD MMM YYYY")}
                      {p.description ? ` · ${p.description}` : ""}
                    </Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.success }}
                    >
                      {formatAmount(p.amount)}
                    </Text>
                  </View>
                ))
              )}
              {!paymentsLoading &&
              selectedMember?._id === item._id &&
              (paymentsData?.payments?.length ?? 0) === 0 ? (
                <Text
                  className="text-xs"
                  style={{ color: colors.text.tertiary }}
                >
                  {t("noPaymentsYet")}
                </Text>
              ) : null}
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [
      colors,
      formatAmount,
      t,
      selectedMember,
      paymentsData,
      paymentsLoading,
    ],
  );

  if (schemeLoading && !scheme) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg.primary }}>
        <ActivityIndicator color={colors.info} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title={scheme?.name || t("collectionScheme")}
        subtitle={`${t("ratePerMember")}: ${formatAmount(scheme?.rate_per_member ?? 0)}`}
        showBack
        rightAction={
          <TouchableOpacity
            onPress={() => setShowEnroll(true)}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.info + "20" }}
          >
            <Ionicons name="person-add" size={20} color={colors.info} />
          </TouchableOpacity>
        }
      />

      <View className="px-4 pb-2 gap-3">
        <View className="flex-row gap-2">
          {[
            {
              label: t("families"),
              value: String(summary?.family_count ?? 0),
            },
            {
              label: t("statusPaid"),
              value: String(summary?.paid_count ?? 0),
            },
            {
              label: t("statusPartial"),
              value: String(summary?.partial_count ?? 0),
            },
            {
              label: t("statusDue"),
              value: String(summary?.due_count ?? 0),
            },
          ].map((chip) => (
            <View
              key={chip.label}
              className="flex-1 rounded-xl px-3 py-2"
              style={{ backgroundColor: colors.bg.tertiary }}
            >
              <Text className="text-xs" style={{ color: colors.text.tertiary }}>
                {chip.label}
              </Text>
              <Text
                className="text-base font-bold"
                style={{ color: colors.text.primary }}
              >
                {chip.value}
              </Text>
            </View>
          ))}
        </View>

        <View
          className="rounded-2xl p-3 border"
          style={{
            backgroundColor: colors.bg.secondary,
            borderColor: colors.border,
          }}
        >
          <Text className="text-xs" style={{ color: colors.text.secondary }}>
            {t("expected")}: {formatAmount(summary?.total_expected ?? 0)} ·{" "}
            {t("paid")}: {formatAmount(summary?.total_paid ?? 0)} · {t("due")}:{" "}
            {formatAmount(summary?.total_due ?? 0)}
          </Text>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("searchFamilies")}
          placeholderTextColor={colors.text.tertiary}
          className="rounded-xl px-4 py-3 border"
          style={{
            color: colors.text.primary,
            borderColor: colors.border,
            backgroundColor: colors.bg.secondary,
          }}
        />

        <View className="flex-row gap-2">
          {filters.map((f) => {
            const active = statusFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setStatusFilter(f.key)}
                className="flex-1 py-2 rounded-full items-center"
                style={{
                  backgroundColor: active
                    ? colors.info
                    : colors.bg.tertiary,
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color: active ? "#fff" : colors.text.secondary,
                  }}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {rosterLoading && members.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.info} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          renderItem={renderMember}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.info}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={t("noFamiliesInScheme")}
              description={t("noFamiliesInSchemeHint")}
            />
          }
        />
      )}

      {/* Enroll modal */}
      <Modal visible={showEnroll} animationType="slide" transparent>
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "#00000066" }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => Keyboard.dismiss()}
          />
          <KeyboardAwareScrollView
            bottomOffset={Platform.OS === "ios" ? 100 + insets.bottom : 120}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{
              backgroundColor: colors.bg.primary,
              maxHeight: Dimensions.get("window").height * 0.9,
            }}
          >
            <View
              className="rounded-t-3xl p-6 gap-4"
              style={{ backgroundColor: colors.bg.primary }}
            >
            <Text
              className="text-xl font-bold"
              style={{ color: colors.text.primary }}
            >
              {t("enrollFamily")}
            </Text>
            <SearchableSelect
              label={t("family")}
              placeholder={t("selectFamily")}
              value={enrollPartyId}
              options={partyOptions}
              onSelect={(val) => setEnrollPartyId(val || "")}
            />
            <View>
              <Text
                className="text-sm mb-2"
                style={{ color: colors.text.secondary }}
              >
                {t("memberCount")}
              </Text>
              <TextInput
                value={enrollMembers}
                onChangeText={setEnrollMembers}
                keyboardType="number-pad"
                className="rounded-xl px-4 py-3 border"
                style={{
                  color: colors.text.primary,
                  borderColor: colors.border,
                  backgroundColor: colors.bg.secondary,
                }}
              />
            </View>
            <View>
              <Text
                className="text-sm mb-2"
                style={{ color: colors.text.secondary }}
              >
                {t("notesOptional")}
              </Text>
              <TextInput
                value={enrollNotes}
                onChangeText={setEnrollNotes}
                className="rounded-xl px-4 py-3 border"
                style={{
                  color: colors.text.primary,
                  borderColor: colors.border,
                  backgroundColor: colors.bg.secondary,
                }}
              />
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowEnroll(false)}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Text style={{ color: colors.text.primary }}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleEnroll()}
                disabled={enrollMutation.isPending}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.info }}
              >
                {enrollMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">{t("enroll")}</Text>
                )}
              </TouchableOpacity>
            </View>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>

      {/* Payment modal */}
      <Modal visible={showPay} animationType="slide" transparent>
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "#00000066" }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => Keyboard.dismiss()}
          />
          <KeyboardAwareScrollView
            bottomOffset={Platform.OS === "ios" ? 100 + insets.bottom : 120}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{
              backgroundColor: colors.bg.primary,
              maxHeight: Dimensions.get("window").height * 0.9,
            }}
          >
            <View
              className="rounded-t-3xl p-6 gap-4"
              style={{ backgroundColor: colors.bg.primary }}
            >
            <Text
              className="text-xl font-bold"
              style={{ color: colors.text.primary }}
            >
              {t("recordPayment")}
            </Text>
            <Text style={{ color: colors.text.secondary }}>
              {selectedMember?.party.name}
              {selectedMember
                ? ` · ${t("due")}: ${formatAmount(selectedMember.due)}`
                : ""}
            </Text>
            <SearchableSelect
              label={t("accountFilter")}
              placeholder={t("selectAccount")}
              value={payAccountId}
              options={accountOptions}
              onSelect={(val) => setPayAccountId(val || "")}
            />
            <View>
              <Text
                className="text-sm mb-2"
                style={{ color: colors.text.secondary }}
              >
                {t("amountLabel")}
              </Text>
              <TextInput
                value={payAmount}
                onChangeText={(text) =>
                  setPayAmount(normalizeAmountInput(text))
                }
                {...amountInputProps}
                className="rounded-xl px-4 py-3 border"
                style={{
                  color: colors.text.primary,
                  borderColor: colors.border,
                  backgroundColor: colors.bg.secondary,
                }}
              />
            </View>
            <View>
              <Text
                className="text-sm mb-2"
                style={{ color: colors.text.secondary }}
              >
                {t("notesOptional")}
              </Text>
              <TextInput
                value={payNote}
                onChangeText={setPayNote}
                className="rounded-xl px-4 py-3 border"
                style={{
                  color: colors.text.primary,
                  borderColor: colors.border,
                  backgroundColor: colors.bg.secondary,
                }}
              />
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowPay(false)}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Text style={{ color: colors.text.primary }}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handlePay()}
                disabled={payMutation.isPending}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.info }}
              >
                {payMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">{t("save")}</Text>
                )}
              </TouchableOpacity>
            </View>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
      {/* Edit member count */}
      <Modal visible={Boolean(editCountMember)} animationType="slide" transparent>
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "#00000066" }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => Keyboard.dismiss()}
          />
          <KeyboardAwareScrollView
            bottomOffset={Platform.OS === "ios" ? 100 + insets.bottom : 120}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{
              backgroundColor: colors.bg.primary,
              maxHeight: Dimensions.get("window").height * 0.9,
            }}
          >
            <View
              className="rounded-t-3xl p-6 gap-4"
              style={{ backgroundColor: colors.bg.primary }}
            >
            <Text
              className="text-xl font-bold"
              style={{ color: colors.text.primary }}
            >
              {t("updateMemberCount")}
            </Text>
            <Text style={{ color: colors.text.secondary }}>
              {editCountMember?.party.name}
            </Text>
            <TextInput
              value={editCountValue}
              onChangeText={setEditCountValue}
              keyboardType="number-pad"
              className="rounded-xl px-4 py-3 border"
              style={{
                color: colors.text.primary,
                borderColor: colors.border,
                backgroundColor: colors.bg.secondary,
              }}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setEditCountMember(null)}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Text style={{ color: colors.text.primary }}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void saveEditCount()}
                disabled={updateMemberMutation.isPending}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.info }}
              >
                {updateMemberMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">{t("save")}</Text>
                )}
              </TouchableOpacity>
            </View>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </View>
  );
}
