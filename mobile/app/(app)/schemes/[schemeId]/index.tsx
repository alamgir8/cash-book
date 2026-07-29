import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { SearchableSelect } from "@/components/searchable-select";
import { FormSheetModal } from "@/components/form-sheet-modal";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import { usePreferences } from "@/hooks/use-preferences";
import { useActiveOrgId, useOrganization } from "@/hooks/use-organization";
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
  integerInputProps,
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
  const { isOwner } = useOrganization();
  const queryClient = useQueryClient();

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
  const [editMember, setEditMember] = useState<SchemeRosterMember | null>(null);
  const [editCountValue, setEditCountValue] = useState("1");
  const [editNotesValue, setEditNotesValue] = useState("");

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


  const handleAddFamily = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    try {
      const party = await partiesApi.create({
        organization: orgId || undefined,
        name: trimmed,
        type: "both",
      });
      void queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.parties, "scheme-enroll", orgId ?? "personal"],
      });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parties });
      setEnrollPartyId(party._id);
      Toast.show({ type: "success", text1: t("partyAdded") ?? "Family added" });
      return { value: party._id, label: party.name };
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: t("failedToAddParty") ?? "Could not add family",
        text2: error?.response?.data?.message || error?.message,
      });
      return null;
    }
  };

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
    if (!isOwner) return;
    if ((member.payment_count ?? 0) > 0 || member.paid > 0) {
      Toast.show({
        type: "error",
        text1: t("cannotRemoveFamilyWithPayments"),
      });
      return;
    }
    Alert.alert(
      t("deleteFamily"),
      t("removeFromSchemeConfirm", { name: member.party.name }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("deleteLabel"),
          style: "destructive",
          onPress: () => {
            removeMutation.mutate(member._id, {
              onSuccess: () => {
                if (selectedMember?._id === member._id) setSelectedMember(null);
                Toast.show({ type: "success", text1: t("memberRemoved") });
              },
              onError: (error: any) => {
                Toast.show({
                  type: "error",
                  text1: t("deleteFailed"),
                  text2:
                    error?.response?.data?.message ||
                    error?.message ||
                    t("cannotRemoveFamilyWithPayments"),
                });
              },
            });
          },
        },
      ],
    );
  };

  const handleEditFamily = (member: SchemeRosterMember) => {
    setEditMember(member);
    setEditCountValue(String(member.member_count));
    setEditNotesValue(member.notes || "");
  };

  const saveEditFamily = async () => {
    if (!editMember) return;
    const count = Number(editCountValue);
    if (!Number.isFinite(count) || count < 1) {
      Toast.show({ type: "error", text1: t("memberCountRequired") });
      return;
    }
    try {
      await updateMemberMutation.mutateAsync({
        memberId: editMember._id,
        member_count: count,
        notes: editNotesValue.trim(),
      });
      setEditMember(null);
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
      const canDelete =
        isOwner && (item.payment_count ?? 0) === 0 && item.paid <= 0;
      return (
        <TouchableOpacity
          onPress={() =>
            setSelectedMember((prev) =>
              prev?._id === item._id ? null : item,
            )
          }
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
            <View className="items-end gap-2">
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
              <View className="flex-row items-center gap-1">
                <TouchableOpacity
                  onPress={() => handleEditFamily(item)}
                  className="p-2 rounded-full"
                  style={{ backgroundColor: colors.info + "15" }}
                  hitSlop={8}
                >
                  <Ionicons
                    name="create-outline"
                    size={16}
                    color={colors.info}
                  />
                </TouchableOpacity>
                {isOwner ? (
                  <TouchableOpacity
                    onPress={() => handleRemove(item)}
                    className="p-2 rounded-full"
                    style={{
                      backgroundColor: canDelete
                        ? colors.error + "15"
                        : colors.bg.tertiary,
                      opacity: canDelete ? 1 : 0.45,
                    }}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={canDelete ? colors.error : colors.text.tertiary}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
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
                  onPress={() => handleEditFamily(item)}
                  className="px-3 py-2 rounded-xl items-center"
                  style={{ backgroundColor: colors.bg.tertiary }}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={colors.text.primary}
                  />
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
      isOwner,
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

        <View
          className="flex-row gap-2 mt-2 p-1.5 rounded-2xl"
          style={{ backgroundColor: colors.bg.secondary }}
        >
          {filters.map((f) => {
            const active = statusFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setStatusFilter(f.key)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{
                  backgroundColor: active
                    ? colors.info
                    : "transparent",
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


      <FormSheetModal
        visible={showEnroll}
        onClose={() => {
          setShowEnroll(false);
          setEnrollPartyId("");
          setEnrollMembers("1");
          setEnrollNotes("");
        }}
        title={t("enrollFamily")}
        subtitle={t("enrollFamilyHint") ?? "Select or add a family to this scheme"}
        submitLabel={t("enroll")}
        submitIcon="person-add"
        onSubmit={() => void handleEnroll()}
        isSubmitting={enrollMutation.isPending}
        submittingLabel={t("saving") ?? "Saving…"}
        sheetRatio={0.75}
      >
        <View className="gap-5">
          <SearchableSelect
            label={t("family")}
            placeholder={t("selectFamily")}
            value={enrollPartyId}
            options={partyOptions}
            onSelect={(val) => setEnrollPartyId(val || "")}
            onAddNew={handleAddFamily}
            addNewLabel="family"
          />
          <View>
            <Text
              className="text-sm font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              {t("memberCount")}
            </Text>
            <TextInput
              value={enrollMembers}
              onChangeText={setEnrollMembers}
              {...integerInputProps}
              className="px-4 py-3 rounded-xl border"
              style={{
                color: colors.text.primary,
                borderColor: colors.border,
                backgroundColor: colors.bg.tertiary,
                minHeight: 48,
              }}
            />
          </View>
          <View>
            <Text
              className="text-sm font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              {t("notesOptional")}
            </Text>
            <TextInput
              value={enrollNotes}
              onChangeText={setEnrollNotes}
              className="px-4 py-3 rounded-xl border"
              style={{
                color: colors.text.primary,
                borderColor: colors.border,
                backgroundColor: colors.bg.tertiary,
                minHeight: 48,
              }}
            />
          </View>
        </View>
      </FormSheetModal>

      <FormSheetModal
        visible={showPay}
        onClose={() => setShowPay(false)}
        title={t("recordPayment")}
        subtitle={
          selectedMember
            ? `${selectedMember.party.name} · ${t("due")}: ${formatAmount(selectedMember.due)}`
            : undefined
        }
        submitLabel={t("save")}
        submitIcon="cash-outline"
        onSubmit={() => void handlePay()}
        isSubmitting={payMutation.isPending}
        submittingLabel={t("saving") ?? "Saving…"}
        sheetRatio={0.75}
      >
        <View className="gap-5">
          <SearchableSelect
            label={t("accountFilter")}
            placeholder={t("selectAccount")}
            value={payAccountId}
            options={accountOptions}
            onSelect={(val) => setPayAccountId(val || "")}
          />
          <View>
            <Text
              className="text-sm font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              {t("amountLabel")}
            </Text>
            <TextInput
              value={payAmount}
              onChangeText={(text) => setPayAmount(normalizeAmountInput(text))}
              {...amountInputProps}
              className="px-4 py-3 rounded-xl border text-lg font-semibold"
              style={{
                color: colors.text.primary,
                borderColor: colors.border,
                backgroundColor: colors.bg.tertiary,
                minHeight: 48,
              }}
            />
          </View>
          <View>
            <Text
              className="text-sm font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              {t("notesOptional")}
            </Text>
            <TextInput
              value={payNote}
              onChangeText={setPayNote}
              className="px-4 py-3 rounded-xl border"
              style={{
                color: colors.text.primary,
                borderColor: colors.border,
                backgroundColor: colors.bg.tertiary,
                minHeight: 48,
              }}
            />
          </View>
        </View>
      </FormSheetModal>

      <FormSheetModal
        visible={Boolean(editMember)}
        onClose={() => setEditMember(null)}
        title={t("editFamily")}
        subtitle={editMember?.party.name}
        submitLabel={t("save")}
        submitIcon="checkmark-circle"
        onSubmit={() => void saveEditFamily()}
        isSubmitting={updateMemberMutation.isPending}
        submittingLabel={t("saving") ?? "Saving…"}
        sheetRatio={0.55}
      >
        <View className="gap-5">
          <View>
            <Text
              className="text-sm font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              {t("memberCount")}
            </Text>
            <TextInput
              value={editCountValue}
              onChangeText={setEditCountValue}
              {...integerInputProps}
              className="px-4 py-3 rounded-xl border"
              style={{
                color: colors.text.primary,
                borderColor: colors.border,
                backgroundColor: colors.bg.tertiary,
                minHeight: 48,
              }}
            />
            <Text
              className="text-xs mt-2"
              style={{ color: colors.text.tertiary }}
            >
              {t("updateMemberCountHint")}
            </Text>
          </View>
          <View>
            <Text
              className="text-sm font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              {t("notesOptional")}
            </Text>
            <TextInput
              value={editNotesValue}
              onChangeText={setEditNotesValue}
              className="px-4 py-3 rounded-xl border"
              style={{
                color: colors.text.primary,
                borderColor: colors.border,
                backgroundColor: colors.bg.tertiary,
                minHeight: 48,
              }}
            />
          </View>
        </View>
      </FormSheetModal>

    </View>
  );
}
