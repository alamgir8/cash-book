import { ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  View,
  Keyboard,
  StyleSheet,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";

type KeyboardAwareModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: "85%" | "90%" | "95%";
};

export function KeyboardAwareModal({
  visible,
  onClose,
  children,
  height = "90%",
}: KeyboardAwareModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop - tap to close */}
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />

        {/* Modal Content */}
        <View style={[styles.container, { maxHeight: height }]}>
          <View
            style={[
              styles.content,
              {
                backgroundColor: colors.bg.primary,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <KeyboardAwareScrollView
              bottomOffset={Platform.OS === "ios" ? 16 : 24}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </KeyboardAwareScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  container: {
    width: "100%",
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
});
