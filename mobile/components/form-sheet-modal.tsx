import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  KeyboardAwareScrollView,
  useKeyboardState,
} from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";

const KEYBOARD_BUTTON_GAP = 10;
const DEFAULT_SHEET_RATIO = 0.88;

export type FormSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Content above the primary button (e.g. in-app amount keypad) */
  footerExtra?: ReactNode;
  submitLabel: string;
  submitIcon?: keyof typeof Ionicons.glyphMap;
  onSubmit: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  submittingLabel?: string;
  /** Extra bottom offset for KeyboardAwareScrollView (footer ~80) */
  scrollBottomOffset?: number;
  sheetRatio?: number;
};

/**
 * Shared bottom-sheet form shell matching Transaction modal:
 * locked open height, lifts above keyboard, fixed header + footer, info save button.
 */
export function FormSheetModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footerExtra,
  submitLabel,
  submitIcon = "checkmark-circle",
  onSubmit,
  isSubmitting = false,
  submitDisabled = false,
  submittingLabel = "Saving…",
  scrollBottomOffset = 80,
  sheetRatio = DEFAULT_SHEET_RATIO,
}: FormSheetModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("screen").height;
  const kbStateHeight = useKeyboardState((s) => (s.isVisible ? s.height : 0));
  const [kbEventHeight, setKbEventHeight] = useState(0);
  const [lockedSheetHeight, setLockedSheetHeight] = useState(
    () => Dimensions.get("window").height * sheetRatio,
  );

  useEffect(() => {
    if (visible) {
      setLockedSheetHeight(Dimensions.get("window").height * sheetRatio);
      setKbEventHeight(0);
    }
  }, [visible, sheetRatio]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKbEventHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKbEventHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const keyboardHeight = Math.max(kbStateHeight, kbEventHeight);
  const keyboardOpen = keyboardHeight > 0 || !!footerExtra;
  const maxHeightAboveKeyboard =
    keyboardHeight > 0
      ? Math.max(0, screenHeight - keyboardHeight - insets.top)
      : lockedSheetHeight;
  const sheetHeight =
    keyboardHeight > 0
      ? Math.min(lockedSheetHeight, maxHeightAboveKeyboard)
      : lockedSheetHeight;
  const footerPadBottom = keyboardOpen
    ? KEYBOARD_BUTTON_GAP
    : Math.max(insets.bottom, 16);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          style={StyleSheet.absoluteFillObject}
        />

        <View
          style={{
            height: sheetHeight,
            marginBottom: keyboardHeight,
            backgroundColor: colors.bg.primary,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 24,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: colors.bg.primary,
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: colors.text.primary,
                }}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.text.secondary,
                    marginTop: 2,
                  }}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.bg.tertiary,
                alignItems: "center",
                justifyContent: "center",
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color="#f43f5e" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <KeyboardAwareScrollView
            bottomOffset={scrollBottomOffset}
            extraKeyboardSpace={keyboardHeight > 0 ? -keyboardHeight : 0}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            <View style={{ paddingHorizontal: 24, paddingVertical: 20 }}>
              {children}
            </View>
          </KeyboardAwareScrollView>

          {/* Footer */}
          <View style={{ backgroundColor: colors.bg.primary }}>
            {footerExtra}
            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 12,
                paddingBottom: footerPadBottom,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                backgroundColor: colors.bg.primary,
              }}
            >
              <TouchableOpacity
                onPress={onSubmit}
                disabled={isSubmitting || submitDisabled}
                className="rounded-2xl py-4 items-center shadow-lg"
                style={{
                  backgroundColor: colors.info,
                  opacity: isSubmitting || submitDisabled ? 0.7 : 1,
                }}
              >
                {isSubmitting ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator color="white" />
                    <Text className="text-white font-bold text-base">
                      {submittingLabel}
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name={submitIcon} size={20} color="white" />
                    <Text className="text-white font-bold text-base">
                      {submitLabel}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Shared field label style used across form sheets */
export function FormFieldLabel({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      className="text-sm font-semibold mb-2"
      style={{ color: colors.text.primary }}
    >
      {children}
    </Text>
  );
}

/** Shared single-line text / amount input chrome */
export function formInputStyle(colors: {
  bg: { tertiary: string };
  text: { primary: string; tertiary: string };
  border: string;
}, focused = false) {
  return {
    backgroundColor: colors.bg.tertiary,
    color: colors.text.primary,
    borderColor: focused ? undefined : colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  } as const;
}
