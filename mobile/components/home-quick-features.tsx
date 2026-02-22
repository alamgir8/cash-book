import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useOrganization } from "../hooks/useOrganization";
import { useTheme } from "../hooks/useTheme";

type FeatureItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bgColor: string;
  onPress: () => void;
};

const FeatureItem = ({
  icon,
  label,
  color,
  bgColor,
  onPress,
}: FeatureItemProps) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      className="items-center w-[23%] mb-4"
      activeOpacity={0.7}
    >
      <View
        className={`w-14 h-14 rounded-2xl items-center justify-center ${bgColor} border border-gray-100 shadow-sm`}
        style={{
          shadowColor: color,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text
        className="text-xs font-medium mt-2 text-center"
        style={{ color: colors.text.primary }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

type HomeQuickFeaturesProps = {
  onAddTransaction: () => void;
  onAddTransfer: () => void;
  onExportPDF: () => void;
};

export const HomeQuickFeatures = ({
  onAddTransaction,
  onAddTransfer,
  onExportPDF,
}: HomeQuickFeaturesProps) => {
  const { colors } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const {
    canCreateTransactions,
    canManageCategories,
    canViewReports,
    canManageParties,
    canManageInvoices,
    canViewInvoices,
    canCreateInvoices,
    canManageCustomers,
    canExportData,
    canBackupRestore,
    canViewTransactions,
    canManageMembers,
    isOwner,
    isManager,
    activeOrganization,
  } = useOrganization();

  // Primary actions - always visible (first row)
  const primaryFeatures = [
    {
      id: "add-income",
      icon: "trending-up" as const,
      label: "Add Income",
      color: "#10b981",
      bgColor: "bg-emerald-50",
      onPress: onAddTransaction,
      permission: canCreateTransactions,
    },
    {
      id: "add-expense",
      icon: "trending-down" as const,
      label: "Add Expense",
      color: "#ef4444",
      bgColor: "bg-red-50",
      onPress: onAddTransaction,
      permission: canCreateTransactions,
    },
    {
      id: "transfer",
      icon: "swap-horizontal" as const,
      label: "Transfer",
      color: "#8b5cf6",
      bgColor: "bg-purple-50",
      onPress: onAddTransfer,
      permission: canCreateTransactions,
    },
    {
      id: "accounts",
      icon: "wallet" as const,
      label: "Accounts",
      color: "#3b82f6",
      bgColor: "bg-blue-50",
      onPress: () => router.push("/(app)/accounts"),
      permission: true, // Everyone can view accounts
    },
  ];

  // Secondary actions - second row
  const secondaryFeatures = [
    {
      id: "add-invoice",
      icon: "document-text" as const,
      label: "Add Invoice",
      color: "#ec4899",
      bgColor: "bg-pink-50",
      onPress: () => router.push("/(app)/invoices/new?type=sale"),
      permission: canCreateInvoices, // Only if can create invoices
    },
    {
      id: "add-customer",
      icon: "person-add" as const,
      label: "Add Customer",
      color: "#14b8a6",
      bgColor: "bg-teal-50",
      onPress: () => router.push("/(app)/parties/new?type=customer"),
      permission: canManageCustomers, // Only if can manage customers
    },
    {
      id: "transactions",
      icon: "receipt" as const,
      label: "Transactions",
      color: "#6366f1",
      bgColor: "bg-indigo-50",
      onPress: () => router.push("/(app)/transactions"),
      permission: canViewTransactions, // Based on view_transactions permission
    },
    {
      id: "invoices",
      icon: "document-text" as const,
      label: "Invoices",
      color: "#a855f7",
      bgColor: "bg-purple-50",
      onPress: () => router.push("/(app)/invoices"),
      permission: canViewInvoices, // View invoices
    },
    {
      id: "import",
      icon: "cloud-upload" as const,
      label: "Import",
      color: "#0891b2",
      bgColor: "bg-cyan-50",
      onPress: () => router.push("/(app)/import"),
      permission: canCreateTransactions,
    },
  ];

  // More features - shown when "See More" is pressed
  const moreFeatures = [
    {
      id: "categories",
      icon: "grid" as const,
      label: "Categories",
      color: "#f59e0b",
      bgColor: "bg-amber-50",
      onPress: () => router.push("/(app)/categories"),
      permission: canManageCategories, // Only owner/manager
    },
    {
      id: "parties",
      icon: "people" as const,
      label: "Parties",
      color: "#14b8a6",
      bgColor: "bg-teal-50",
      onPress: () => router.push("/(app)/parties"),
      permission: canManageParties, // Can view all parties
    },
    {
      id: "reports",
      icon: "bar-chart" as const,
      label: "Reports",
      color: "#0ea5e9",
      bgColor: "bg-sky-50",
      onPress: onExportPDF,
      permission: canViewReports,
    },
    {
      id: "export-pdf",
      icon: "download" as const,
      label: "Export PDF",
      color: "#22c55e",
      bgColor: "bg-green-50",
      onPress: onExportPDF,
      permission: canExportData,
    },
    {
      id: "backup",
      icon: "cloud-upload" as const,
      label: "Backup",
      color: "#6366f1",
      bgColor: "bg-indigo-50",
      onPress: () => router.push("/(app)/settings"),
      permission: canBackupRestore,
    },
    {
      id: "organizations",
      icon: "business" as const,
      label: "Organizations",
      color: "#7c3aed",
      bgColor: "bg-violet-50",
      onPress: () => router.push("/(app)/organizations"),
      permission: isOwner, // Only owners can manage organizations
    },
    {
      id: "settings",
      icon: "settings" as const,
      label: "Settings",
      color: "#64748b",
      bgColor: "bg-slate-50",
      onPress: () => router.push("/(app)/settings"),
      permission: true, // Everyone can access settings
    },
    {
      id: "profile",
      icon: "person" as const,
      label: "Profile",
      color: "#f97316",
      bgColor: "bg-orange-50",
      onPress: () => router.push("/(app)/settings"),
      permission: true, // Everyone can access profile
    },
  ];

  // Filter by permissions
  const visiblePrimary = primaryFeatures.filter((f) => f.permission);
  const visibleSecondary = secondaryFeatures.filter((f) => f.permission);
  const visibleMore = moreFeatures.filter((f) => f.permission);

  return (
    <View
      className="rounded-3xl p-5 border shadow-sm"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      {/* Section Title */}
      <View className="flex-row items-center justify-between mb-4">
        <Text
          className="text-lg font-bold"
          style={{ color: colors.text.primary }}
        >
          Quick Features
        </Text>
        {activeOrganization && (
          <View
            className="px-2 py-1 rounded-full"
            style={{ backgroundColor: colors.info + "15" }}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: colors.info }}
            >
              {activeOrganization.name}
            </Text>
          </View>
        )}
      </View>

      {/* Primary Features Row */}
      <View className="flex-row flex-wrap justify-between">
        {visiblePrimary.map((feature) => (
          <FeatureItem key={feature.id} {...feature} />
        ))}
      </View>

      {/* Secondary Features Row */}
      <View className="flex-row flex-wrap justify-between mt-2">
        {visibleSecondary.map((feature) => (
          <FeatureItem key={feature.id} {...feature} />
        ))}
      </View>

      {/* More Features - Expandable */}
      {showAll && visibleMore.length > 0 && (
        <View
          className="flex-row flex-wrap justify-between mt-2 pt-4 border-t"
          style={{ borderColor: colors.border }}
        >
          {visibleMore.map((feature) => (
            <FeatureItem key={feature.id} {...feature} />
          ))}
          {/* Add empty placeholders to maintain grid layout */}
          {visibleMore.length % 4 !== 0 &&
            [...Array(4 - (visibleMore.length % 4))].map((_, i) => (
              <View key={`empty-${i}`} className="w-[23%] mb-4" />
            ))}
        </View>
      )}

      {/* See More / See Less Button */}
      {visibleMore.length > 0 && (
        <TouchableOpacity
          onPress={() => setShowAll(!showAll)}
          className="flex-row items-center justify-center mt-3 pt-3 border-t"
          style={{ borderColor: colors.border }}
          activeOpacity={0.7}
        >
          <Text
            className="font-semibold text-sm mr-1"
            style={{ color: colors.info }}
          >
            {showAll ? "See Less" : "See More"}
          </Text>
          <Ionicons
            name={showAll ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.info}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};
