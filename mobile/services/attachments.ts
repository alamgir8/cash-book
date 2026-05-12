import { api } from "../lib/api";

export type Attachment = {
  url: string;
  thumbnail_url?: string | null;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  storage_key: string;
  uploaded_at?: string;
};

export type UploadAttachmentsResponse = {
  message: string;
  attachments: Attachment[];
};

/**
 * Upload one or more image/PDF files as attachments to a transaction.
 * `files` is an array of objects compatible with React Native's ImagePicker / DocumentPicker result.
 */
export const uploadAttachments = async (
  transactionId: string,
  files: {
    uri: string;
    name?: string;
    type?: string;
    size?: number;
  }[],
): Promise<UploadAttachmentsResponse> => {
  const formData = new FormData();

  for (const file of files) {
    const fileName = file.name ?? `attachment_${Date.now()}.jpg`;
    const mimeType = file.type ?? "image/jpeg";

    // React Native FormData accepts this object shape
    formData.append("attachments", {
      uri: file.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
  }

  const response = await api.post<UploadAttachmentsResponse>(
    `/transactions/${transactionId}/attachments`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      // Increase timeout for file uploads
      timeout: 60000,
    },
  );

  return response.data;
};

/**
 * Remove a specific attachment from a transaction.
 */
export const deleteAttachment = async (
  transactionId: string,
  storageKey: string,
): Promise<{ message: string; attachments: Attachment[] }> => {
  const response = await api.delete(
    `/transactions/${transactionId}/attachments/${storageKey}`,
  );
  return response.data;
};
