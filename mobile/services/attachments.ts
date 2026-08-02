import { api } from "../lib/api";
import { isLocalFirstEnabled } from "@/lib/local-first/flags";

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
 * Local-first: saves on-device (no Cloudinary). Cloud-primary: API upload.
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
  if (isLocalFirstEnabled()) {
    const { saveLocalAttachments } = await import("./local-attachments");
    const attachments = await saveLocalAttachments(transactionId, files);
    return { message: "Saved on device", attachments };
  }

  const formData = new FormData();

  for (const file of files) {
    const fileName = file.name ?? `attachment_${Date.now()}.jpg`;
    const mimeType = file.type ?? "image/jpeg";

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
  if (isLocalFirstEnabled() || storageKey.startsWith("local:")) {
    const { deleteLocalAttachment } = await import("./local-attachments");
    const attachments = await deleteLocalAttachment(transactionId, storageKey);
    return { message: "Removed", attachments };
  }

  const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
  const response = await api.delete(
    `/transactions/${transactionId}/attachments/${encodedKey}`,
  );
  return response.data;
};
