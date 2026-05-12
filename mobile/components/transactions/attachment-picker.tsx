import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  ActionSheetIOS,
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
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleAttachmentsChange = (updated: Attachment[]) => {
    setAttachments(updated);
    onChanged?.(updated);
  };

  // ── Permission helpers ──────────────────────────────────────────────────
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera access is needed to capture receipts.");
      return false;
    }
    return true;
  };

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Photo library access is needed to attach images.");
      return false;
    }
    return true;
  };

  // ── Actions ────────────────────────────────────────────────────────────

  /** Quick photo — no crop editing */
  const handleCamera = async () => {
    if (!(await requestCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadFiles([result.assets[0]]);
  };

  /** Scan mode — camera + crop/rotate editing to straighten documents */
  const handleScan = async () => {
    if (!(await requestCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1,          // max quality for scanned docs
      allowsEditing: true, // lets user crop / straighten
      aspect: undefined,   // free-form crop (not locked ratio)
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadFiles([result.assets[0]]);
  };

  /** Gallery multi-select */
  const handleGallery = async () => {
    if (!(await requestMediaPermission())) return;
    const remaining = maxFiles - attachments.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
      exif: false,
    });
    if (result.canceled || !result.assets?.length) return;
    await uploadFiles(result.assets);
  };

  /** PDF document picker */
  const handleDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadFiles([{ uri: asset.uri, name: asset.name, type: asset.mimeType ?? "application/pdf", size: asset.size }]);
  };

  /** On iOS, show a native action sheet for the camera options */
  const handleAddPress = () => {
    if (attachments.length >= maxFiles) {
      Alert.alert("Limit Reached", `Maximum ${maxFiles} attachments allowed.`);
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Scan Document", "Take Photo", "Choose from Gallery", "Pick PDF"],
          cancelButtonIndex: 0,
          title: "Add Attachment",
        },
        (index) => {
          if (index === 1) handleScan();
          else if (index === 2) handleCamera();
          else if (index === 3) handleGallery();
          else if (index === 4) handleDocument();
        },
      );
    } else {
      // Android: show an Alert with buttons
      Alert.alert("Add Attachment", "Choose a source", [
        { text: "📄 Scan Document", onPress: handleScan },
        { text: "📷 Take Photo", onPress: handleCamera },
        { text: "🖼️ Choose from Gallery", onPress: handleGallery },
        { text: "📑 Pick PDF", onPress: handleDocument },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  // ── Upload ─────────────────────────────────────────────────────────────
  const uploadFiles = async (
    files: { uri: string; name?: string; type?: string; size?: number }[],
  ) => {
    for (const file of files) {
      if (file.size && file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        Alert.alert("File Too Large", `"${file.name ?? "File"}" exceeds the ${MAX_FILE_SIZE_MB} MB limit.`);
        return;
      }
    }
    setUploading(true);
    setUploadProgress(files.length > 1 ? `Uploading ${files.length} files…` : "Uploading…");
    try {
      const response = await uploadAttachments(transactionId, files);
      handleAttachmentsChange(response.attachments);
    } catch {
      Alert.alert("Upload Failed", "Could not upload the attachment. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────
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
            Alert.alert("Error", "Could not remove the attachment.");
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  };

  const isImage = (mimeType?: string) => !mimeType || mimeType.startsWith("image/");

  return (
    <View className="gap-3">
      {/* Thumbnails row */}
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {attachments.map((att) => (
            <View
              key={att.storage_key}
              className="relative rounded-xl overflow-hidden"
              style={{ width: 80, height: 80, borderWidth: 1, borderColor: colors.border }}
            >
              {isImage(att.mime_type) ? (
                <Image
                  source={{ uri: att.thumbnail_url ?? att.url }}
                  style={{ width: 80, height: 80 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  className="w-full h-full items-center justify-center"
                  style={{ backgroundColor: colors.bg.tertiary }}
                >
                  <Ionicons name="document-text" size={28} color={colors.info} />
                  <Text
                    style={{ color: colors.text.tertiary }}
                    className="text-xs mt-1 text-center px-1"
                    numberOfLines={2}
                  >
                    {att.file_name ?? "PDF"}
                  </Text>
                </View>
              )}

              {/* Size badge */}
              {att.file_size ? (
                <View className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/50">
                  <Text className="text-white text-center" style={{ fontSize: 9 }}>
                    {(att.file_size / 1024).toFixed(0)} KB
                  </Text>
                </View>
              ) : null}

              {/* Delete button */}
              <TouchableOpacity
                onPress={() => handleDelete(att.storage_key, att.file_name)}
                className="absolute top-1 right-1 rounded-full p-0.5"
                style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
                disabled={deleting === att.storage_key}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
              >
                {deleting === att.storage_key ? (
                  <ActivityIndicator size={12} color="#fff" />
                ) : (
                  <Ionicons name="close" size={14} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Action buttons */}
      {attachments.length < maxFiles && (
        <View className="flex-row gap-2">
          {/* Scan — primary CTA */}
          <TouchableOpacity
            onPress={handleScan}
            disabled={uploading}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl"
            style={{ backgroundColor: colors.info + "20", borderWidth: 1, borderColor: colors.info + "50" }}
          >
            <Ionicons name="scan-outline" size={18} color={colors.info} />
            <Text style={{ color: colors.info }} className="text-sm font-semibold">
              Scan
            </Text>
          </TouchableOpacity>

          {/* Camera */}
          <TouchableOpacity
            onPress={handleCamera}
            disabled={uploading}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl"
            style={{ backgroundColor: colors.bg.tertiary, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border }}
          >
            <Ionicons name="camera-outline" size={18} color={colors.text.secondary} />
            <Text style={{ color: colors.text.secondary }} className="text-sm font-medium">
              Photo
            </Text>
          </TouchableOpacity>

          {/* Gallery */}
          <TouchableOpacity
            onPress={handleGallery}
            disabled={uploading}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl"
            style={{ backgroundColor: colors.bg.tertiary, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border }}
          >
            <Ionicons name="images-outline" size={18} color={colors.text.secondary} />
            <Text style={{ color: colors.text.secondary }} className="text-sm font-medium">
              Gallery
            </Text>
          </TouchableOpacity>

          {/* PDF */}
          {Platform.OS !== "web" && (
            <TouchableOpacity
              onPress={handleDocument}
              disabled={uploading}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl"
              style={{ backgroundColor: colors.bg.tertiary, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border }}
            >
              <Ionicons name="document-outline" size={18} color={colors.text.secondary} />
              <Text style={{ color: colors.text.secondary }} className="text-sm font-medium">
                PDF
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Upload progress */}
      {uploading && (
        <View className="flex-row items-center gap-2 py-1.5">
          <ActivityIndicator size="small" color={colors.info} />
          <Text style={{ color: colors.text.secondary }} className="text-sm">
            {uploadProgress}
          </Text>
        </View>
      )}

      <Text style={{ color: colors.text.tertiary }} className="text-xs">
        {attachments.length}/{maxFiles} files · Max {MAX_FILE_SIZE_MB} MB · JPG, PNG, WebP, HEIC, PDF
      </Text>
    </View>
  );
}
