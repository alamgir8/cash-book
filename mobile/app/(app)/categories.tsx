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
import { useOrganization } from "@/hooks/useOrganization";
import { useTheme } from "@/hooks/useTheme";

export default function CategoriesScreen() {
  const queryClient = useQueryClient();
  const { canManageCategories } = useOrganization();
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
    refetch();
  }, [refetch]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      Toast.show({
        type: "success",
        text1: "Category deleted successfully",
      });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || "Failed to delete category";
      Toast.show({
        type: "error",
        text1: "Cannot delete category",
        text2: message,
        visibilityTime: 4000,
      });
    },
  });

  const handleDelete = (category: Category) => {
    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${category.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
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
    const { colors } = useTheme();
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

  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Categories"
        subtitle="Manage income and expense categories"
        icon="list"
        iconColor="#8b5cf6"
        actionButton={
          canManageCategories
            ? {
                label: "Add New",
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
            Expenses
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
            Income
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8b5cf6" />
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
              colors={["#8b5cf6"]}
              tintColor="#8b5cf6"
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="list"
              title="No categories found"
              description={`Add some ${activeTab} categories to get started`}
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
