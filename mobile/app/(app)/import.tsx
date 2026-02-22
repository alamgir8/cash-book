import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAccounts } from "@/hooks/use-accounts";
import { useOrganization } from "@/hooks/useOrganization";
import { createAccount } from "@/services/accounts";
import { queryKeys } from "@/lib/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import {
  useImportList,
  useImportDetail,
  useUploadFile,
  useUpdateMapping,
  useUpdateItems,
  useExecuteImport,
  useDeleteImport,
} from "@/hooks/use-imports";
import { ScreenHeader } from "@/components/screen-header";
import { ImportPreview } from "@/components/import/import-preview";
import type { ItemUpdatePayload } from "@/components/import/import-preview";
import { ColumnMappingEditor } from "@/components/import/column-mapping-editor";
import { ImportHistoryCard } from "@/components/import/import-history-card";
import { SearchableSelect } from "@/components/searchable-select";
import type {
  ColumnMapping,
  ImportRecord,
  AccountColumnMapping,
  ParseWarning,
} from "@/services/imports";

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  currentStep,
  colors,
}: {
  currentStep: number;
  colors: any;
}) {
  const steps = [
    { label: "Upload", icon: "cloud-upload-outline" },
    { label: "Map & Review", icon: "options-outline" },
    { label: "Import", icon: "rocket-outline" },
  ];

  return (
    <View className="flex-row items-center justify-center px-6 py-3 gap-1">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <React.Fragment key={step.label}>
            <View className="items-center" style={{ minWidth: 70 }}>
              <View
                className="w-9 h-9 rounded-full items-center justify-center mb-1"
                style={{
                  backgroundColor: isActive
                    ? colors.info
                    : isCompleted
                      ? colors.success
                      : colors.bg.tertiary,
                }}
              >
                <Ionicons
                  name={
                    isCompleted
                      ? "checkmark"
                      : (step.icon as keyof typeof Ionicons.glyphMap)
                  }
                  size={18}
                  color={
                    isActive || isCompleted ? "#ffffff" : colors.text.tertiary
                  }
                />
              </View>
              <Text
                style={{
                  color: isActive
                    ? colors.info
                    : isCompleted
                      ? colors.success
                      : colors.text.tertiary,
                }}
                className="text-xs font-medium"
              >
                {step.label}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View
                className="h-[2px] flex-1 mx-1 mt-[-12px]"
                style={{
                  backgroundColor: isCompleted ? colors.success : colors.border,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Upload Step ──────────────────────────────────────────────────────────────

function UploadStep({
  onFilePicked,
  isUploading,
  uploadError,
  colors,
}: {
  onFilePicked: (uri: string, name: string, mimeType: string) => void;
  isUploading: boolean;
  uploadError: any;
  colors: any;
}) {
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      onFilePicked(
        file.uri,
        file.name || "import_file",
        file.mimeType || "application/octet-stream",
      );
    } catch (error: any) {
      Alert.alert("Error", "Failed to pick file: " + error.message);
    }
  };

  return (
    <View className="flex-1 items-center justify-center px-6">
      {isUploading ? (
        <View className="items-center gap-4">
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.info + "15" }}
          >
            <ActivityIndicator size="large" color={colors.info} />
          </View>
          <Text
            style={{ color: colors.text.primary }}
            className="text-xl font-bold"
          >
            Analyzing File...
          </Text>
          <Text
            style={{ color: colors.text.secondary }}
            className="text-sm text-center leading-5"
          >
            Detecting columns, parsing dates and amounts.{"\n"}This may take a
            moment for large files.
          </Text>

          {/* Animated dots */}
          <View className="flex-row gap-2 mt-2">
            {["Extracting text", "Detecting format", "Parsing rows"].map(
              (step, i) => (
                <View
                  key={step}
                  className="px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: colors.bg.tertiary }}
                >
                  <Text
                    style={{ color: colors.text.tertiary }}
                    className="text-xs"
                  >
                    {step}
                  </Text>
                </View>
              ),
            )}
          </View>
        </View>
      ) : (
        <View className="w-full">
          {/* Upload error display */}
          {uploadError && (
            <View
              className="mb-5 p-4 rounded-2xl border"
              style={{
                backgroundColor: colors.error + "10",
                borderColor: colors.error + "30",
              }}
            >
              <View className="flex-row items-center gap-2 mb-1">
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text
                  style={{ color: colors.error }}
                  className="text-sm font-bold"
                >
                  Upload Failed
                </Text>
              </View>
              <Text
                style={{ color: colors.text.secondary }}
                className="text-xs"
              >
                {uploadError?.response?.data?.message ||
                  uploadError?.message ||
                  "Something went wrong. Please try again."}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handlePickFile}
            activeOpacity={0.8}
            className="items-center rounded-3xl p-10 border-2 border-dashed w-full"
            style={{
              borderColor: colors.info + "50",
              backgroundColor: colors.info + "08",
            }}
          >
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-5"
              style={{ backgroundColor: colors.info + "20" }}
            >
              <Ionicons name="cloud-upload" size={40} color={colors.info} />
            </View>

            <Text
              style={{ color: colors.text.primary }}
              className="text-xl font-bold mb-2"
            >
              Upload Bank Statement
            </Text>
            <Text
              style={{ color: colors.text.secondary }}
              className="text-sm text-center mb-6 leading-5"
            >
              Upload your PDF or Excel bank statement.{"\n"}
              Supports Bengali (বাংলা) and English formats.
            </Text>

            <View
              className="px-6 py-3 rounded-full"
              style={{ backgroundColor: colors.info }}
            >
              <Text className="text-white font-bold text-base">
                Choose File
              </Text>
            </View>

            <View className="flex-row items-center gap-4 mt-6">
              {[
                { ext: "PDF", color: "#ef4444", icon: "document-text" },
                { ext: "XLSX", color: "#10b981", icon: "grid" },
                { ext: "XLS", color: "#10b981", icon: "grid" },
                { ext: "CSV", color: "#f59e0b", icon: "list" },
              ].map((type) => (
                <View key={type.ext} className="items-center gap-1">
                  <Ionicons
                    name={type.icon as any}
                    size={20}
                    color={type.color}
                  />
                  <Text
                    style={{ color: colors.text.tertiary }}
                    className="text-xs"
                  >
                    {type.ext}
                  </Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>

          {/* Pro tip */}
          <View
            className="mt-4 p-3 rounded-xl flex-row items-start gap-2"
            style={{ backgroundColor: colors.info + "08" }}
          >
            <Ionicons
              name="bulb-outline"
              size={16}
              color={colors.info}
              style={{ marginTop: 1 }}
            />
            <Text
              style={{ color: colors.text.secondary }}
              className="text-xs flex-1 leading-4"
            >
              <Text style={{ color: colors.info }} className="font-semibold">
                Tip:
              </Text>{" "}
              For best results, use XLSX (Excel) format. PDF files with Bengali
              fonts may have text extraction issues.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Account Column Mapper (Ledger Mode) ──────────────────────────────────────

function AccountColumnMapper({
  accountColumns,
  onAccountColumnChange,
  accountOptions,
  onAutoCreateAccounts,
  isAutoCreating,
  colors,
}: {
  accountColumns: AccountColumnMapping[];
  onAccountColumnChange: (
    columnName: string,
    accountId: string | undefined,
  ) => void;
  accountOptions: { value: string; label: string; subtitle?: string }[];
  onAutoCreateAccounts: () => void;
  isAutoCreating: boolean;
  colors: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const mappedCount = accountColumns.filter((ac) => ac.account_id).length;
  const totalCount = accountColumns.length;

  return (
    <View className="mx-4 mt-1.5 mb-1">
      {/* Compact header row: Ledger badge + account count + auto-create */}
      <View
        className="flex-row items-center rounded-xl px-3 py-2 gap-2"
        style={{
          backgroundColor: colors.bg.secondary,
          borderWidth: 1,
          borderColor: mappedCount > 0 ? colors.success + "40" : colors.border,
        }}
      >
        {/* Ledger badge */}
        <View
          className="px-2 py-0.5 rounded-md"
          style={{ backgroundColor: colors.info + "15" }}
        >
          <Text
            style={{ color: colors.info }}
            className="text-[10px] font-bold"
          >
            LEDGER
          </Text>
        </View>

        {/* Account count */}
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          className="flex-row items-center gap-1 flex-1"
        >
          <Text
            style={{ color: colors.text.primary }}
            className="text-xs font-bold"
          >
            {totalCount} cols
          </Text>
          <Text
            style={{
              color: mappedCount > 0 ? colors.success : colors.text.tertiary,
            }}
            className="text-[11px]"
          >
            • {mappedCount > 0 ? `${mappedCount} mapped` : "unmapped"}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.text.tertiary}
          />
        </TouchableOpacity>

        {/* Auto-create compact button */}
        {mappedCount < totalCount && (
          <TouchableOpacity
            onPress={onAutoCreateAccounts}
            disabled={isAutoCreating}
            className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg"
            style={{ backgroundColor: colors.success + "15" }}
          >
            {isAutoCreating ? (
              <ActivityIndicator size={12} color={colors.success} />
            ) : (
              <Ionicons name="flash" size={13} color={colors.success} />
            )}
            <Text
              style={{ color: colors.success }}
              className="text-[11px] font-bold"
            >
              {isAutoCreating ? "Creating..." : "Auto-Map"}
            </Text>
          </TouchableOpacity>
        )}
        {mappedCount === totalCount && mappedCount > 0 && (
          <View
            className="flex-row items-center gap-1 px-2 py-1 rounded-lg"
            style={{ backgroundColor: colors.success + "12" }}
          >
            <Ionicons
              name="checkmark-circle"
              size={13}
              color={colors.success}
            />
            <Text
              style={{ color: colors.success }}
              className="text-[11px] font-bold"
            >
              All mapped
            </Text>
          </View>
        )}
      </View>

      {/* Expanded: scrollable list of account columns */}
      {expanded && (
        <ScrollView
          style={{
            maxHeight: 350,
            backgroundColor: colors.bg.secondary,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 4,
          }}
          className="mt-2"
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {accountColumns.map((ac, index) => {
            const matchedAccount = accountOptions.find(
              (opt) => opt.value === ac.account_id,
            );

            return (
              <View key={`${ac.column_name}-${index}`} className="mb-3">
                <View className="flex-row items-center gap-2 mb-1.5">
                  <View
                    className="px-2.5 py-1 rounded-lg flex-shrink-1"
                    style={{ backgroundColor: colors.info + "15" }}
                  >
                    <Text
                      style={{ color: colors.info }}
                      className="text-xs font-bold"
                      numberOfLines={1}
                    >
                      {ac.column_name}
                    </Text>
                  </View>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={colors.text.tertiary}
                  />
                  {matchedAccount ? (
                    <View
                      className="px-2.5 py-1 rounded-lg flex-shrink-1"
                      style={{ backgroundColor: colors.success + "15" }}
                    >
                      <Text
                        style={{ color: colors.success }}
                        className="text-xs font-bold"
                        numberOfLines={1}
                      >
                        ✓ {matchedAccount.label}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: colors.warning }} className="text-xs">
                      Not mapped
                    </Text>
                  )}
                </View>
                <SearchableSelect
                  value={ac.account_id || ""}
                  placeholder={`Select account for "${ac.column_name}"`}
                  options={accountOptions}
                  onSelect={(value) =>
                    onAccountColumnChange(ac.column_name, value || undefined)
                  }
                  label={ac.column_name}
                />
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Parse Warning Banner ─────────────────────────────────────────────────────

function ParseWarningBanner({
  warnings,
  colors,
  onTryAgain,
}: {
  warnings: ParseWarning[];
  colors: any;
  onTryAgain: () => void;
}) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <View className="mx-4 mt-2 mb-2">
      {warnings.map((w, i) => {
        const isPdfIssue = w.code === "PDF_NO_DATA";
        const iconName = isPdfIssue ? "document-text" : "alert-circle";
        const accentColor = isPdfIssue ? colors.warning : colors.error;

        return (
          <View
            key={i}
            className="p-4 rounded-2xl border mb-2"
            style={{
              backgroundColor: accentColor + "08",
              borderColor: accentColor + "25",
            }}
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name={iconName as any} size={20} color={accentColor} />
              <Text
                style={{ color: accentColor }}
                className="text-sm font-bold flex-1"
              >
                {w.title}
              </Text>
            </View>
            <Text
              style={{ color: colors.text.secondary }}
              className="text-xs leading-4 mb-2"
            >
              {w.message}
            </Text>
            {w.suggestion && (
              <View
                className="p-3 rounded-xl flex-row items-start gap-2"
                style={{ backgroundColor: colors.success + "10" }}
              >
                <Ionicons
                  name="bulb"
                  size={14}
                  color={colors.success}
                  style={{ marginTop: 1 }}
                />
                <Text
                  style={{ color: colors.success }}
                  className="text-xs font-medium flex-1 leading-4"
                >
                  {w.suggestion}
                </Text>
              </View>
            )}
            {isPdfIssue && (
              <TouchableOpacity
                onPress={onTryAgain}
                className="mt-3 py-2.5 px-4 rounded-xl flex-row items-center justify-center gap-2"
                style={{ backgroundColor: colors.success + "15" }}
              >
                <Ionicons name="grid" size={16} color={colors.success} />
                <Text
                  style={{ color: colors.success }}
                  className="text-sm font-bold"
                >
                  Upload XLSX Instead
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Empty Parse State ────────────────────────────────────────────────────────

function EmptyParseState({
  importData,
  colors,
  onTryAgain,
}: {
  importData: ImportRecord;
  colors: any;
  onTryAgain: () => void;
}) {
  const isPdf = importData.file_type === "pdf";

  return (
    <View className="flex-1 items-center justify-center px-8">
      <View
        className="w-20 h-20 rounded-full items-center justify-center mb-4"
        style={{ backgroundColor: colors.warning + "15" }}
      >
        <Ionicons name="file-tray-outline" size={40} color={colors.warning} />
      </View>

      <Text
        style={{ color: colors.text.primary }}
        className="text-xl font-bold mb-2 text-center"
      >
        No Transactions Found
      </Text>

      <Text
        style={{ color: colors.text.secondary }}
        className="text-sm text-center leading-5 mb-4"
      >
        {isPdf
          ? "The PDF could not be read properly. Bengali/Bangla fonts in PDFs often use custom encodings that prevent text extraction."
          : "No valid transaction rows were found in this file. The file may be empty or in an unsupported format."}
      </Text>

      {/* File info */}
      <View
        className="w-full p-3 rounded-xl mb-4"
        style={{ backgroundColor: colors.bg.secondary }}
      >
        <View className="flex-row items-center gap-2 mb-1">
          <Ionicons
            name={isPdf ? "document-text" : "grid"}
            size={16}
            color={colors.text.tertiary}
          />
          <Text
            style={{ color: colors.text.secondary }}
            className="text-xs flex-1"
            numberOfLines={1}
          >
            {importData.original_filename}
          </Text>
          <View
            className="px-2 py-0.5 rounded"
            style={{ backgroundColor: colors.bg.tertiary }}
          >
            <Text
              style={{ color: colors.text.tertiary }}
              className="text-[10px] font-bold uppercase"
            >
              {importData.file_type}
            </Text>
          </View>
        </View>
        {importData.parser_metadata && (
          <Text style={{ color: colors.text.tertiary }} className="text-[10px]">
            {importData.parser_metadata.pages
              ? `${importData.parser_metadata.pages} page(s)`
              : ""}
            {importData.parser_metadata.totalTextLines
              ? ` • ${importData.parser_metadata.totalTextLines} lines extracted`
              : ""}
            {importData.parser_metadata.format
              ? ` • Format: ${importData.parser_metadata.format}`
              : ""}
          </Text>
        )}
      </View>

      {/* Suggestions */}
      <View className="w-full gap-2">
        {isPdf && (
          <TouchableOpacity
            onPress={onTryAgain}
            className="p-4 rounded-2xl flex-row items-center gap-3 border"
            style={{
              backgroundColor: colors.success + "08",
              borderColor: colors.success + "20",
            }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.success + "15" }}
            >
              <Ionicons name="grid" size={20} color={colors.success} />
            </View>
            <View className="flex-1">
              <Text
                style={{ color: colors.success }}
                className="text-sm font-bold"
              >
                Try XLSX Format Instead
              </Text>
              <Text
                style={{ color: colors.text.secondary }}
                className="text-xs"
              >
                Download from Google Sheets → File → Download as XLSX
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.success} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onTryAgain}
          className="p-4 rounded-2xl flex-row items-center gap-3 border"
          style={{
            backgroundColor: colors.info + "08",
            borderColor: colors.info + "20",
          }}
        >
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.info + "15" }}
          >
            <Ionicons name="reload" size={20} color={colors.info} />
          </View>
          <View className="flex-1">
            <Text style={{ color: colors.info }} className="text-sm font-bold">
              Upload a Different File
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Try another file or format
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.info} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Map & Review Step ────────────────────────────────────────────────────────

function MapAndReviewStep({
  importData,
  mapping,
  onMappingChange,
  selectedAccountId,
  onAccountChange,
  accountColumns,
  onAccountColumnChange,
  accountOptions,
  onUpdateItems,
  isUpdating,
  parseWarnings,
  onTryAgain,
  onAutoCreateAccounts,
  isAutoCreating,
  colors,
}: {
  importData: ImportRecord;
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  selectedAccountId: string;
  onAccountChange: (accountId: string) => void;
  accountColumns: AccountColumnMapping[];
  onAccountColumnChange: (
    columnName: string,
    accountId: string | undefined,
  ) => void;
  accountOptions: { value: string; label: string; subtitle?: string }[];
  onUpdateItems: (items: ItemUpdatePayload[]) => void;
  isUpdating: boolean;
  parseWarnings: ParseWarning[];
  onTryAgain: () => void;
  onAutoCreateAccounts: () => void;
  isAutoCreating: boolean;
  colors: any;
}) {
  const [showMapping, setShowMapping] = useState(false);
  const isLedger = importData.import_mode === "ledger";
  const isEmpty = importData.total_rows === 0 || importData.items.length === 0;

  // If no items were found, show the empty/warning state
  if (isEmpty) {
    return (
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {parseWarnings.length > 0 && (
          <ParseWarningBanner
            warnings={parseWarnings}
            colors={colors}
            onTryAgain={onTryAgain}
          />
        )}
        <EmptyParseState
          importData={importData}
          colors={colors}
          onTryAgain={onTryAgain}
        />
      </ScrollView>
    );
  }

  return (
    <View className="flex-1">
      {/* Parse Warnings (e.g. low match rate) */}
      {parseWarnings.length > 0 && (
        <ParseWarningBanner
          warnings={parseWarnings}
          colors={colors}
          onTryAgain={onTryAgain}
        />
      )}

      {/* Standard Mode: Single Account Selector */}
      {!isLedger && (
        <View className="px-4 pt-3 pb-2">
          <Text
            style={{ color: colors.text.primary }}
            className="text-sm font-bold mb-2"
          >
            Target Account <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <SearchableSelect
            value={selectedAccountId}
            placeholder="Select account to import into"
            options={accountOptions}
            onSelect={(value) => onAccountChange(value)}
            label="Account"
          />
        </View>
      )}

      {/* Ledger Mode: Account Column Mapping */}
      {isLedger && accountColumns.length > 0 && (
        <AccountColumnMapper
          accountColumns={accountColumns}
          onAccountColumnChange={onAccountColumnChange}
          accountOptions={accountOptions}
          onAutoCreateAccounts={onAutoCreateAccounts}
          isAutoCreating={isAutoCreating}
          colors={colors}
        />
      )}

      {/* Column Mapping Toggle (standard mode only) */}
      {!isLedger && (
        <>
          <TouchableOpacity
            onPress={() => setShowMapping(!showMapping)}
            className="flex-row items-center justify-between mx-4 px-4 py-3 rounded-xl border mb-2"
            style={{
              backgroundColor: colors.bg.secondary,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="options-outline" size={18} color={colors.info} />
              <Text
                style={{ color: colors.text.primary }}
                className="text-sm font-semibold"
              >
                Column Mapping
              </Text>
            </View>
            <Ionicons
              name={showMapping ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>

          {showMapping && (
            <ColumnMappingEditor
              detectedColumns={importData.detected_columns || []}
              mapping={mapping}
              onMappingChange={onMappingChange}
            />
          )}
        </>
      )}

      {/* Preview */}
      <ImportPreview
        importData={importData}
        onUpdateItems={onUpdateItems}
        isUpdating={isUpdating}
      />
    </View>
  );
}

// ─── Import Step (Progress & Results) ─────────────────────────────────────────

function ImportStep({
  importData,
  isImporting,
  importError,
  colors,
}: {
  importData: ImportRecord;
  isImporting: boolean;
  importError: any;
  colors: any;
}) {
  const isCompleted = importData.status === "completed";
  const isFailed = importData.status === "failed";
  const isProcessing = isImporting || importData.status === "importing";

  if (isProcessing) {
    const progress =
      importData.total_rows > 0
        ? Math.round(
            ((importData.imported_count +
              importData.skipped_count +
              importData.failed_count) /
              importData.total_rows) *
              100,
          )
        : 0;

    return (
      <View className="flex-1 items-center justify-center px-6">
        {/* Circular progress indicator */}
        <View
          className="w-28 h-28 rounded-full items-center justify-center mb-5"
          style={{ backgroundColor: colors.info + "12" }}
        >
          <ActivityIndicator size="large" color={colors.info} />
          {progress > 0 && (
            <Text
              style={{ color: colors.info }}
              className="text-lg font-bold mt-1"
            >
              {progress}%
            </Text>
          )}
        </View>

        <Text
          style={{ color: colors.text.primary }}
          className="text-xl font-bold"
        >
          Importing Transactions...
        </Text>
        <Text
          style={{ color: colors.text.secondary }}
          className="text-sm text-center mt-2 leading-5"
        >
          Creating transactions and updating account balances.{"\n"}
          Please don{"'"}t close the app.
        </Text>

        {(importData.imported_count > 0 ||
          importData.skipped_count > 0 ||
          importData.failed_count > 0) && (
          <View className="flex-row gap-3 mt-6">
            <View
              className="px-4 py-2 rounded-xl items-center"
              style={{ backgroundColor: colors.success + "15" }}
            >
              <Text
                style={{ color: colors.success }}
                className="text-lg font-bold"
              >
                {importData.imported_count}
              </Text>
              <Text
                style={{ color: colors.text.secondary }}
                className="text-[10px]"
              >
                Imported
              </Text>
            </View>
            <View
              className="px-4 py-2 rounded-xl items-center"
              style={{ backgroundColor: colors.warning + "15" }}
            >
              <Text
                style={{ color: colors.warning }}
                className="text-lg font-bold"
              >
                {importData.skipped_count}
              </Text>
              <Text
                style={{ color: colors.text.secondary }}
                className="text-[10px]"
              >
                Skipped
              </Text>
            </View>
            {importData.failed_count > 0 && (
              <View
                className="px-4 py-2 rounded-xl items-center"
                style={{ backgroundColor: colors.error + "15" }}
              >
                <Text
                  style={{ color: colors.error }}
                  className="text-lg font-bold"
                >
                  {importData.failed_count}
                </Text>
                <Text
                  style={{ color: colors.text.secondary }}
                  className="text-[10px]"
                >
                  Failed
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  // Handle mutation error (network/server error during import)
  if (importError && !isCompleted && !isFailed) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View
          className="w-24 h-24 rounded-full items-center justify-center mb-5"
          style={{ backgroundColor: colors.error + "15" }}
        >
          <Ionicons name="cloud-offline" size={48} color={colors.error} />
        </View>
        <Text
          style={{ color: colors.text.primary }}
          className="text-2xl font-bold mb-2"
        >
          Import Error
        </Text>
        <Text
          style={{ color: colors.error }}
          className="text-sm text-center mb-4"
        >
          {importError?.response?.data?.message ||
            importError?.message ||
            "A network error occurred during import."}
        </Text>
        <View
          className="p-3 rounded-xl"
          style={{ backgroundColor: colors.bg.secondary }}
        >
          <Text
            style={{ color: colors.text.secondary }}
            className="text-xs text-center"
          >
            Your data is safe. You can try importing again from the history.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center px-6">
      <View
        className="w-24 h-24 rounded-full items-center justify-center mb-5"
        style={{
          backgroundColor: isCompleted
            ? colors.success + "20"
            : colors.error + "20",
        }}
      >
        <Ionicons
          name={isCompleted ? "checkmark-done-circle" : "close-circle"}
          size={56}
          color={isCompleted ? colors.success : colors.error}
        />
      </View>

      <Text
        style={{ color: colors.text.primary }}
        className="text-2xl font-bold mb-2"
      >
        {isCompleted ? "Import Complete!" : "Import Failed"}
      </Text>

      {isCompleted && (
        <Text
          style={{ color: colors.text.secondary }}
          className="text-sm text-center mb-6"
        >
          Your transactions have been imported successfully.
        </Text>
      )}

      {isFailed && importData.error_message && (
        <Text
          style={{ color: colors.error }}
          className="text-sm text-center mb-6"
        >
          {importData.error_message}
        </Text>
      )}

      {/* Result Stats */}
      <View className="w-full gap-3">
        <View className="flex-row gap-3">
          <View
            className="flex-1 rounded-xl p-4 items-center"
            style={{ backgroundColor: colors.success + "15" }}
          >
            <Ionicons
              name="checkmark-circle"
              size={28}
              color={colors.success}
            />
            <Text
              style={{ color: colors.success }}
              className="text-2xl font-bold mt-1"
            >
              {importData.imported_count}
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Imported
            </Text>
          </View>

          <View
            className="flex-1 rounded-xl p-4 items-center"
            style={{ backgroundColor: colors.warning + "15" }}
          >
            <Ionicons name="remove-circle" size={28} color={colors.warning} />
            <Text
              style={{ color: colors.warning }}
              className="text-2xl font-bold mt-1"
            >
              {importData.skipped_count}
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Skipped
            </Text>
          </View>

          <View
            className="flex-1 rounded-xl p-4 items-center"
            style={{ backgroundColor: colors.error + "15" }}
          >
            <Ionicons name="close-circle" size={28} color={colors.error} />
            <Text
              style={{ color: colors.error }}
              className="text-2xl font-bold mt-1"
            >
              {importData.failed_count}
            </Text>
            <Text style={{ color: colors.text.secondary }} className="text-xs">
              Failed
            </Text>
          </View>
        </View>

        {/* Totals */}
        <View className="flex-row gap-3">
          <View
            className="flex-1 rounded-xl p-4"
            style={{ backgroundColor: colors.error + "10" }}
          >
            <Text
              style={{ color: colors.text.secondary }}
              className="text-xs mb-1"
            >
              Total Debit
            </Text>
            <Text style={{ color: colors.error }} className="text-lg font-bold">
              {importData.total_debit.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
          <View
            className="flex-1 rounded-xl p-4"
            style={{ backgroundColor: colors.success + "10" }}
          >
            <Text
              style={{ color: colors.text.secondary }}
              className="text-xs mb-1"
            >
              Total Credit
            </Text>
            <Text
              style={{ color: colors.success }}
              className="text-lg font-bold"
            >
              {importData.total_credit.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Main Import Screen ───────────────────────────────────────────────────────

export default function ImportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganization();

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [activeImportId, setActiveImportId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [localMapping, setLocalMapping] = useState<ColumnMapping>({});
  const [localAccountColumns, setLocalAccountColumns] = useState<
    AccountColumnMapping[]
  >([]);
  const [showHistory, setShowHistory] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<ParseWarning[]>([]);
  const [isAutoCreating, setIsAutoCreating] = useState(false);

  // Hooks
  const queryClient = useQueryClient();
  const accountsQuery = useAccounts();
  const importListQuery = useImportList();
  const importDetailQuery = useImportDetail(activeImportId || "");
  const uploadMutation = useUploadFile();
  const updateMappingMutation = useUpdateMapping();
  const updateItemsMutation = useUpdateItems();
  const executeMutation = useExecuteImport();
  const deleteMutation = useDeleteImport();

  // Derived data
  const importData = importDetailQuery.data;

  const accountOptions = useMemo(
    () =>
      (accountsQuery.data || []).map((acc: any) => ({
        value: acc._id,
        label: acc.name,
        subtitle: acc.kind
          ? `${acc.kind} • ${(acc.balance ?? acc.current_balance ?? 0).toLocaleString()}`
          : undefined,
      })),
    [accountsQuery.data],
  );

  // Handlers
  const handleFilePicked = useCallback(
    async (uri: string, name: string, mimeType: string) => {
      try {
        const result = await uploadMutation.mutateAsync({
          fileUri: uri,
          fileName: name,
          fileMimeType: mimeType,
          organizationId: activeOrganization?.id,
        });

        setActiveImportId(result._id);
        setLocalMapping(result.column_mapping || {});
        setLocalAccountColumns(result.account_columns || []);
        setParseWarnings(result.parse_warnings || []);
        setCurrentStep(1); // Always go to step 1, even with 0 items (to show empty state)
        setShowHistory(false);
      } catch {
        // Error toast is handled by the mutation's onError
        // Stay on step 0 so user can try again
      }
    },
    [uploadMutation, activeOrganization],
  );

  const handleMappingChange = useCallback(
    (newMapping: ColumnMapping) => {
      setLocalMapping(newMapping);
      if (activeImportId) {
        updateMappingMutation.mutate({
          importId: activeImportId,
          column_mapping: newMapping,
        });
      }
    },
    [activeImportId, updateMappingMutation],
  );

  const handleAccountColumnChange = useCallback(
    (columnName: string, accountId: string | undefined) => {
      setLocalAccountColumns((prev) => {
        const updated = prev.map((ac) =>
          ac.column_name === columnName ? { ...ac, account_id: accountId } : ac,
        );
        // Also save to backend
        if (activeImportId) {
          updateMappingMutation.mutate({
            importId: activeImportId,
            account_columns: updated,
          });
        }
        return updated;
      });
    },
    [activeImportId, updateMappingMutation],
  );

  const handleAutoCreateAccounts = useCallback(async () => {
    if (isAutoCreating || localAccountColumns.length === 0) return;
    setIsAutoCreating(true);

    try {
      // Get current accounts to avoid duplicates
      const existingAccounts = accountsQuery.data || [];
      const existingNames = new Set(
        existingAccounts.map((a: any) =>
          (a.name || a.label || "").toLowerCase().trim(),
        ),
      );

      const unmappedColumns = localAccountColumns.filter(
        (ac) => !ac.account_id,
      );

      const newAccountMap: Record<string, string> = {};

      // Create accounts sequentially to avoid race conditions
      for (const col of unmappedColumns) {
        const colName = col.column_name.trim();
        if (!colName || existingNames.has(colName.toLowerCase())) {
          // Find existing account by name and map it
          const existing = existingAccounts.find(
            (a: any) =>
              (a.name || a.label || "").toLowerCase().trim() ===
              colName.toLowerCase(),
          );
          if (existing) {
            newAccountMap[col.column_name] =
              (existing as any)._id || (existing as any).id;
          }
          continue;
        }

        try {
          const newAccount = await createAccount({
            name: colName,
            kind: "cash",
          });
          newAccountMap[col.column_name] =
            (newAccount as any)._id || (newAccount as any).id;
          existingNames.add(colName.toLowerCase());
        } catch (err: any) {
          // If account already exists error, try to find it
          console.warn(`Failed to create account "${colName}":`, err?.message);
        }
      }

      // Invalidate accounts cache to refresh the list
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountsOverview,
      });

      // Update local account columns with new mappings
      const updated = localAccountColumns.map((ac) => ({
        ...ac,
        account_id: newAccountMap[ac.column_name] || ac.account_id,
      }));
      setLocalAccountColumns(updated);

      // Save to backend
      if (activeImportId) {
        updateMappingMutation.mutate({
          importId: activeImportId,
          account_columns: updated,
        });
      }

      const createdCount = Object.keys(newAccountMap).length;
      Toast.show({
        type: "success",
        text1: `Created ${createdCount} accounts`,
        text2: "All columns have been auto-mapped.",
      });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Auto-create failed",
        text2: err?.message || "Something went wrong",
      });
    } finally {
      setIsAutoCreating(false);
    }
  }, [
    isAutoCreating,
    localAccountColumns,
    accountsQuery.data,
    activeImportId,
    updateMappingMutation,
    queryClient,
  ]);

  const handleUpdateItems = useCallback(
    (items: ItemUpdatePayload[]) => {
      if (!activeImportId) return;
      updateItemsMutation.mutate({ importId: activeImportId, items });
    },
    [activeImportId, updateItemsMutation],
  );

  const handleExecuteImport = useCallback(() => {
    const isLedger = importData?.import_mode === "ledger";

    if (!activeImportId) return;

    // For standard mode, require a target account
    if (!isLedger && !selectedAccountId) {
      Alert.alert(
        "Required",
        "Please select a target account before importing.",
      );
      return;
    }

    // For ledger mode, check at least one account column is mapped
    if (isLedger) {
      const mappedCount = localAccountColumns.filter(
        (ac) => ac.account_id,
      ).length;
      if (mappedCount === 0 && !selectedAccountId) {
        Alert.alert(
          "Required",
          "Please map at least one account column before importing.",
        );
        return;
      }
    }

    const pendingCount =
      importData?.items.filter((i) => i.status === "pending").length || 0;

    const accountInfo = isLedger
      ? `${localAccountColumns.filter((ac) => ac.account_id).length} mapped accounts`
      : "the selected account";

    Alert.alert(
      "Confirm Import",
      `This will import ${pendingCount} transactions into ${accountInfo}. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import Now",
          style: "destructive",
          onPress: () => {
            // Set step to 2 first to show the importing state
            setCurrentStep(2);
            executeMutation.mutate({
              importId: activeImportId,
              default_account: selectedAccountId || undefined,
              skip_duplicates: true,
            });
          },
        },
      ],
    );
  }, [
    activeImportId,
    selectedAccountId,
    importData,
    executeMutation,
    localAccountColumns,
  ]);

  const handleResumeImport = useCallback((importItem: any) => {
    setActiveImportId(importItem._id);
    setLocalMapping(importItem.column_mapping || {});
    setLocalAccountColumns(importItem.account_columns || []);
    setParseWarnings(importItem.parse_warnings || []);
    setShowHistory(false);

    if (importItem.status === "completed" || importItem.status === "failed") {
      setCurrentStep(2);
    } else {
      setCurrentStep(1);
    }
  }, []);

  const handleDeleteImport = useCallback(
    (importId: string) => {
      Alert.alert(
        "Delete Import",
        "Are you sure you want to delete this import record?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteMutation.mutate(importId),
          },
        ],
      );
    },
    [deleteMutation],
  );

  const handleNewImport = useCallback(() => {
    setActiveImportId(null);
    setSelectedAccountId("");
    setLocalMapping({});
    setLocalAccountColumns([]);
    setParseWarnings([]);
    setCurrentStep(0);
    setShowHistory(false);
    uploadMutation.reset();
  }, [uploadMutation]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <ScreenHeader
        title="Import Transactions"
        subtitle="Import from bank statements"
        icon="cloud-upload-outline"
        showBack
        onBack={() => {
          if (showHistory) {
            setShowHistory(false);
          } else if (currentStep > 0 && currentStep < 2) {
            setCurrentStep(currentStep - 1);
          } else {
            handleNewImport();
          }
        }}
        rightAction={
          <View className="flex-row items-center gap-2">
            {/* History button */}
            <TouchableOpacity
              onPress={() => setShowHistory(!showHistory)}
              className="p-2 rounded-lg"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <Ionicons
                name="time-outline"
                size={20}
                color={colors.text.secondary}
              />
            </TouchableOpacity>
            {/* New import button */}
            {currentStep > 0 && (
              <TouchableOpacity
                onPress={handleNewImport}
                className="p-2 rounded-lg"
                style={{ backgroundColor: colors.info + "20" }}
              >
                <Ionicons name="add" size={20} color={colors.info} />
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Show import history */}
      {showHistory ? (
        <FlatList
          data={importListQuery.data?.imports || []}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ImportHistoryCard
              item={item}
              onPress={() => handleResumeImport(item)}
              onDelete={() => handleDeleteImport(item._id)}
            />
          )}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={importListQuery.isRefetching}
              onRefresh={() => importListQuery.refetch()}
              tintColor={colors.info}
            />
          }
          ListEmptyComponent={
            <View className="items-center mt-12">
              <Ionicons
                name="folder-open-outline"
                size={48}
                color={colors.text.tertiary}
              />
              <Text
                style={{ color: colors.text.secondary }}
                className="text-base mt-3"
              >
                No import history
              </Text>
            </View>
          }
        />
      ) : (
        <View className="flex-1">
          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} colors={colors} />

          {/* Step Content */}
          {currentStep === 0 && (
            <UploadStep
              onFilePicked={handleFilePicked}
              isUploading={uploadMutation.isPending}
              uploadError={uploadMutation.error}
              colors={colors}
            />
          )}

          {currentStep === 1 && importData && (
            <MapAndReviewStep
              importData={importData}
              mapping={localMapping}
              onMappingChange={handleMappingChange}
              selectedAccountId={selectedAccountId}
              onAccountChange={setSelectedAccountId}
              accountColumns={localAccountColumns}
              onAccountColumnChange={handleAccountColumnChange}
              accountOptions={accountOptions}
              onUpdateItems={handleUpdateItems}
              isUpdating={updateItemsMutation.isPending}
              parseWarnings={parseWarnings}
              onTryAgain={handleNewImport}
              onAutoCreateAccounts={handleAutoCreateAccounts}
              isAutoCreating={isAutoCreating}
              colors={colors}
            />
          )}

          {currentStep === 2 && importData && (
            <ImportStep
              importData={importData}
              isImporting={executeMutation.isPending}
              importError={executeMutation.error}
              colors={colors}
            />
          )}

          {/* Loading state for step 1 */}
          {currentStep === 1 && !importData && importDetailQuery.isLoading && (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.info} />
              <Text
                style={{ color: colors.text.secondary }}
                className="text-sm mt-3"
              >
                Loading import data...
              </Text>
            </View>
          )}

          {/* Bottom Action Bar - only show when there are items */}
          {currentStep === 1 && importData && importData.items.length > 0 && (
            <View
              className="px-4 pb-2 border-t"
              style={{
                paddingBottom: insets.bottom + 8,
                backgroundColor: colors.bg.primary,
                borderColor: colors.border,
              }}
            >
              {(() => {
                const isLedger = importData.import_mode === "ledger";
                const pendingItems = importData.items.filter(
                  (i) => i.status === "pending",
                ).length;
                const hasMappedAccounts = isLedger
                  ? localAccountColumns.some((ac) => ac.account_id)
                  : Boolean(selectedAccountId);
                const canImport = hasMappedAccounts && pendingItems > 0;

                return (
                  <TouchableOpacity
                    onPress={handleExecuteImport}
                    disabled={!canImport || executeMutation.isPending}
                    className="flex-row items-center justify-center py-4 rounded-2xl mt-3"
                    style={{
                      backgroundColor: canImport
                        ? colors.success
                        : colors.bg.tertiary,
                    }}
                  >
                    {executeMutation.isPending ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Ionicons
                        name="rocket"
                        size={20}
                        color={canImport ? "#ffffff" : colors.text.tertiary}
                      />
                    )}
                    <Text
                      className="text-base font-bold ml-2"
                      style={{
                        color: canImport ? "#ffffff" : colors.text.tertiary,
                      }}
                    >
                      {executeMutation.isPending
                        ? "Starting Import..."
                        : `Import ${pendingItems} Transactions`}
                    </Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          )}

          {/* Back to Home after completion */}
          {currentStep === 2 &&
            importData &&
            (importData.status === "completed" ||
              importData.status === "failed" ||
              executeMutation.isError) && (
              <View
                className="px-4 pb-2 gap-2 border-t"
                style={{
                  paddingBottom: insets.bottom + 8,
                  backgroundColor: colors.bg.primary,
                  borderColor: colors.border,
                }}
              >
                {importData.status === "completed" &&
                  importData.imported_count > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        // Navigate to transactions/history tab
                        handleNewImport();
                        // Use router if available
                      }}
                      className="flex-row items-center justify-center py-4 rounded-2xl mt-3"
                      style={{ backgroundColor: colors.success }}
                    >
                      <Ionicons name="list" size={20} color="#ffffff" />
                      <Text className="text-base font-bold ml-2 text-white">
                        View Transactions
                      </Text>
                    </TouchableOpacity>
                  )}
                <TouchableOpacity
                  onPress={handleNewImport}
                  className="flex-row items-center justify-center py-3.5 rounded-2xl"
                  style={{
                    backgroundColor:
                      importData.status === "completed" &&
                      importData.imported_count > 0
                        ? colors.bg.tertiary
                        : colors.info,
                    marginTop:
                      importData.status === "completed" &&
                      importData.imported_count > 0
                        ? 0
                        : 12,
                  }}
                >
                  <Ionicons
                    name="add-circle"
                    size={20}
                    color={
                      importData.status === "completed" &&
                      importData.imported_count > 0
                        ? colors.text.secondary
                        : "#ffffff"
                    }
                  />
                  <Text
                    className="text-base font-bold ml-2"
                    style={{
                      color:
                        importData.status === "completed" &&
                        importData.imported_count > 0
                          ? colors.text.secondary
                          : "#ffffff",
                    }}
                  >
                    Import Another File
                  </Text>
                </TouchableOpacity>
              </View>
            )}
        </View>
      )}
    </View>
  );
}
