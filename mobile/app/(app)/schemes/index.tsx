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
import { schemesApi, type CollectionScheme } from "@/services/schemes";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SchemesScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { formatAmount } = usePreferences();
  const { canManageCustomers } = useOrganization();
  const insets = useSafeAreaInsets();
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

      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "#00000066" }}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => {
              Keyboard.dismiss();
              setShowCreate(false);
              setEditingScheme(null);
              resetForm();
            }}
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
            <View className="flex-row items-center justify-between">
              <Text
                className="text-xl font-bold"
                style={{ color: colors.text.primary }}
              >
                {editingScheme ? t("editScheme") : t("createScheme")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreate(false);
                  setEditingScheme(null);
                  resetForm();
                }}
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: "#f43f5e22" }}
              >
                <Ionicons name="close" size={18} color="#f43f5e" />
              </TouchableOpacity>
            </View>
            <Controller
              control={control}
              name="name"
              render={({ field: { value, onChange } }) => (
                <View>
                  <Text
                    className="text-sm mb-2"
                    style={{ color: colors.text.secondary }}
                  >
                    {t("schemeName")}
                  </Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder={t("schemeNamePlaceholder")}
                    placeholderTextColor={colors.text.tertiary}
                    className="rounded-xl px-4 py-3 border"
                    style={{
                      color: colors.text.primary,
                      borderColor: errors.name ? colors.error : colors.border,
                      backgroundColor: colors.bg.secondary,
                    }}
                  />
                  {errors.name ? (
                    <Text className="text-xs mt-1" style={{ color: colors.error }}>
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
                    className="text-sm mb-2"
                    style={{ color: colors.text.secondary }}
                  >
                    {t("ratePerMember")}
                  </Text>
                  <TextInput
                    value={value}
                    onChangeText={(text) => onChange(normalizeAmountInput(text))}
                    {...amountInputProps}
                    placeholder="500"
                    placeholderTextColor={colors.text.tertiary}
                    className="rounded-xl px-4 py-3 border"
                    style={{
                      color: colors.text.primary,
                      borderColor: errors.rate ? colors.error : colors.border,
                      backgroundColor: colors.bg.secondary,
                    }}
                  />
                  {errors.rate ? (
                    <Text className="text-xs mt-1" style={{ color: colors.error }}>
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
                    className="text-sm mb-2"
                    style={{ color: colors.text.secondary }}
                  >
                    {t("descriptionOptional")}
                  </Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder={t("schemeDescriptionPlaceholder")}
                    placeholderTextColor={colors.text.tertiary}
                    className="rounded-xl px-4 py-3 border"
                    style={{
                      color: colors.text.primary,
                      borderColor: colors.border,
                      backgroundColor: colors.bg.secondary,
                    }}
                  />
                </View>
              )}
            />
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => {
                  setShowCreate(false);
                  setEditingScheme(null);
                  resetForm();
                }}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Text style={{ color: colors.text.primary }}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit(handleSave)}
                disabled={createMutation.isPending}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.info }}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                <Text className="text-white font-semibold">
                  {editingScheme ? t("save") : t("createLabel")}
                </Text>
                )}
              </TouchableOpacity>
            </View>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
      {/* Duplicate modal */}
      <Modal visible={showDuplicate} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "#00000066" }}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => {
              Keyboard.dismiss();
              setShowDuplicate(false);
              setDuplicateTarget(null);
            }}
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
            <View className="flex-row items-center justify-between">
              <Text
                className="text-xl font-bold"
                style={{ color: colors.text.primary }}
              >
                {t("duplicateScheme")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDuplicate(false);
                  setDuplicateTarget(null);
                }}
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: "#f43f5e22" }}
              >
                <Ionicons name="close" size={18} color="#f43f5e" />
              </TouchableOpacity>
            </View>

            <Text
              className="text-sm mb-2"
              style={{ color: colors.text.secondary }}
            >
              {t("duplicateSchemeName")}
            </Text>
            <TextInput
              value={duplicateName}
              onChangeText={setDuplicateName}
              placeholder={t("duplicateSchemeNamePlaceholder")}
              placeholderTextColor={colors.text.tertiary}
              className="rounded-xl px-4 py-3 border"
              style={{
                color: colors.text.primary,
                borderColor: colors.border,
                backgroundColor: colors.bg.secondary,
              }}
            />

            <Text
              className="text-xs"
              style={{ color: colors.text.tertiary }}
            >
              {t("duplicateSchemeHint")}
            </Text>

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => {
                  setShowDuplicate(false);
                  setDuplicateTarget(null);
                }}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Text style={{ color: colors.text.primary }}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleDuplicate()}
                disabled={duplicateMutation.isPending}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: colors.info }}
              >
                {duplicateMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">{t("duplicateLabel")}</Text>
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
