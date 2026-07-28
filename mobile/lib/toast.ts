import Toast from "react-native-toast-message";

const DEFAULTS = {
  position: "top" as const,
  topOffset: 56,
  visibilityTime: 3000,
};

export const toast = {
  success: (message: string, text2?: string) => {
    Toast.show({
      type: "success",
      text1: message,
      text2,
      ...DEFAULTS,
    });
  },
  error: (message: string, text2?: string) => {
    Toast.show({
      type: "error",
      text1: message,
      text2,
      ...DEFAULTS,
      visibilityTime: 4000,
    });
  },
  info: (message: string, text2?: string) => {
    Toast.show({
      type: "info",
      text1: message,
      text2,
      ...DEFAULTS,
    });
  },
  warning: (message: string, text2?: string) => {
    Toast.show({
      type: "error",
      text1: message,
      text2,
      ...DEFAULTS,
    });
  },
};
