import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Organization } from "../../services/organizations";

interface OrganizationInfoCardProps {
  organization: Organization;
  onPressSettings: () => void;
}

export function OrganizationInfoCard({
  organization,
  onPressSettings,
}: OrganizationInfoCardProps) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "active":
        return { bg: "#dcfce7", text: "#16a34a" };
      case "suspended":
        return { bg: "#fef3c7", text: "#ca8a04" };
      case "archived":
        return { bg: "#fee2e2", text: "#dc2626" };
      default:
        return { bg: "#e5e7eb", text: "#6b7280" };
    }
  };

  const statusColors = getStatusColor(organization.status);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="business" size={28} color="#3b82f6" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.organizationName}>{organization.name}</Text>
          <Text style={styles.businessType}>
            {organization.business_type?.replace("_", " ")}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={onPressSettings}
        >
          <Ionicons name="settings-outline" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {organization.description && (
        <Text style={styles.description}>{organization.description}</Text>
      )}

      <View style={styles.tagsContainer}>
        {organization.contact?.phone && (
          <View style={styles.tag}>
            <Ionicons name="call" size={14} color="#6b7280" />
            <Text style={styles.tagText}>{organization.contact.phone}</Text>
          </View>
        )}
        {organization.contact?.email && (
          <View style={styles.tag}>
            <Ionicons name="mail" size={14} color="#6b7280" />
            <Text style={styles.tagText}>{organization.contact.email}</Text>
          </View>
        )}
        <View style={styles.tag}>
          <Ionicons name="cash" size={14} color="#6b7280" />
          <Text style={styles.tagText}>
            {organization.settings?.currency_code ||
              organization.settings?.currency ||
              "USD"}
          </Text>
        </View>
        <View style={[styles.statusTag, { backgroundColor: statusColors.bg }]}>
          <Ionicons
            name={
              organization.status === "active"
                ? "checkmark-circle"
                : organization.status === "suspended"
                ? "pause-circle"
                : "archive"
            }
            size={14}
            color={statusColors.text}
          />
          <Text style={[styles.statusTagText, { color: statusColors.text }]}>
            {organization.status || "active"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  organizationName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  businessType: {
    fontSize: 14,
    color: "#6b7280",
    textTransform: "capitalize",
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagText: {
    fontSize: 14,
    color: "#6b7280",
  },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusTagText: {
    fontSize: 14,
    fontWeight: "500",
    textTransform: "capitalize",
  },
});
