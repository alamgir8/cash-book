import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
// Fullscreen carousel — rendered INLINE (not a nested Modal) to avoid iOS hang
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
    setCurrentIndex((prev) => {
      if (prev <= 0) return prev;
      const next = prev - 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= imageItems.length - 1) return prev;
      const next = prev + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      return next;
    });
  }, [imageItems.length]);

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
    <View style={StyleSheet.absoluteFill}>
      {/* Black background */}
      <View style={styles.carouselBg} />

      {/* Paged image list */}
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
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
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
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name="chevron-back"
              size={30}
              color={currentIndex === 0 ? "rgba(255,255,255,0.25)" : "white"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.carouselNavBtn, styles.carouselNavRight]}
            onPress={goNext}
            disabled={currentIndex === imageItems.length - 1}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name="chevron-forward"
              size={30}
              color={
                currentIndex === imageItems.length - 1
                  ? "rgba(255,255,255,0.25)"
                  : "white"
              }
            />
          </TouchableOpacity>
        </>
      )}

      {/* Dot indicators */}
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component — single Modal, switches between grid and fullscreen views
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
  // null = grid view; number = fullscreen carousel at that index
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const [localAttachments, setLocalAttachments] =
    useState<Attachment[]>(attachments);
  const [sharingKey, setSharingKey] = useState<string | null>(null);
  const [openingPdfKey, setOpeningPdfKey] = useState<string | null>(null);

  // Sync when modal opens (or switches to a different transaction)
  useEffect(() => {
    if (visible) {
      setLocalAttachments(attachments);
      setCarouselIndex(null); // always start at grid view
    }
  }, [visible, transactionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memoize so handleThumbnailPress / renderItem don't recreate every render
  const imageAttachments = useMemo(
    () => localAttachments.filter((a) => a.mime_type !== "application/pdf"),
    [localAttachments],
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
      Alert.alert(
        "Share Failed",
        "Could not share the file. Please try again.",
      );
    } finally {
      setSharingKey(null);
    }
  }, []);

  const openPdf = useCallback(async (attachment: Attachment) => {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      // Last-resort fallback: open URL in browser (iOS Safari can render PDFs)
      Linking.openURL(attachment.url).catch(() =>
        Alert.alert("Error", "Cannot open this PDF."),
      );
      return;
    }
    setOpeningPdfKey(attachment.storage_key);
    try {
      const fileName = attachment.file_name?.endsWith(".pdf")
        ? attachment.file_name
        : (attachment.file_name ?? `document_${Date.now()}`) + ".pdf";
      const localUri = (FileSystem.cacheDirectory ?? "") + fileName;
      // Download to local cache so the OS can open it in the native PDF viewer
      await FileSystem.downloadAsync(attachment.url, localUri);
      await Sharing.shareAsync(localUri, {
        mimeType: "application/pdf",
        dialogTitle: fileName,
        UTI: "com.adobe.pdf",
      });
    } catch {
      Alert.alert("Error", "Could not open this PDF. Please try again.");
    } finally {
      setOpeningPdfKey(null);
    }
  }, []);

  const handleThumbnailPress = useCallback(
    (item: Attachment) => {
      if (item.mime_type === "application/pdf") {
        openPdf(item);
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
    ({ item }: { item: Attachment }) => {
      const isImg = item.mime_type !== "application/pdf";
      return (
        <View
          style={[
            styles.thumbContainer,
            { width: THUMB_SIZE, borderColor: colors.border },
          ]}
        >
          {/* Image / PDF tap area */}
          <TouchableOpacity
            style={styles.thumbTouch}
            activeOpacity={0.75}
            onPress={() => handleThumbnailPress(item)}
            disabled={openingPdfKey === item.storage_key}
          >
            {!isImg ? (
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
                {openingPdfKey === item.storage_key ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : item.thumbnail_url ? (
                  // Cloudinary-generated page-1 thumbnail
                  <Image
                    source={{ uri: item.thumbnail_url }}
                    style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="document-text"
                      size={40}
                      color={colors.text.secondary}
                    />
                    <Text
                      style={[styles.pdfLabel, { color: colors.text.tertiary }]}
                    >
                      PDF
                    </Text>
                  </>
                )}
              </View>
            ) : (
              <Image
                source={{ uri: item.thumbnail_url ?? item.url }}
                style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                resizeMode="cover"
              />
            )}
          </TouchableOpacity>

          {/* Expand icon (images) / Open icon (PDFs) — TOP RIGHT */}
          <TouchableOpacity
            style={styles.expandBtn}
            onPress={() => handleThumbnailPress(item)}
            disabled={openingPdfKey === item.storage_key}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={isImg ? "expand-outline" : "open-outline"}
              size={18}
              color="rgba(255,255,255,0.95)"
            />
          </TouchableOpacity>

          {/* Footer: share · filename · delete */}
          <View
            style={[
              styles.thumbFooter,
              { backgroundColor: colors.bg.secondary },
            ]}
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
      );
    },
    [
      colors,
      canDelete,
      sharingKey,
      openingPdfKey,
      deleteMutation.isPending,
      deleteMutation.variables,
      handleThumbnailPress,
      handleShare,
      handleDelete,
    ],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (carouselIndex !== null) {
          setCarouselIndex(null); // back to grid first
        } else {
          onClose();
        }
      }}
    >
      <View style={[styles.sheet, { backgroundColor: colors.bg.primary }]}>
        {/* ── GRID VIEW ─────────────────────────────────────────────── */}
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

        {/* ── FULLSCREEN CAROUSEL — absolute overlay inside same Modal ── */}
        {carouselIndex !== null && imageAttachments.length > 0 && (
          <FullscreenCarousel
            imageItems={imageAttachments}
            initialIndex={carouselIndex}
            onClose={() => setCarouselIndex(null)}
          />
        )}
      </View>
    </Modal>
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

  // Expand icon — top-right corner, own touchable
  expandBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
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

  // Carousel (absolute fill inside the Modal's View — no nested Modal)
  carouselBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  carouselNavLeft: { left: 8 },
  carouselNavRight: { right: 8 },
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
