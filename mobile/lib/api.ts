import axios from "axios";
import Constants from "expo-constants";

// Get the device's IP address for development
const getBaseURL = () => {
  // In development, use the hostUri from Expo to get the correct IP
  if (Constants.expoConfig?.hostUri) {
    return Constants.expoConfig.hostUri.replace(/(:\d+)?$/, ":4000/api");
  }

  // Fallback options
  if (Constants.expoConfig?.extra?.apiBaseUrl) {
    return Constants.expoConfig.extra.apiBaseUrl;
  }

  // Last resort - this will only work in web or Expo Go on same machine
  return "http://localhost:4000/api";
};

const baseURL = getBaseURL();

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

export const setAuthToken = (token?: string) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};
