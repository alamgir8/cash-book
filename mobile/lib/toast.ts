import Toast from "react-native-toast-message";

export const toast = {
  success: (message: string) => {
    Toast.show({
      type: "success",
      text1: message,
      position: "top",
      topOffset: 60,
      visibilityTime: 3000,
    });
  },
  error: (message: string) => {
    Toast.show({
      type: "error",
      text1: message,
      position: "top",
      topOffset: 60,
      visibilityTime: 4000,
    });
  },
  info: (message: string) => {
    Toast.show({
      type: "info",
      text1: message,
      position: "top",
      topOffset: 60,
      visibilityTime: 3000,
    });
  },
  warning: (message: string) => {
    Toast.show({
      type: "error",
      text1: message,
      position: "top",
      topOffset: 60,
      visibilityTime: 3000,
    });
  },
};
