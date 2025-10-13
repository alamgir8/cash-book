import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from '../lib/api';

export const exportTransactionsPdf = async (filters: Record<string, unknown> = {}) => {
  const url = api.getUri({
    url: '/reports/transactions/pdf',
    params: filters
  });

  const cacheBase =
    (FileSystem as unknown as { cacheDirectory?: string }).cacheDirectory ??
    FileSystem.Paths?.cache?.uri ??
    FileSystem.Paths?.document?.uri ??
    '';

  const fileUri = `${cacheBase}transactions-report-${Date.now()}.pdf`;

  const headers: Record<string, string> = {};
  if (api.defaults.headers.common.Authorization) {
    headers.Authorization = api.defaults.headers.common.Authorization as string;
  }

  await FileSystem.downloadAsync(url, fileUri, { headers });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri);
  }

  return fileUri;
};
