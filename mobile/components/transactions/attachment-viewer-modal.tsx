import { useState, useCallback, useEffect, useRef } from "react";
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
  StyleSheet,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../hooks/use-theme";
import { deleteAttachment, type Attachment } from "../../services/attachments";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const THUMB_SIZE = (SCREEN_WIDTH - 48) / 3;

type Props = {
  visible: boolean;
  onClose: () => void;
  transactionId: string;
  attachments: Attachment[];
  canDelete?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Full-screen carousel (images only, with prev/next and dot indicators)
// ─────────────────────────────────────────────────────────────────────────────
function FullscreenCarousel({
  imageItems,
  initialIndex,
  onClose,
}: {
  imageItems: Attachment[];
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loadingImg, setLoadingImg] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      const next = currentIndex - 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    }
  }, [currentIndex]);

  const goNext = useCallback(() => {
    if (currentIndex < imageItems.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    }
  }, [currentIndex, imageItems.length]);

  const renderPage = useCallback(
    ({ item }: { item: Attachment }) => (
      <View style={styles.carouselPage}>
        <Image
          source={{ uri: item.url }}
          style={styles.carouselImage}
          resizeMode="contain"
          onLoadStart={() => setLoadingImg(true)}
          onLoadEnd={() => setLoadingImg(false)}
        />
      </View>
    ),
    [],
  );

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={imageItems}
          keyExtractor={(item) => item.storage_key}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
            );
            setCurrentIndex(idx);
          }}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          initialScrollIndex={initialIndex}
        />

        {loadingImg && (
          <ActivityIndicator
            size="large"
            color="white"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}

        {/* Top bar */}
        <View
          style={[
            styles.carouselTopBar,
            { paddingTop: Math.max(insets.top, 16) + 8 },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.carouselCloseBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>

          {imageItems.length > 1 && (
            <View style={styles.carouselCounter}>
              <Text style={styles.carouselCounterText}>
                {currentIndex + 1} / {imageItems.length}
              </Text>
            </View>
          )}

          <Text style={styles.carouselFilename} numberOfLines={1}>
            {imageItems[currentIndex]?.file_name ?? ""}
          </Text>
        </View>

        {/* Prev / Next */}
        {imageItems.length > 1 && (
          <>
            <TouchableOpacity
              style={[styles.carouselNavBtn, styles.carouselNavLeft]}
              onPress={goPrev}
              disabled={currentIndex === 0}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={currentIndex === 0 ? "rgba(255,255,255,0.25)" : "white"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.carouselNavBtn, styles.carouselNavRight]}
              onPress={goNext}
              disabled={currentIndex === imageItems.length - 1}
            >
              <Ionicons
                name="chevron-forward"
                size={28}
                color={
                  currentIndex === imageItems.length - 1
                    ? "rgba(255,255,255,0.25)"
                    : "white"
                }
              />
            </TouchableOpacity>
          </>
        )}

        {/* Dot indicators (up to 10 items) */}
        {imageItems.length > 1 && imageItems.length <= 10 && (
          <View
            style={[
              styles.carouselDots,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
            pointerEvents="none"
          >
            {imageItems.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function AttachmentViewerModal({
  visible,
  onClose,
  transactionId,
  attachments,
  canDelete = true,
}: Props) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const [localAttachments, setLocalAttachments] =
    useState<Attachment[]>(attachments);
  const [sharingKey, setSharingKey] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setLocalAttachments(attachments);
  }, [visible, transactionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const imageAttachments = localAttachments.filter(
    (a) => a.mime_type !== "application/pdf",
  );

  const deleteMutation = useMutation({
    mutationFn: (storageKey: string) =>
      deleteAttachment(transactionId, storageKey),
    onSuccess: (_data, storageKey) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleteMutation.mutate],
  );

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
      Alert.alert("Share Failed", "Could not share the file. Please try again.");
    } finally {
      setSharingKey(null);
    }
  }, []);

  const openPdf = useCallback((url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Cannot open this file."),
    );
  }, []);

  const handleThumbnailPress = useCallback(
    (item: Attachment) => {
      if (item.mime_type === "application/pdf") {
        openPdf(item.url);
      } else {
        const idx = imageAttachments.findIndex(
          (a) => a.storage_key === item.storage_key,
        );
        setCarouselIndex(idx >= 0 ? idx : 0);
      }
    },
    [imageAttachments, openPdf],
  );

  const renderItem = useCallback(
    ({ item }: { item: Attachment }) => (
      <View
        style={[
          styles.thumbContainer,
          { width: THUMB_SIZE, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.thumbTouch}
          activeOpacity={0.8}
          onPress={() => handleThumbnailPress(item)}
        >
          {item.mime_type === "application/pdf" ? (
            <View
              style={[
                styles.pdfPlaceholder,
                {
                  backgroundColor: colors.bg.tertiary,
                  width: THUMB_SIZE,
                  height: THUMB_SIZE,
                },
              ]}
            >
              <Ionicons
                name="document-text"
                size={40}
                color={colors.text.secondary}
              />
              <Text style={[styles.pdfLabel, { color: colors.text.tertiary }]}>
                PDF
              </Text>
            </View>
          ) : (
            <>
              <Image
                source={{ uri: item.thumbnail_url ?? item.url }}
                style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                resizeMode="cover"
              />
              <View style={styles.thumbOverlay} pointerEvents="none">
                <Ionicons
                  name="expand-outline"
                  size={18}
                  color="rgba(255,255,255,0.85)"
                />
              </View>
            </>
          )}
        </TouchableOpacity>

        <View
          style={[styles.thumbFooter, { backgroundColor: colors.bg.secondary }]}
        >
          <TouchableOpacity
            onPress={() => handleShare(item)}
            style={styles.thumbIconBtn}
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

          <Text
            style={[styles.thumbName, { color: colors.text.tertiary }]}
            numberOfLines={1}
          >
            {item.file_name ?? "file"}
          </Text>

          {canDelete && (
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={styles.thumbIconBtn}
              disabled={deleteMutation.isPending}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
            >
              {deleteMutation.isPending &&
              deleteMutation.variables === item.storage_key ? (
                <ActivityIndicator size={12} color={colors.error} />
              ) : (
                <Ionicons
                  name="trash-outline"
                  size={14}
                  color={colors.error}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    ),
    [
      colors,
      canDelete,
      sharingKey,
      deleteMutation.isPending,
      deleteMutation.variables,
      handleThumbnailPress,
      handleShare,
      handleDelete,
    ],
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.sheet, { backgroundColor: colors.bg.primary }]}>
          <View
            style={[
              styles.header,
              {
                borderColor: colors.border,
                paddingTop:
                  Platform.OS === "android"
                    ? (StatusBar.currentHeight ?? 0) + 8
                    : 16,
              },
            ]}
          >
            <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
              Attachments ({localAttachments.length})
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.closeBtn, { backgroundColor: colors.bg.tertiary }]}
            >
              <Ionicons name="close" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {localAttachments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="attach" size={48} color={colors.text.tertiary} />
              <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>
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

      {carouselIndex !== null && (
        <FullscreenCarousel
          imageItems={imageAttachments}
          initialIndex={carouselIndex}
          onClose={() => setCarouselIndex(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { marginTop: 12, fontSize: 16 },

  // Thumbnail grid
  thumbContainer: {
    height: THUMB_SIZE + 28,
    margin: 4,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  thumbTouch: { flex: 1 },
  pdfPlaceholder: { alignItems: "center", justifyContent: "center" },
  pdfLabel: { fontSize: 11, marginTop: 4 },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: 4,
  },
  thumbFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    height: 28,
  },
  thumbIconBtn: { padding: 4 },
  thumbName: {
    flex: 1,
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 2,
  },

  // Carousel
  carouselContainer: { flex: 1, backgroundColor: "#000" },
  carouselPage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  carouselImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  carouselTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  carouselCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  carouselCounter: {
    marginLeft: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  carouselCounterText: { color: "white", fontSize: 13, fontWeight: "600" },
  carouselFilename: {
    flex: 1,
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginLeft: 8,
    textAlign: "right",
  },
  carouselNavBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  carouselNavLeft: { left: 12 },
  carouselNavRight: { right: 12 },
  carouselDots: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingTop: 10,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotActive: { backgroundColor: "white" },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.35)" },
});
