import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
  Keyboard,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const heightValue = height === "85%" ? 0.85 : height === "95%" ? 0.95 : 0.9;

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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
          style={[
            styles.container,
            {
              maxHeight: `${heightValue * 100}%`,
              paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
            },
          ]}
        >
          <View style={[styles.content, { paddingBottom: insets.bottom }]}>
            {children}
          </View>
        </KeyboardAvoidingView>
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
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: "100%",
  },
  content: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "100%",
    overflow: "hidden",
  },
});
