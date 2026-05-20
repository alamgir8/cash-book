import { useState, useEffect } from "react";
import { RefreshControl, ScrollView, View, Alert, Text } from "react-native";
import Toast from "react-native-toast-message";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useBiometric } from "@/hooks/use-biometric";
import { useOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useDeleteMode } from "@/hooks/use-delete-mode";
import {
  exportTransactionsPdf,
  exportTransactionsByCategoryPdf,
  exportTransactionsByCounterpartyPdf,
  exportTransactionsByAccountPdf,
} from "@/services/reports";
import {
  exportBackupToFile,
  importBackupFromFile,
  shareLatestAutoBackup,
} from "@/services/backup";
import { useAutoBackup, writeBackupFile } from "@/hooks/use-auto-backup";
import { BalanceCheckModal } from "@/components/settings/balance-check-modal";
import { ScreenHeader } from "@/components/screen-header";
import { ActionButton } from "@/components/action-button";
import { ProfileEditModal } from "@/components/profile-edit-modal";
import { BiometricSettingsModal } from "@/components/modals/biometric-settings-modal";
import { queryKeys } from "@/lib/queryKeys";
import { refreshAppData } from "@/lib/refresh-app-data";
import {
  ProfileSection,
  SecuritySection,
  PDFReportsSection,
  BackupSection,
  AutoBackupSection,
  BusinessManagementSection,
  AppInfoSection,
  ThemeSection,
} from "@/components/settings";

type ExportType = "all" | "category" | "counterparty" | "account" | null;

export default function SettingsScreen() {
  const { state, signOut } = useAuth();
  const {
    activeOrganization,
    isPersonalMode,
    canManageCategories,
    canManageParties,
    canManageInvoices,
    canViewReports,
    canExportData,
    canBackupRestore,
    isOwner,
  } = useOrganization();

  // Get user email for per-user biometric status
  const userEmail =
    state.status === "authenticated" ? state.user.email : undefined;
  const {
    status: biometricStatus,
    getBiometricDisplayName,
    getBiometricIconName,
  } = useBiometric({ userIdentifier: userEmail });
  const queryClient = useQueryClient();

  // State
  const [exportingType, setExportingType] = useState<ExportType>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [showBalanceCheck, setShowBalanceCheck] = useState(false);
  const { recordTap, isDeleteModeActive, secondsLeft } = useDeleteMode();

  // Auto-backup
  const userId = state.status === "authenticated" ? state.user._id : undefined;
  const {
    enabled: autoBackupEnabled,
    setEnabled: setAutoBackupEnabled,
    lastBackupAt,
    refreshLastBackupAt,
  } = useAutoBackup(userId);

  const orgId = activeOrganization?.id;

  // Handlers
  const handleExport = async (type: ExportType) => {
    if (!type) return;
    try {
      setExportingType(type);
      switch (type) {
        case "all":
          await exportTransactionsPdf({});
          Toast.show({ type: "success", text1: "Full report exported" });
          break;
        case "category":
          await exportTransactionsByCategoryPdf();
          Toast.show({
            type: "success",
            text1: "Category-wise report exported",
          });
          break;
        case "counterparty":
          await exportTransactionsByCounterpartyPdf();
          Toast.show({
            type: "success",
            text1: "Counterparty-wise report exported",
          });
          break;
        case "account":
          await exportTransactionsByAccountPdf();
          Toast.show({
            type: "success",
            text1: "Account-wise report exported",
          });
          break;
      }
    } catch {
      Toast.show({ type: "error", text1: "Failed to export report" });
    } finally {
      setExportingType(null);
    }
  };

  const handleBackup = async () => {
    try {
      setBackingUp(true);
      const filename = await exportBackupToFile();
      Toast.show({
        type: "success",
        text1: "Backup created successfully",
        text2: `Saved as ${filename}`,
      });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Failed to create backup",
        text2: error?.message || "Please try again",
      });
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = () => {
    Alert.alert(
      "Restore Backup",
      "This will import data from a backup file. Existing data will NOT be deleted, but duplicate categories will be skipped. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Select File",
          onPress: performRestore,
        },
      ],
    );
  };

  const performRestore = async () => {
    try {
      setRestoring(true);
      const result = await importBackupFromFile();

      if (!result || !result.summary) {
        throw new Error("Invalid response from server");
      }

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });

      const { summary } = result;
      const details: string[] = [];
      if (summary.accountsImported)
        details.push(`${summary.accountsImported} accounts`);
      if (summary.categoriesImported)
        details.push(`${summary.categoriesImported} categories`);
      if (summary.transactionsImported)
        details.push(`${summary.transactionsImported} transactions`);
      if (summary.transfersImported)
        details.push(`${summary.transfersImported} transfers`);

      const balanceText = summary.totalBalance
        ? ` (Balance: ${summary.totalBalance.toLocaleString()})`
        : "";

      Toast.show({
        type: "success",
        text1: "Backup restored successfully",
        text2: details.join(", ") + balanceText || "No data imported",
        visibilityTime: 5000,
      });
    } catch (error: any) {
      if (error?.message === "No file selected") return;

      let message = "Please try again";
      if (error?.response?.data?.message) {
        message = error.response.data.message;
      } else if (error?.response?.data?.errors) {
        message = "Invalid backup file format";
      } else if (error?.message) {
        message = error.message;
      }

      Toast.show({
        type: "error",
        text1: "Failed to restore backup",
        text2: message,
        visibilityTime: 4000,
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleAutoShare = async () => {
    try {
      const filename = await shareLatestAutoBackup();
      if (!filename) {
        Toast.show({
          type: "info",
          text1: "No backup yet",
          text2: "Tap 'Backup Now' first to create a local backup",
        });
      }
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Could not share backup",
        text2: e?.message,
      });
    }
  };

  // onBackupNow is passed to AutoBackupSection; receives progress callback, returns stats
  const handleAutoBackupNow = async (
    onProgress: (step: string, pct: number) => void,
  ) => {
    if (!userId) throw new Error("Not logged in");
    const stats = await writeBackupFile(userId, onProgress);
    void refreshLastBackupAt(); // update hook's lastBackupAt for share button text
    return stats;
  };

  // Get user info (userEmail already defined above for biometric)
  const isAuthenticated = state.status === "authenticated";
  const userName = isAuthenticated ? state.user.name : "Unknown User";
  const userPhone = isAuthenticated ? state.user.phone : undefined;
  const userRole = activeOrganization?.role;

  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Settings"
        subtitle="Profile and app preferences"
        icon="settings"
        iconColor="#8b5cf6"
        gradientFrom="from-purple-100"
        gradientTo="to-purple-200"
        onIconPress={recordTap}
        rightAction={
          isDeleteModeActive ? (
            <View
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: colors.error + "25" }}
            >
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colors.error }}
              />
              <Text
                style={{ color: colors.error }}
                className="text-xs font-bold"
              >
                Delete mode {secondsLeft}s
              </Text>
            </View>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 20,
          gap: 20,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void refreshAppData(queryClient)}
            tintColor={colors.info}
            colors={[colors.info]}
          />
        }
      >
        {/* Profile Section */}
        <ProfileSection
          userName={userName}
          userEmail={userEmail}
          userPhone={userPhone}
          userRole={userRole}
          organizationName={activeOrganization?.name}
          isPersonalMode={isPersonalMode}
          onEditProfile={() => setShowProfileModal(true)}
          onPreferences={() => setShowProfileModal(true)}
        />

        {/* Security Section */}
        <SecuritySection
          biometricType={biometricStatus?.biometricType}
          isEnabled={biometricStatus?.isEnabled}
          isAvailable={biometricStatus?.isAvailable}
          getBiometricDisplayName={getBiometricDisplayName}
          getBiometricIconName={getBiometricIconName}
          onPress={() => setShowBiometricModal(true)}
        />

        {/* Theme Section */}
        <ThemeSection />

        {/* PDF Reports Section - Role Based */}
        {(canViewReports || canExportData) && (
          <PDFReportsSection
            exportingType={exportingType}
            onExport={handleExport}
          />
        )}

        {/* Backup Section - Owner or users with backup permission */}
        {canBackupRestore && (
          <BackupSection
            backingUp={backingUp}
            restoring={restoring}
            onBackup={handleBackup}
            onRestore={handleRestore}
          />
        )}

        {/* Auto Backup Section */}
        <AutoBackupSection
          enabled={autoBackupEnabled}
          onToggle={(val) => void setAutoBackupEnabled(val)}
          initialLastBackupAt={lastBackupAt}
          onBackupNow={handleAutoBackupNow}
          onShare={handleAutoShare}
        />

        {/* Balance Integrity Section — always visible to account owners */}
        {(isPersonalMode || isOwner) && (
          <View
            className="rounded-3xl p-6 border shadow-sm"
            style={{
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
            }}
          >
            <ActionButton
              icon="shield-checkmark-outline"
              label="Balance Health Check"
              subLabel="Verify and fix account balances from transaction history"
              onPress={() => setShowBalanceCheck(true)}
              color="#10b981"
              bgColor="bg-emerald-50"
            />
          </View>
        )}

        {/* Manage Categories - Role Based */}
        {canManageCategories && (
          <View
            className="rounded-3xl p-6 border shadow-sm"
            style={{
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
            }}
          >
            <ActionButton
              icon="list"
              label="Manage Categories"
              subLabel="Add or edit income & expense categories"
              onPress={() => router.push("/categories")}
              color="#8b5cf6"
              bgColor="bg-purple-50"
            />
          </View>
        )}

        {/* Business Management Section */}
        <BusinessManagementSection
          canManageParties={canManageParties}
          canManageInvoices={canManageInvoices}
          isOwner={isOwner}
        />

        {/* App Info Section */}
        <AppInfoSection />

        {/* Sign Out Section */}
        <View
          className="rounded-3xl p-6 border shadow-lg"
          style={{
            backgroundColor: colors.bg.secondary,
            borderColor: colors.error + "40",
          }}
        >
          <ActionButton
            label="Sign Out"
            onPress={signOut}
            variant="danger"
            size="medium"
            icon="log-out-outline"
            fullWidth
          />
        </View>

        {/* Bottom spacing for safe area */}
        <View className="h-10" />
      </ScrollView>

      {/* Modals */}
      <ProfileEditModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      <BiometricSettingsModal
        visible={showBiometricModal}
        onClose={() => setShowBiometricModal(false)}
        userEmail={userEmail}
      />

      <BalanceCheckModal
        visible={showBalanceCheck}
        onClose={() => setShowBalanceCheck(false)}
        organizationId={orgId}
      />
    </View>
  );
}
