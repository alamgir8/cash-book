import React, { useState } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "@/components/screen-header";
import {
  organizationsApi,
  type OrganizationMember,
} from "@/services/organizations";
import { getApiErrorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { AddMemberModal } from "@/components/modals/add-member-modal";
import { OrganizationSettingsModal } from "@/components/organization/organization-settings-modal";
import { OrganizationInfoCard } from "@/components/organization/organization-info-card";
import { MemberList } from "@/components/organization/member-list";

export default function OrganizationDetailScreen() {
  const { organizationId } = useLocalSearchParams<{ organizationId: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["organization", organizationId],
    queryFn: () => organizationsApi.get(organizationId!),
    enabled: !!organizationId,
  });

  const addMemberMutation = useMutation({
    mutationFn: (params: {
      email?: string;
      phone?: string;
      password: string;
      role: string;
      display_name: string;
    }) => organizationsApi.addMember(organizationId!, params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization", organizationId],
      });
      setShowAddMemberModal(false);
      toast.success("User account created and added successfully");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: (params: {
      settings: { currency: string };
      status: "active" | "suspended" | "archived";
    }) => organizationsApi.update(organizationId!, params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization", organizationId],
      });
      setShowSettingsModal(false);
      toast.success("Settings updated successfully");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      organizationsApi.updateMemberRole(organizationId!, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization", organizationId],
      });
      toast.success("Role updated successfully");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      organizationsApi.removeMember(organizationId!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization", organizationId],
      });
      toast.success("Member removed successfully");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const handleChangeRole = (member: OrganizationMember, role: string) => {
    updateRoleMutation.mutate({
      memberId: member._id,
      role,
    });
  };

  const handleRemoveMember = (member: OrganizationMember) => {
    removeMemberMutation.mutate(member._id);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "white" }}>
        <ScreenHeader title="Organization" showBack />
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  const organization = data?.organization;
  const members = data?.members || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <ScreenHeader
        title={organization?.name || "Organization"}
        showBack
        onBack={() => router.push("/organizations")}
      />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <OrganizationInfoCard
          organization={organization!}
          onPressSettings={() => setShowSettingsModal(true)}
        />

        <MemberList
          members={members}
          onChangeRole={handleChangeRole}
          onRemove={handleRemoveMember}
          onAddMember={() => setShowAddMemberModal(true)}
        />

        <View style={{ height: 32 }} />
      </ScrollView>

      <AddMemberModal
        visible={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        onSubmit={addMemberMutation.mutate}
        isLoading={addMemberMutation.isPending}
      />

      <OrganizationSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        organization={organization}
        onSubmit={updateOrganizationMutation.mutate}
        isLoading={updateOrganizationMutation.isPending}
      />
    </View>
  );
}
