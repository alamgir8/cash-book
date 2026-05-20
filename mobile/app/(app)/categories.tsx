import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState } from "@/components/empty-state";
import { CategoryFormModal } from "@/components/modals/category-form-modal";
import {
  fetchCategories,
  deleteCategory,
  type Category,
} from "@/services/categories";
import { queryKeys } from "@/lib/queryKeys";
import { refreshAppData } from "@/lib/refresh-app-data";
import { useOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";

export default function CategoriesScreen() {
  const queryClient = useQueryClient();
  const { canManageCategories } = useOrganization();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"credit" | "debit">("debit");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );

  const {
    data: categories,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => fetchCategories(),
  });

  const onRefresh = useCallback(() => {
    void refreshAppData(queryClient);
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      Toast.show({
        type: "success",
        text1: t("categoryDeletedSuccessfully"),
      });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || t("failedToDeleteCategory");
      Toast.show({
        type: "error",
        text1: t("cannotDeleteCategory"),
        text2: message,
        visibilityTime: 4000,
      });
    },
  });

  const handleDelete = (category: Category) => {
    Alert.alert(
      t("deleteCategory"),
      t("deleteCategoryConfirm", { name: category.name }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () => deleteMutation.mutate(category._id),
        },
      ],
    );
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setModalVisible(true);
  };

  const handleAdd = () => {
    setSelectedCategory(null);
    setModalVisible(true);
  };

  const filteredCategories = categories?.filter((c) => c.flow === activeTab);

  const handleTabChange = useCallback((tab: "credit" | "debit") => {
    setActiveTab(tab);
  }, []);

  const renderItem = ({ item }: { item: Category }) => {
    return (
      <View
        className="p-4 rounded-2xl border flex-row items-center justify-between mb-3"
        style={{
          backgroundColor: colors.bg.secondary,
          borderColor: colors.border,
        }}
      >
        <View className="flex-row items-center gap-4 flex-1">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: item.color + "20" }}
          >
            <View
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          </View>
          <View className="flex-1">
            <Text
              className="font-semibold text-base"
              style={{ color: colors.text.primary }}
            >
              {item.name}
            </Text>
            <Text
              className="text-xs capitalize"
              style={{ color: colors.text.secondary }}
            >
              {item.type.replace("_", " ")}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {canManageCategories && (
            <>
              <TouchableOpacity
                onPress={() => handleEdit(item)}
                className="p-2 rounded-full"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Ionicons name="pencil" size={16} color={colors.info} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                className="p-2 rounded-full"
                style={{ backgroundColor: colors.error + "20" }}
              >
                <Ionicons name="trash" size={16} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title={t("categories")}
        subtitle={t("manageIncomExpenseCategories")}
        icon="list"
        iconColor={colors.info}
        actionButton={
          canManageCategories
            ? {
                label: t("addNew"),
                icon: "add",
                onPress: handleAdd,
              }
            : undefined
        }
      />

      {/* Tabs */}
      <View className="flex-row px-4 py-2 gap-4">
        <TouchableOpacity
          onPress={() => handleTabChange("debit")}
          className="flex-1 py-3 rounded-xl items-center border"
          style={{
            backgroundColor:
              activeTab === "debit" ? colors.error + "15" : colors.bg.secondary,
            borderColor:
              activeTab === "debit" ? colors.error + "40" : colors.border,
          }}
        >
          <Text
            className="font-bold"
            style={{
              color:
                activeTab === "debit" ? colors.error : colors.text.secondary,
            }}
          >
            {t("expenses")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleTabChange("credit")}
          className="flex-1 py-3 rounded-xl items-center border"
          style={{
            backgroundColor:
              activeTab === "credit"
                ? colors.success + "15"
                : colors.bg.secondary,
            borderColor:
              activeTab === "credit" ? colors.success + "40" : colors.border,
          }}
        >
          <Text
            className="font-bold"
            style={{
              color:
                activeTab === "credit" ? colors.success : colors.text.secondary,
            }}
          >
            {t("income")}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              colors={[colors.info]}
              tintColor={colors.info}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="list"
              title={t("noCategoriesFound")}
              description={
                activeTab === "debit"
                  ? t("addSomeCategoriesDebit")
                  : t("addSomeCategoriesCredit")
              }
            />
          }
        />
      )}

      <CategoryFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        category={selectedCategory}
        initialFlow={activeTab}
      />
    </View>
  );
}
