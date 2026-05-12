import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { uploadAttachments, deleteAttachment } from "@/services/attachments";
import type { Attachment } from "@/services/attachments";
import { useTheme } from "@/hooks/useTheme";

type AttachmentPickerProps = {
  transactionId: string;
  initialAttachments?: Attachment[];
  onChanged?: (attachments: Attachment[]) => void;
  maxFiles?: number;
};

const MAX_FILE_SIZE_MB = 10;

export function AttachmentPicker({
  transactionId,
  initialAttachments = [],
  onChanged,
  maxFiles = 10,
}: AttachmentPickerProps) {
  const { colors } = useTheme();
  const [attachments, setAttachments] =
    useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleAttachmentsChange = (updated: Attachment[]) => {
    setAttachments(updated);
    onChanged?.(updated);
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera access is needed to capture receipts.",
      );
      return false;
    }
    return true;
  };

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Photo library access is needed to attach images.",
      );
      return false;
    }
    return true;
  };

  const handleCamera = async () => {
    if (attachments.length >= maxFiles) {
      Alert.alert("Limit Reached", `Maximum ${maxFiles} attachments allowed.`);
      return;
    }
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    await uploadFiles([result.assets[0]]);
  };

  const handleGallery = async () => {
    if (attachments.length >= maxFiles) {
      Alert.alert("Limit Reached", `Maximum ${maxFiles} attachments allowed.`);
      return;
    }
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) return;

    const remaining = maxFiles - attachments.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;
    await uploadFiles(result.assets);
  };

  const handleDocument = async () => {
    if (attachments.length >= maxFiles) {
      Alert.alert("Limit Reached", `Maximum ${maxFiles} attachments allowed.`);
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadFiles([
      {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/pdf",
        size: asset.size,
      },
    ]);
  };

  const uploadFiles = async (
    files: { uri: string; name?: string; type?: string; size?: number }[],
  ) => {
    // Validate file sizes
    for (const file of files) {
      if (file.size && file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        Alert.alert(
          "File Too Large",
          `${file.name ?? "File"} exceeds the ${MAX_FILE_SIZE_MB}MB limit.`,
        );
        return;
      }
    }

    setUploading(true);
    try {
      const response = await uploadAttachments(transactionId, files);
      handleAttachmentsChange(response.attachments);
    } catch (error) {
      Alert.alert(
        "Upload Failed",
        "Could not upload attachment. Please try again.",
      );
      console.error("[AttachmentPicker] Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (storageKey: string, fileName?: string) => {
    Alert.alert("Remove Attachment", `Remove "${fileName ?? "this file"}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setDeleting(storageKey);
          try {
            const response = await deleteAttachment(transactionId, storageKey);
            handleAttachmentsChange(response.attachments);
          } catch {
            Alert.alert("Error", "Could not remove attachment.");
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  };

  const isImage = (mimeType?: string) => mimeType?.startsWith("image/") ?? true;

  return (
    <View className="gap-3">
      {/* Attachment thumbnails */}
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row gap-2"
          contentContainerStyle={{ gap: 8 }}
        >
          {attachments.map((attachment) => (
            <View
              key={attachment.storage_key}
              className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
              style={{ width: 80, height: 80 }}
            >
              {isImage(attachment.mime_type) ? (
                <Image
                  source={{ uri: attachment.url }}
                  style={{ width: 80, height: 80 }}
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center bg-gray-100 dark:bg-gray-800">
                  <Ionicons
                    name="document-text"
                    size={28}
                    color={colors.primary}
                  />
                  <Text
                    className="text-xs text-gray-500 mt-1 text-center px-1"
                    numberOfLines={2}
                  >
                    {attachment.file_name ?? "PDF"}
                  </Text>
                </View>
              )}

              {/* Delete button */}
              <TouchableOpacity
                onPress={() =>
                  handleDelete(attachment.storage_key, attachment.file_name)
                }
                className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                disabled={deleting === attachment.storage_key}
              >
                {deleting === attachment.storage_key ? (
                  <ActivityIndicator size={12} color="#fff" />
                ) : (
                  <Ionicons name="close" size={14} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Upload action buttons */}
      {attachments.length < maxFiles && (
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={handleCamera}
            disabled={uploading}
            className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
          >
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Camera
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGallery}
            disabled={uploading}
            className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
          >
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Gallery
            </Text>
          </TouchableOpacity>

          {Platform.OS !== "web" && (
            <TouchableOpacity
              onPress={handleDocument}
              disabled={uploading}
              className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
            >
              <Ionicons
                name="document-outline"
                size={18}
                color={colors.primary}
              />
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">
                PDF
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {uploading && (
        <View className="flex-row items-center gap-2 py-2">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            Uploading...
          </Text>
        </View>
      )}

      <Text className="text-xs text-gray-400 dark:text-gray-500">
        {attachments.length}/{maxFiles} · Max {MAX_FILE_SIZE_MB}MB per file ·
        JPG, PNG, WebP, HEIC, PDF
      </Text>
    </View>
  );
}
