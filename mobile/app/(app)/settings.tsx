import { useState } from "react";
import { ScrollView, View, Alert } from "react-native";
import Toast from "react-native-toast-message";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { useBiometric } from "../../hooks/useBiometric";
import { useOrganization } from "../../hooks/useOrganization";
import {
  exportTransactionsPdf,
  exportTransactionsByCategoryPdf,
  exportTransactionsByCounterpartyPdf,
  exportTransactionsByAccountPdf,
} from "../../services/reports";
import {
  exportBackupToFile,
  importBackupFromFile,
} from "../../services/backup";
import { ScreenHeader } from "../../components/screen-header";
import { ActionButton } from "../../components/action-button";
import { ProfileEditModal } from "../../components/profile-edit-modal";
import { BiometricSettingsModal } from "../../components/biometric-settings-modal";
import { queryKeys } from "../../lib/queryKeys";
import {
  ProfileSection,
  SecuritySection,
  PDFReportsSection,
  BackupSection,
  BusinessManagementSection,
  AppInfoSection,
} from "../../components/settings";

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
      ]
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

  // Get user info (userEmail already defined above for biometric)
  const isAuthenticated = state.status === "authenticated";
  const userName = isAuthenticated ? state.user.name : "Unknown User";
  const userPhone = isAuthenticated ? state.user.phone : undefined;
  const userRole = activeOrganization?.role;

  return (
    <View className="flex-1 bg-gradient-to-b from-purple-50 to-gray-50">
      <ScreenHeader
        title="Settings"
        subtitle="Profile and app preferences"
        icon="settings"
        iconColor="#8b5cf6"
        gradientFrom="from-purple-100"
        gradientTo="to-purple-200"
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 20,
          gap: 20,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
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

        {/* Manage Categories - Role Based */}
        {canManageCategories && (
          <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
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
        <View className="bg-white rounded-3xl p-6 border border-red-100 shadow-lg">
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
    </View>
  );
}
