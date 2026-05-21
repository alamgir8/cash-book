import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCAN_BOX_SIZE = SCREEN_WIDTH * 0.68;

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the raw barcode string once a code is detected */
  onScan: (barcode: string) => void;
  title?: string;
}

export function BarcodeScannerModal({
  visible,
  onClose,
  onScan,
  title = "Scan Barcode",
}: BarcodeScannerModalProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const cooldownRef = useRef(false);

  // Reset scan state every time the modal opens
  useEffect(() => {
    if (visible) {
      setScanned(false);
      setTorchOn(false);
      cooldownRef.current = false;
    }
  }, [visible]);

  const handleBarCodeScanned = useCallback(
    ({ data }: { type: string; data: string }) => {
      if (cooldownRef.current || scanned) return;
      cooldownRef.current = true;
      setScanned(true);
      onScan(data);
    },
    [onScan, scanned],
  );

  const handleClose = useCallback(() => {
    setScanned(false);
    setTorchOn(false);
    cooldownRef.current = false;
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity
            onPress={() => setTorchOn((v) => !v)}
            style={styles.headerBtn}
          >
            <Ionicons
              name={torchOn ? "flashlight" : "flashlight-outline"}
              size={24}
              color={torchOn ? "#FFD700" : "#fff"}
            />
          </TouchableOpacity>
        </View>

        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={64} color="#aaa" />
            <Text style={styles.permText}>Camera permission is required</Text>
            <TouchableOpacity
              style={[styles.permBtn, { backgroundColor: colors.info }]}
              onPress={requestPermission}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Grant Permission
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{
                barcodeTypes: [
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                  "code39",
                  "code128",
                  "qr",
                  "pdf417",
                  "aztec",
                  "datamatrix",
                  "itf14",
                ],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />

            {/* Dimmed overlay with scan window */}
            <View style={styles.overlay}>
              <View style={styles.overlayTop} />
              <View style={styles.overlayMiddleRow}>
                <View style={styles.overlaySide} />
                {/* Scan box */}
                <View style={styles.scanBox}>
                  {/* Corner markers */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                  {scanned && (
                    <View style={styles.scannedOverlay}>
                      <Ionicons
                        name="checkmark-circle"
                        size={48}
                        color="#4CAF50"
                      />
                    </View>
                  )}
                </View>
                <View style={styles.overlaySide} />
              </View>
              <View style={styles.overlayBottom}>
                <Text style={styles.hintText}>
                  {scanned ? "Barcode detected!" : "Point camera at a barcode"}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const DIM = "rgba(0,0,0,0.62)";
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;
const CORNER_COLOR = "#fff";

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  headerBtn: { padding: 6 },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  permText: { color: "#aaa", fontSize: 16, textAlign: "center", marginTop: 8 },
  permBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    pointerEvents: "none",
  },
  overlayTop: { flex: 1, backgroundColor: DIM },
  overlayMiddleRow: { flexDirection: "row", height: SCAN_BOX_SIZE },
  overlaySide: { flex: 1, backgroundColor: DIM },
  scanBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    position: "relative",
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: DIM,
    alignItems: "center",
    paddingTop: 20,
  },
  hintText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  scannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 4,
  },
  // Corner markers
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderBottomRightRadius: 4,
  },
});
