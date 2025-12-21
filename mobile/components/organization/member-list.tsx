import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { OrganizationMember } from "../../services/organizations";

const ROLES = [
  {
    value: "owner",
    label: "Owner",
    description: "Full control over the organization",
  },
  {
    value: "manager",
    label: "Manager",
    description: "Manage members, transactions, categories, and view reports",
  },
  {
    value: "cashier",
    label: "Cashier",
    description: "Create transactions and view reports",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access",
  },
];

interface MemberCardProps {
  member: OrganizationMember;
  onChangeRole: (member: OrganizationMember, role: string) => void;
  onRemove: (member: OrganizationMember) => void;
}

export function MemberCard({
  member,
  onChangeRole,
  onRemove,
}: MemberCardProps) {
  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return { bg: "#f3e8ff", text: "#7c3aed" };
      case "manager":
        return { bg: "#dcfce7", text: "#16a34a" };
      case "cashier":
        return { bg: "#fed7aa", text: "#ea580c" };
      case "viewer":
        return { bg: "#e0e7ff", text: "#4f46e5" };
      default:
        return { bg: "#f3f4f6", text: "#6b7280" };
    }
  };

  const roleColors = getRoleColor(member.role);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.memberInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color="#6b7280" />
          </View>
          <View style={styles.memberDetails}>
            <Text style={styles.memberName}>
              {member.display_name || "Team Member"}
            </Text>
            <Text style={styles.memberStatus}>
              {member.status === "pending" ? "Invitation pending" : "Active"}
            </Text>
          </View>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
          <Text style={[styles.roleBadgeText, { color: roleColors.text }]}>
            {member.role}
          </Text>
        </View>
      </View>

      {member.role !== "owner" && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onChangeRole(member)}
          >
            <Ionicons name="swap-horizontal" size={16} color="#6b7280" />
            <Text style={styles.actionButtonText}>Change Role</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemove(member)}
          >
            <Ionicons name="person-remove" size={16} color="#ef4444" />
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

interface MemberListProps {
  members: OrganizationMember[];
  onChangeRole: (member: OrganizationMember, role: string) => void;
  onRemove: (member: OrganizationMember) => void;
  onAddMember: () => void;
}

export function MemberList({
  members,
  onChangeRole,
  onRemove,
  onAddMember,
}: MemberListProps) {
  const handleChangeRole = useCallback(
    (member: OrganizationMember) => {
      Alert.alert(
        "Change Role",
        `Select new role for ${member.display_name}`,
        ROLES.filter((r) => r.value !== "owner")
          .map((role) => ({
            text: role.label,
            onPress: () => onChangeRole(member, role.value),
          }))
          .concat([{ text: "Cancel", style: "cancel" }] as any)
      );
    },
    [onChangeRole]
  );

  const handleRemove = useCallback(
    (member: OrganizationMember) => {
      Alert.alert(
        "Remove Member",
        `Are you sure you want to remove ${
          member.display_name || "this member"
        }?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => onRemove(member),
          },
        ]
      );
    },
    [onRemove]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Team Members ({members.length})</Text>
        <TouchableOpacity style={styles.addButton} onPress={onAddMember}>
          <Ionicons name="person-add" size={16} color="white" />
          <Text style={styles.addButtonText}>Add Member</Text>
        </TouchableOpacity>
      </View>

      {members.map((member) => (
        <MemberCard
          key={member._id}
          member={member}
          onChangeRole={handleChangeRole}
          onRemove={handleRemove}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "white",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  memberDetails: {
    marginLeft: 12,
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  memberStatus: {
    fontSize: 14,
    color: "#6b7280",
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  cardActions: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    color: "#6b7280",
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    gap: 4,
  },
  removeButtonText: {
    fontSize: 14,
    color: "#ef4444",
  },
});
