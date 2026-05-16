import { useState, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Linking,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../hooks/use-theme";
import { deleteAttachment, type Attachment } from "../../services/attachments";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const THUMB_SIZE = (SCREEN_WIDTH - 48) / 3;

type Props = {
  visible: boolean;
  onClose: () => void;
  transactionId: string;
  attachments: Attachment[];
  canDelete?: boolean;
};

export function AttachmentViewerModal({
  visible,
  onClose,
  transactionId,
  attachments,
  canDelete = true,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingImg, setLoadingImg] = useState(false);
  const [localAttachments, setLocalAttachments] =
    useState<Attachment[]>(attachments);

  // Sync local list when the modal opens for a (possibly different) transaction
  useEffect(() => {
    if (visible) setLocalAttachments(attachments);
  }, [visible, transactionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteMutation = useMutation({
    mutationFn: (storageKey: string) =>
      deleteAttachment(transactionId, storageKey),
    onSuccess: (data, storageKey) => {
      setLocalAttachments((prev) =>
        prev.filter((a) => a.storage_key !== storageKey),
      );
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({
        queryKey: ["transaction", transactionId],
      });
    },
    onError: () => Alert.alert("Error", "Failed to delete attachment."),
  });

  const handleDelete = useCallback(
    (attachment: Attachment) => {
      Alert.alert(
        "Delete Attachment",
        `Remove "${attachment.file_name ?? "this file"}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteMutation.mutate(attachment.storage_key),
          },
        ],
      );
    },
    [deleteMutation],
  );

  const [sharingKey, setSharingKey] = useState<string | null>(null);

  const handleShare = useCallback(async (attachment: Attachment) => {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Not supported", "Sharing is not available on this device.");
      return;
    }
    setSharingKey(attachment.storage_key);
    try {
      const ext =
        attachment.mime_type === "application/pdf"
          ? ".pdf"
          : (attachment.file_name?.match(/\.[^.]+$/)?.[0] ?? ".jpg");
      const fileName = attachment.file_name ?? `attachment_${Date.now()}${ext}`;
      const localUri = (FileSystem.cacheDirectory ?? "") + fileName;
      await FileSystem.downloadAsync(attachment.url, localUri);
      await Sharing.shareAsync(localUri, {
        mimeType: attachment.mime_type ?? "application/octet-stream",
        dialogTitle: fileName,
        UTI:
          attachment.mime_type === "application/pdf"
            ? "com.adobe.pdf"
            : "public.image",
      });
    } catch {
      Alert.alert(
        "Share Failed",
        "Could not share the file. Please try again.",
      );
    } finally {
      setSharingKey(null);
    }
  }, []);

  const openPdf = useCallback((url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Cannot open this file."),
    );
  }, []);

  const isPdf = (mime?: string) => mime === "application/pdf";

  const renderItem = ({ item }: { item: Attachment }) => (
    <View
      style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE + 28,
        borderColor: colors.border,
      }}
      className="m-1 rounded-xl overflow-hidden border"
    >
      <TouchableOpacity
        className="flex-1"
        activeOpacity={0.8}
        onPress={() => {
          if (isPdf(item.mime_type)) {
            openPdf(item.url);
          } else {
            setPreviewUrl(item.url);
          }
        }}
      >
        {isPdf(item.mime_type) ? (
          <View
            style={{
              backgroundColor: colors.bg.tertiary,
              width: THUMB_SIZE,
              height: THUMB_SIZE,
            }}
            className="items-center justify-center"
          >
            <Ionicons
              name="document-text"
              size={40}
              color={colors.text.secondary}
            />
            <Text
              style={{ color: colors.text.tertiary }}
              className="text-xs mt-1"
            >
              PDF
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: item.thumbnail_url ?? item.url }}
            style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
            resizeMode="cover"
          />
        )}
      </TouchableOpacity>

      {/* Bottom row: share left · name centre · delete right */}
      <View
        style={{ backgroundColor: colors.bg.secondary }}
        className="flex-row items-center px-1"
      >
        {/* Share — left side */}
        <TouchableOpacity
          onPress={() => handleShare(item)}
          className="p-1"
          disabled={sharingKey === item.storage_key}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 4 }}
        >
          {sharingKey === item.storage_key ? (
            <ActivityIndicator size={12} color={colors.text.secondary} />
          ) : (
            <Ionicons
              name="share-outline"
              size={14}
              color={colors.text.secondary}
            />
          )}
        </TouchableOpacity>

        {/* File name — fills remaining space */}
        <Text
          style={{ color: colors.text.tertiary, flex: 1 }}
          className="text-xs text-center px-0.5"
          numberOfLines={1}
        >
          {item.file_name ?? "file"}
        </Text>

        {/* Delete — right side */}
        {canDelete && (
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            className="p-1"
            disabled={deleteMutation.isPending}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
          >
            {deleteMutation.isPending &&
            deleteMutation.variables === item.storage_key ? (
              <ActivityIndicator size={12} color={colors.error} />
            ) : (
              <Ionicons name="trash-outline" size={14} color={colors.error} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={{ backgroundColor: colors.bg.primary, flex: 1 }}>
          {/* Header — respects status bar on Android; pageSheet handles iOS notch */}
          <View
            style={{
              borderColor: colors.border,
              paddingTop:
                Platform.OS === "android"
                  ? (StatusBar.currentHeight ?? 0) + 8
                  : 16,
            }}
            className="flex-row items-center justify-between px-4 pb-3 border-b"
          >
            <Text
              style={{ color: colors.text.primary }}
              className="text-lg font-bold"
            >
              Attachments ({localAttachments.length})
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.bg.tertiary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {localAttachments.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="attach" size={48} color={colors.text.tertiary} />
              <Text
                style={{ color: colors.text.tertiary }}
                className="mt-3 text-base"
              >
                No attachments yet
              </Text>
            </View>
          ) : (
            <FlatList
              data={localAttachments}
              keyExtractor={(item) => item.storage_key}
              renderItem={renderItem}
              numColumns={3}
              contentContainerStyle={{ padding: 8 }}
              removeClippedSubviews
              initialNumToRender={12}
              maxToRenderPerBatch={12}
            />
          )}
        </View>
      </Modal>

      {/* Full-screen image preview */}
      {previewUrl && (
        <Modal
          visible
          animationType="fade"
          onRequestClose={() => setPreviewUrl(null)}
        >
          <View className="flex-1 bg-black items-center justify-center">
            <TouchableOpacity
              style={{
                position: "absolute",
                top: Math.max(insets.top, 16) + 8,
                right: 16,
                zIndex: 10,
                padding: 8,
                backgroundColor: "rgba(0,0,0,0.55)",
                borderRadius: 20,
              }}
              onPress={() => setPreviewUrl(null)}
            >
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            {loadingImg && (
              <ActivityIndicator
                size="large"
                color="white"
                style={{ position: "absolute" }}
              />
            )}
            <Image
              source={{ uri: previewUrl }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.4 }}
              resizeMode="contain"
              onLoadStart={() => setLoadingImg(true)}
              onLoadEnd={() => setLoadingImg(false)}
            />
          </View>
        </Modal>
      )}
    </>
  );
}
