import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const KEYBOARD_BUTTON_GAP = 10;
/** Must match CustomTabBar: `height: 60 + insets.bottom` in app/(app)/_layout.tsx */
const TAB_BAR_CONTENT_HEIGHT = 60;

/**
 * Lifts a fixed footer above the keyboard (same visual gap as FormSheetModal).
 * Full-screen tab routes sit above the custom tab bar, so we subtract that
 * height — otherwise marginBottom: keyboardHeight overshoots and leaves a gap.
 */
export function useKeyboardFooterLift(options?: { hasTabBar?: boolean }) {
  const hasTabBar = options?.hasTabBar ?? true;
  const insets = useSafeAreaInsets();
  const kbStateHeight = useKeyboardState((s) => (s.isVisible ? s.height : 0));
  const [kbEventHeight, setKbEventHeight] = useState(0);

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
  const keyboardOpen = keyboardHeight > 0;
  const tabBarHeight = hasTabBar ? TAB_BAR_CONTENT_HEIGHT + insets.bottom : 0;
  const lift = keyboardOpen
    ? Math.max(0, keyboardHeight - tabBarHeight)
    : 0;

  return {
    keyboardHeight,
    keyboardOpen,
    /** Apply to the fixed footer container */
    footerContainerStyle: {
      marginBottom: lift,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: keyboardOpen ? KEYBOARD_BUTTON_GAP : 16,
      borderTopWidth: 1,
    },
    /** Pass to KeyboardAwareScrollView so it doesn't double-pad */
    scrollProps: {
      bottomOffset: 80,
      extraKeyboardSpace: keyboardOpen ? -lift : 0,
      keyboardShouldPersistTaps: "handled" as const,
      showsVerticalScrollIndicator: false,
    },
  };
}
