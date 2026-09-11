import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/screen-header";
import { useOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { type Organization } from "@/services/organizations";
import {
  dalDeleteOrganization,
  dalFetchOrganizations,
} from "@/data/organizations";
import { getApiErrorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { refreshAppData } from "@/lib/refresh-app-data";
import { OrganizationFormModal } from "@/components/organization-form-modal";
import { useTranslation } from "@/hooks/use-translation";

export default function OrganizationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { setOrganizations, switchOrganization, activeOrganization } =
    useOrganization();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const { colors } = useTheme();

  const {
    data: organizationsResult,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["organizations"],
    // Server-first with a local-mirror fallback so this screen works offline.
    queryFn: dalFetchOrganizations,
  });
  const organizations = organizationsResult?.organizations ?? [];
  const offlineMode = organizationsResult?.fromCache ?? false;

  const deleteMutation = useMutation({
    mutationFn: dalDeleteOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Organization deleted successfully");
    },
    onError: (error) => {
      if (!(error as any)?.response) {
        toast.error(t("deleteShopNeedsConnection"));
        return;
      }
      toast.error(getApiErrorMessage(error));
    },
  });

  const handleDelete = useCallback(
    (org: Organization) => {
      Alert.alert(
        "Delete Organization",
        `Are you sure you want to delete "${org.name}"? This action cannot be undone.`,
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("delete"),
            style: "destructive",
            onPress: async () => {
              // If deleting active org, switch to personal
              if (activeOrganization?.id === org._id) {
                await switchOrganization(null);
              }
              deleteMutation.mutate(org._id);
            },
          },
        ],
      );
    },
    [deleteMutation, activeOrganization, switchOrganization],
  );

  const handleEdit = useCallback((org: Organization) => {
    setEditingOrg(org);
    setShowFormModal(true);
  }, []);

  const handleFormSuccess = useCallback(
    (org: Organization) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      // Update context with proper role and permissions from the list
      refetch().then((result) => {
        const list = result.data?.organizations;
        if (list) {
          const summaries = list.map((o) => ({
            id: o._id,
            name: o.name,
            business_type: o.business_type,
            role: o.role || "owner", // Role comes from API
            permissions: o.permissions || {}, // Permissions come from API
            settings: o.settings,
          }));
          setOrganizations(summaries);
        }
      });
    },
    [queryClient, refetch, setOrganizations],
  );

  const handleViewDetails = useCallback(
    (org: Organization) => {
      router.push(`/organizations/${org._id}`);
    },
    [router],
  );

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "owner":
        return { bg: "#7c3aed20", text: "#7c3aed" };
      case "admin":
        return { bg: colors.info + "20", text: colors.info };
      case "manager":
        return { bg: colors.success + "20", text: colors.success };
      default:
        return { bg: colors.bg.tertiary, text: colors.text.secondary };
    }
  };
  if (isLoading) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
        <ScreenHeader title={t("organizations")} showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title={t("organizations")}
        showBack
        onBack={() => router.push("/settings")}
        rightAction={
          <TouchableOpacity
            className="p-2"
            onPress={() => {
              setEditingOrg(null);
              setShowFormModal(true);
            }}
          >
            <Ionicons name="add-circle" size={28} color={colors.info} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refreshAppData(queryClient)}
          />
        }
      >
        {/* Info Card */}
        <View
          className="m-4 p-4 rounded-xl border"
          style={{
            backgroundColor: colors.info + "15",
            borderColor: colors.info + "40",
          }}
        >
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={24} color={colors.info} />
            <View className="ml-3 flex-1">
              <Text
                className="text-sm font-medium"
                style={{ color: colors.info }}
              >
                Multi-User Business Management
              </Text>
              <Text
                className="text-sm mt-1"
                style={{ color: colors.info + "CC" }}
              >
                Create organizations for your businesses. Invite team members
                with different roles and permissions.
              </Text>
            </View>
          </View>
        </View>

        {organizations.length === 0 ? (
          <View className="p-8 items-center">
            <Ionicons
              name={offlineMode ? "cloud-offline-outline" : "business-outline"}
              size={64}
              color={colors.text.tertiary}
            />
            <Text
              className="text-lg font-medium mt-4"
              style={{ color: colors.text.secondary }}
            >
              {offlineMode ? "Offline" : t("noOrganizationsYet")}
            </Text>
            <Text
              className="text-sm text-center mt-2"
              style={{ color: colors.text.tertiary }}
            >
              {offlineMode
                ? "Connect to the internet to load and manage your shops."
                : t("createFirstOrganization")}
            </Text>
            {!offlineMode ? (
              <TouchableOpacity
                className="mt-6 px-6 py-3 rounded-lg"
                style={{ backgroundColor: colors.info }}
                onPress={() => {
                  setEditingOrg(null);
                  setShowFormModal(true);
                }}
              >
                <Text className="text-white font-medium">
                  {t("createOrganization")}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View className="px-4 pb-4">
            {offlineMode ? (
              <View
                className="mb-3 p-3 rounded-xl flex-row items-center gap-2"
                style={{
                  backgroundColor: colors.warning + "15",
                  borderWidth: 1,
                  borderColor: colors.warning + "40",
                }}
              >
                <Ionicons
                  name="cloud-offline-outline"
                  size={18}
                  color={colors.warning}
                />
                <Text
                  className="text-sm flex-1"
                  style={{ color: colors.warning }}
                >
                  {t("offlineShopsHint")}
                </Text>
              </View>
            ) : null}
            {organizations.map((org) => (
              <TouchableOpacity
                key={org._id}
                className="rounded-xl p-4 mb-3 border shadow-sm"
                style={{
                  backgroundColor: colors.bg.secondary,
                  borderColor: colors.border,
                }}
                onPress={() => handleViewDetails(org)}
              >
                <View className="flex-row items-start">
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center"
                    style={{ backgroundColor: colors.info + "20" }}
                  >
                    <Ionicons name="business" size={24} color={colors.info} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className="text-base font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {org.name}
                    </Text>
                    <Text
                      className="text-sm capitalize mt-0.5"
                      style={{ color: colors.text.secondary }}
                    >
                      {org.business_type}
                    </Text>
                    {org.description && (
                      <Text
                        className="text-sm mt-1"
                        style={{ color: colors.text.tertiary }}
                        numberOfLines={1}
                      >
                        {org.description}
                      </Text>
                    )}
                  </View>
                  {(() => {
                    const badge = getRoleBadgeStyle(org.role || "owner");
                    return (
                      <View
                        className="px-2 py-1 rounded-full"
                        style={{ backgroundColor: badge.bg }}
                      >
                        <Text
                          className="text-xs font-medium capitalize"
                          style={{ color: badge.text }}
                        >
                          {org.role || "Owner"}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                <View
                  className="flex-row mt-4 pt-3 border-t"
                  style={{ borderColor: colors.border }}
                >
                  <View className="flex-1 items-center">
                    <Text
                      className="text-xs"
                      style={{ color: colors.text.secondary }}
                    >
                      {t("currency")}
                    </Text>
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.text.primary }}
                    >
                      {org.settings?.currency || "USD"}
                    </Text>
                  </View>
                  <View
                    className="w-px"
                    style={{ backgroundColor: colors.border }}
                  />
                  <View className="flex-1 items-center">
                    <Text
                      className="text-xs"
                      style={{ color: colors.text.secondary }}
                    >
                      {t("status")}
                    </Text>
                    <Text
                      className="text-sm font-medium"
                      style={{
                        color:
                          org.status === "active"
                            ? colors.success
                            : colors.error,
                      }}
                    >
                      {org.status === "active" ? t("active") : t("inactive")}
                    </Text>
                  </View>
                </View>

                <View
                  className="flex-row mt-3 pt-3 border-t gap-2"
                  style={{ borderColor: colors.border }}
                >
                  {(org.role === "owner" || !org.role) && (
                    <TouchableOpacity
                      className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                      style={{ backgroundColor: colors.bg.tertiary }}
                      onPress={() => handleEdit(org)}
                    >
                      <Ionicons
                        name="pencil"
                        size={16}
                        color={colors.text.secondary}
                      />
                      <Text
                        className="ml-1 text-sm"
                        style={{ color: colors.text.primary }}
                      >
                        {t("edit")}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {(org.role === "owner" ||
                    org.role === "manager" ||
                    !org.role) && (
                    <TouchableOpacity
                      className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                      style={{ backgroundColor: colors.bg.tertiary }}
                      onPress={() => handleViewDetails(org)}
                    >
                      <Ionicons
                        name="people"
                        size={16}
                        color={colors.text.secondary}
                      />
                      <Text
                        className="ml-1 text-sm"
                        style={{ color: colors.text.primary }}
                      >
                        Members
                      </Text>
                    </TouchableOpacity>
                  )}
                  {(org.role === "owner" || !org.role) && (
                    <TouchableOpacity
                      className="flex-row items-center justify-center py-2 px-3 rounded-lg"
                      style={{ backgroundColor: colors.error + "15" }}
                      onPress={() => handleDelete(org)}
                    >
                      <Ionicons name="trash" size={16} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <OrganizationFormModal
        visible={showFormModal}
        organization={editingOrg}
        onClose={() => {
          setShowFormModal(false);
          setEditingOrg(null);
        }}
        onSuccess={handleFormSuccess}
      />
    </View>
  );
}
