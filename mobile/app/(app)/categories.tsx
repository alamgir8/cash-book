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
import { ScreenHeader } from "../../components/screen-header";
import { EmptyState } from "../../components/empty-state";
import { CategoryFormModal } from "../../components/category-form-modal";
import {
  fetchCategories,
  deleteCategory,
  type Category,
} from "../../services/categories";
import { queryKeys } from "../../lib/queryKeys";

export default function CategoriesScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"credit" | "debit">("debit");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
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
      ]
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

  const renderItem = ({ item }: { item: Category }) => (
    <View className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between mb-3">
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
          <Text className="font-semibold text-gray-900 text-base">
            {item.name}
          </Text>
          <Text className="text-gray-500 text-xs capitalize">
            {item.type.replace("_", " ")}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <TouchableOpacity
          onPress={() => handleEdit(item)}
          className="p-2 bg-gray-50 rounded-full"
        >
          <Ionicons name="pencil" size={16} color="#4b5563" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          className="p-2 bg-red-50 rounded-full"
        >
          <Ionicons name="trash" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <ScreenHeader
        title="Categories"
        subtitle="Manage income and expense categories"
        icon="list"
        iconColor="#8b5cf6"
        actionButton={{
          label: "Add New",
          icon: "add",
          onPress: handleAdd,
        }}
      />

      {/* Tabs */}
      <View className="flex-row px-4 py-2 gap-4">
        <TouchableOpacity
          onPress={() => setActiveTab("debit")}
          className={`flex-1 py-3 rounded-xl items-center border ${
            activeTab === "debit"
              ? "bg-red-50 border-red-200"
              : "bg-white border-gray-200"
          }`}
        >
          <Text
            className={`font-bold ${
              activeTab === "debit" ? "text-red-600" : "text-gray-500"
            }`}
          >
            Expenses
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("credit")}
          className={`flex-1 py-3 rounded-xl items-center border ${
            activeTab === "credit"
              ? "bg-green-50 border-green-200"
              : "bg-white border-gray-200"
          }`}
        >
          <Text
            className={`font-bold ${
              activeTab === "credit" ? "text-green-600" : "text-gray-500"
            }`}
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
