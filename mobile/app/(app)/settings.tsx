import { useState } from "react";
import { ScrollView, View, Alert } from "react-native";
import Toast from "react-native-toast-message";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBiometric } from "@/hooks/useBiometric";
import { useOrganization } from "@/hooks/useOrganization";
import { useTheme } from "@/hooks/useTheme";
import {
  exportTransactionsPdf,
  exportTransactionsByCategoryPdf,
  exportTransactionsByCounterpartyPdf,
  exportTransactionsByAccountPdf,
} from "@/services/reports";
import { exportBackupToFile, importBackupFromFile } from "@/services/backup";
import { verifyBalances, reconcileBalances } from "@/services/reconciliation";
import { ScreenHeader } from "@/components/screen-header";
import { ActionButton } from "@/components/action-button";
import { ProfileEditModal } from "@/components/profile-edit-modal";
import { BiometricSettingsModal } from "@/components/modals/biometric-settings-modal";
import { queryKeys } from "@/lib/queryKeys";
import {
  ProfileSection,
  SecuritySection,
  PDFReportsSection,
  BackupSection,
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
  const [verifying, setVerifying] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const orgId = activeOrganization?._id;

  const handleVerifyBalances = async () => {
    setVerifying(true);
    try {
      const report = await verifyBalances(orgId);
      if (report.is_consistent) {
        Toast.show({
          type: "success",
          text1: "Balances verified",
          text2: `All ${report.accounts_checked} account(s) are consistent.`,
        });
      } else {
        const discrepancyNames = report.discrepancies
          .slice(0, 3)
          .map((d) => d.account_name)
          .join(", ");
        Alert.alert(
          "Balance Discrepancy Detected",
          `${report.discrepancies.length} account(s) have mismatched balances: ${discrepancyNames}. Use "Fix Balances" to correct them automatically.`,
          [
            { text: "Dismiss", style: "cancel" },
            { text: "Fix Now", onPress: handleReconcileBalances },
          ],
        );
      }
    } catch {
      Toast.show({
        type: "error",
        text1: "Verification failed",
        text2: "Could not reach server.",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleReconcileBalances = async () => {
    Alert.alert(
      "Fix Account Balances",
      "This will recalculate all account balances from your full transaction history. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Fix Balances",
          onPress: async () => {
            setReconciling(true);
            try {
              const result = await reconcileBalances(orgId);
              void queryClient.invalidateQueries({ queryKey: ["accounts"] });
              void queryClient.invalidateQueries({
                queryKey: ["transactions"],
              });
              Toast.show({
                type: result.is_fully_consistent ? "success" : "info",
                text1: result.is_fully_consistent
                  ? "Balances are correct"
                  : `Fixed ${result.corrections_made} account(s)`,
                text2: `${result.accounts_processed} accounts processed · ${result.transactions_updated} transactions updated`,
              });
            } catch {
              Toast.show({
                type: "error",
                text1: "Reconciliation failed",
                text2: "Could not reach server.",
              });
            } finally {
              setReconciling(false);
            }
          },
        },
      ],
    );
  };

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
              label={verifying ? "Verifying..." : "Verify Balances"}
              subLabel="Check if all account balances are mathematically correct"
              onPress={handleVerifyBalances}
              disabled={verifying || reconciling}
              color="#10b981"
              bgColor="bg-emerald-50"
            />
            <View className="h-3" />
            <ActionButton
              icon="refresh-outline"
              label={reconciling ? "Fixing..." : "Fix Balances"}
              subLabel="Recalculate all balances from transaction history"
              onPress={handleReconcileBalances}
              disabled={verifying || reconciling}
              color="#f59e0b"
              bgColor="bg-amber-50"
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
    </View>
  );
}
