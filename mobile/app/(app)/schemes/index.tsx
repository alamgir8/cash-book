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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import { usePreferences } from "@/hooks/use-preferences";
import {
  useSchemes,
  useCreateScheme,
  useArchiveScheme,
  useDeleteScheme,
  useDuplicateScheme,
} from "@/hooks/use-schemes";
import { useDeleteMode } from "@/hooks/use-delete-mode";
import { useOrganization } from "@/hooks/use-organization";
import { amountInputProps, normalizeAmountInput } from "@/lib/amount-input";
import { FormSheetModal } from "@/components/form-sheet-modal";
import { schemesApi, type CollectionScheme } from "@/services/schemes";

export default function SchemesScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { formatAmount } = usePreferences();
  const { canManageCustomers } = useOrganization();
  const { data: schemes = [], isLoading, refetch, isRefetching } = useSchemes();
  const createMutation = useCreateScheme();
  const archiveMutation = useArchiveScheme();
  const deleteMutation = useDeleteScheme();
  const duplicateMutation = useDuplicateScheme();
  const { isDeleteModeActive } = useDeleteMode();

  const [showCreate, setShowCreate] = useState(false);
  const [editingScheme, setEditingScheme] = useState<CollectionScheme | null>(null);

  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<CollectionScheme | null>(null);
  const [duplicateName, setDuplicateName] = useState("");

  const createSchemeSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t("schemeNameRequired")),
        rate: z
          .string()
          .trim()
          .min(1, t("schemeRateRequired"))
          .refine((value) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) && parsed >= 0;
          }, t("schemeRateRequired")),
        description: z.string().optional(),
      }),
    [t],
  );

  type CreateSchemeValues = z.infer<typeof createSchemeSchema>;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSchemeValues>({
    resolver: zodResolver(createSchemeSchema),
    defaultValues: {
      name: "",
      rate: "500",
      description: "",
    },
  });

  const resetForm = () => {
    reset({ name: "", rate: "500", description: "" });
  };

  const handleCreate = async (values: CreateSchemeValues) => {
    try {
      const scheme = await createMutation.mutateAsync({
        name: values.name.trim(),
        rate_per_member: Number(values.rate),
        description: values.description?.trim() || undefined,
      });
      setShowCreate(false);
      resetForm();
      Toast.show({ type: "success", text1: t("schemeCreated") });
      router.push(`/schemes/${scheme._id}`);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: t("schemeCreateFailed"),
        text2: error?.response?.data?.message || error?.message,
      });
    }
  };

  const handleArchive = (scheme: CollectionScheme) => {
    Alert.alert(t("archiveScheme"), t("archiveSchemeConfirm", { name: scheme.name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("archiveLabel"),
        style: "destructive",
        onPress: () => {
          archiveMutation.mutate(scheme._id, {
            onSuccess: () =>
              Toast.show({ type: "success", text1: t("schemeArchived") }),
            onError: (error: any) =>
              Toast.show({
                type: "error",
                text1: t("schemeArchiveFailed"),
                text2: error?.response?.data?.message || error?.message,
              }),
          });
        },
      },
    ]);
  };

  const handleDelete = (scheme: CollectionScheme) => {
    if ((scheme.member_count ?? 0) > 0) {
      Alert.alert(
        t("deleteScheme"),
        t("deleteSchemeHasFamilies"),
      );
      return;
    }
    Alert.alert(t("deleteScheme"), t("deleteSchemeConfirm", { name: scheme.name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("deleteLabel"),
        style: "destructive",
        onPress: () => {
          deleteMutation.mutate(scheme._id, {
            onSuccess: () =>
              Toast.show({ type: "success", text1: t("schemeDeleted") }),
            onError: (error: any) =>
              Toast.show({
                type: "error",
                text1: t("deleteFailed"),
                text2: error?.response?.data?.message || error?.message,
              }),
          });
        },
      },
    ]);
  };

  const openEdit = (scheme: CollectionScheme) => {
    setEditingScheme(scheme);
    reset({
      name: scheme.name,
      rate: String(scheme.rate_per_member),
      description: scheme.description || "",
    });
    setShowCreate(true);
  };

  const handleSave = async (values: CreateSchemeValues) => {
    if (editingScheme) {
      try {
        await schemesApi.update(editingScheme._id, {
          name: values.name.trim(),
          rate_per_member: Number(values.rate),
          description: values.description?.trim() || undefined,
        });
        setShowCreate(false);
        setEditingScheme(null);
        resetForm();
        Toast.show({ type: "success", text1: t("schemeUpdated") });
        void refetch();
      } catch (error: any) {
        Toast.show({
          type: "error",
          text1: t("schemeUpdateFailed"),
          text2: error?.response?.data?.message || error?.message,
        });
      }
    } else {
      await handleCreate(values);
    }
  };

  const openDuplicate = (scheme: CollectionScheme) => {
    setDuplicateTarget(scheme);
    setDuplicateName(`Copy of ${scheme.name}`);
    setShowDuplicate(true);
  };

  const handleDuplicate = async () => {
    if (!duplicateTarget) return;
    const name = duplicateName.trim();
    if (name.length < 2) {
      Toast.show({ type: "error", text1: t("schemeNameRequired") });
      return;
    }

    try {
      const newScheme = await duplicateMutation.mutateAsync({
        schemeId: duplicateTarget._id,
        payload: { name },
      });
      setShowDuplicate(false);
      setDuplicateTarget(null);
      Toast.show({ type: "success", text1: t("schemeDuplicated") });
      router.push(`/schemes/${newScheme._id}`);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: t("schemeDuplicateFailed"),
        text2: error?.response?.data?.message || error?.message,
      });
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: CollectionScheme }) => (
      <TouchableOpacity
        onPress={() => router.push(`/schemes/${item._id}`)}
        className="rounded-2xl p-4 mb-3 border"
        style={{
          backgroundColor: colors.bg.secondary,
          borderColor: colors.border,
        }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text
              className="text-lg font-bold"
              style={{ color: colors.text.primary }}
            >
              {item.name}
            </Text>
            <Text
              className="text-sm mt-1"
              style={{ color: colors.text.secondary }}
            >
              {t("ratePerMember")}: {formatAmount(item.rate_per_member)}
            </Text>
            <Text
              className="text-xs mt-2"
              style={{ color: colors.text.tertiary }}
            >
              {t("familiesCount", { count: String(item.member_count ?? 0) })}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <TouchableOpacity
              onPress={() => openEdit(item)}
              className="p-2 rounded-full"
              style={{ backgroundColor: colors.info + "15" }}
            >
              <Ionicons name="create-outline" size={18} color={colors.info} />
            </TouchableOpacity>
            {canManageCustomers && (
              <TouchableOpacity
                onPress={() => openDuplicate(item)}
                className="p-2 rounded-full"
                style={{ backgroundColor: colors.success + "15" }}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={18}
                  color={colors.success}
                />
              </TouchableOpacity>
            )}
            {isDeleteModeActive && (item.member_count ?? 0) === 0 && (
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                className="p-2 rounded-full"
                style={{ backgroundColor: colors.error + "15" }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            )}
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </View>
        </View>
      </TouchableOpacity>
    ),
    [colors, formatAmount, t, isDeleteModeActive, canManageCustomers],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title={t("collectionSchemes")}
        subtitle={t("collectionSchemesSubtitle")}
        showBack
        onBack={() => router.replace("/(app)/settings")}
        rightAction={
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.info + "20" }}
          >
            <Ionicons name="add" size={22} color={colors.info} />
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.info} />
        </View>
      ) : (
        <FlatList
          data={schemes}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          renderItem={renderItem}
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
              title={t("noSchemesYet")}
              description={t("noSchemesYetHint")}
            />
          }
        />
      )}

      <FormSheetModal
        visible={showCreate}
        onClose={() => {
          setShowCreate(false);
          setEditingScheme(null);
          resetForm();
        }}
        title={editingScheme ? t("editScheme") : t("createScheme")}
        subtitle={
          editingScheme
            ? t("updateSchemeDetails") ?? "Update collection scheme"
            : t("createSchemeSubtitle") ?? "Set name and rate per member"
        }
        submitLabel={editingScheme ? t("save") : t("createLabel")}
        submitIcon={editingScheme ? "checkmark-circle" : "add-circle"}
        onSubmit={handleSubmit(handleSave)}
        isSubmitting={createMutation.isPending}
        submittingLabel={t("saving") ?? "Saving…"}
        sheetRatio={0.72}
      >
        <View className="gap-5">
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange } }) => (
              <View>
                <Text
                  className="text-sm font-semibold mb-2"
                  style={{ color: colors.text.primary }}
                >
                  {t("schemeName")}
                </Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder={t("schemeNamePlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  className="px-4 py-3 rounded-xl border"
                  style={{
                    color: colors.text.primary,
                    borderColor: errors.name ? colors.error : colors.border,
                    backgroundColor: colors.bg.tertiary,
                    minHeight: 48,
                  }}
                />
                {errors.name ? (
                  <Text className="text-sm mt-1" style={{ color: colors.error }}>
                    {errors.name.message}
                  </Text>
                ) : null}
              </View>
            )}
          />
          <Controller
            control={control}
            name="rate"
            render={({ field: { value, onChange } }) => (
              <View>
                <Text
                  className="text-sm font-semibold mb-2"
                  style={{ color: colors.text.primary }}
                >
                  {t("ratePerMember")}
                </Text>
                <TextInput
                  value={value}
                  onChangeText={(text) => onChange(normalizeAmountInput(text))}
                  {...amountInputProps}
                  placeholder="500"
                  placeholderTextColor={colors.text.tertiary}
                  className="px-4 py-3 rounded-xl border text-lg font-semibold"
                  style={{
                    color: colors.text.primary,
                    borderColor: errors.rate ? colors.error : colors.border,
                    backgroundColor: colors.bg.tertiary,
                    minHeight: 48,
                  }}
                />
                {errors.rate ? (
                  <Text className="text-sm mt-1" style={{ color: colors.error }}>
                    {errors.rate.message}
                  </Text>
                ) : null}
              </View>
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange } }) => (
              <View>
                <Text
                  className="text-sm font-semibold mb-2"
                  style={{ color: colors.text.primary }}
                >
                  {t("descriptionOptional")}
                </Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder={t("schemeDescriptionPlaceholder")}
                  placeholderTextColor={colors.text.tertiary}
                  className="px-4 py-3 rounded-xl border min-h-[80px]"
                  style={{
                    color: colors.text.primary,
                    borderColor: colors.border,
                    backgroundColor: colors.bg.tertiary,
                  }}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            )}
          />
        </View>
      </FormSheetModal>

      {/* Duplicate modal */}
      <FormSheetModal
        visible={showDuplicate}
        onClose={() => {
          setShowDuplicate(false);
          setDuplicateTarget(null);
        }}
        title={t("duplicateScheme")}
        subtitle={t("duplicateSchemeHint")}
        submitLabel={t("duplicateLabel")}
        submitIcon="copy-outline"
        onSubmit={() => void handleDuplicate()}
        isSubmitting={duplicateMutation.isPending}
        submittingLabel={t("saving") ?? "Saving…"}
        sheetRatio={0.55}
      >
        <View className="gap-5">
          <View>
            <Text
              className="text-sm font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              {t("duplicateSchemeName")}
            </Text>
            <TextInput
              value={duplicateName}
              onChangeText={setDuplicateName}
              placeholder={t("duplicateSchemeNamePlaceholder")}
              placeholderTextColor={colors.text.tertiary}
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
