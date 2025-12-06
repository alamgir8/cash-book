import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../lib/api";

export type BackupData = {
  version: string;
  exportedAt: string;
  data: {
    accounts: any[];
    categories: any[];
    transactions: any[];
    transfers: any[];
    balanceSnapshots: any[];
  };
  summary: {
    accountsCount: number;
    categoriesCount: number;
    transactionsCount: number;
    transfersCount: number;
    balanceSnapshotsCount: number;
  };
};

export type ImportResult = {
  message: string;
  summary: {
    accountsImported: number;
    categoriesImported: number;
    transactionsImported: number;
    transfersImported: number;
    balanceSnapshotsImported: number;
  };
};

/**
 * Export backup data from the API
 */
export const fetchBackupData = async (): Promise<BackupData> => {
  const { data } = await api.get<BackupData>("/backup/export");
  return data;
};

/**
 * Import backup data to the API
 */
export const importBackupData = async (
  backupData: BackupData
): Promise<ImportResult> => {
  const { data } = await api.post<ImportResult>("/backup/import", backupData);
  return data;
};

/**
 * Export backup and save as JSON file
 */
export const exportBackupToFile = async (): Promise<string> => {
  // Fetch backup data from API
  const backupData = await fetchBackupData();

  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `cashbook-backup-${timestamp}.json`;

  // Create file in document directory using new API
  const file = new File(Paths.document, filename);
  await file.write(JSON.stringify(backupData, null, 2));

  // Share the file
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      dialogTitle: "Save Backup File",
      UTI: "public.json",
    });
  }

  return filename;
};

/**
 * Import backup from a JSON file
 */
export const importBackupFromFile = async (): Promise<ImportResult> => {
  // Pick a JSON file
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    throw new Error("No file selected");
  }

  const pickedFile = result.assets[0];

  // Read file contents using new File API
  const file = new File(pickedFile.uri);
  const fileContent = await file.text();

  // Parse JSON
  let backupData: BackupData;
  try {
    backupData = JSON.parse(fileContent);
  } catch {
    throw new Error("Invalid JSON file format");
  }

  // Validate backup structure
  if (!backupData.version) {
    throw new Error("Invalid backup file: missing version");
  }

  if (!backupData.data) {
    throw new Error("Invalid backup file: missing data");
  }

  if (!Array.isArray(backupData.data.accounts)) {
    throw new Error("Invalid backup file: missing accounts data");
  }

  if (!Array.isArray(backupData.data.categories)) {
    throw new Error("Invalid backup file: missing categories data");
  }

  if (!Array.isArray(backupData.data.transactions)) {
    throw new Error("Invalid backup file: missing transactions data");
  }

  // Send to API
  const importResult = await importBackupData(backupData);

  return importResult;
};
