import Toast from "toastify-react-native";

export const toast = {
  success: (message: string) => {
    Toast.success(message, "top");
  },
  error: (message: string) => {
    Toast.error(message, "top");
  },
  info: (message: string) => {
    Toast.info(message, "top");
  },
  warning: (message: string) => {
    Toast.warn(message, "top");
  },
};
