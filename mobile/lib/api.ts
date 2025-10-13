import axios from "axios";
import Constants from "expo-constants";
import { NativeModules } from "react-native";

const API_PORT = 4000;
const API_PATH = "/api";

const buildUrlFromHostname = (hostname: string) => {
  if (!hostname) return null;
  const needsBrackets =
    hostname.includes(":") &&
    !hostname.startsWith("[") &&
    !hostname.endsWith("]");
  const formattedHost = needsBrackets ? `[${hostname}]` : hostname;
  return `http://${formattedHost}:${API_PORT}${API_PATH}`;
};

const parseHostname = (value?: string | null) => {
  if (!value) return null;
  try {
    const needsProtocol = !value.includes("://");
    const candidate = needsProtocol ? `http://${value}` : value;
    const url = new URL(candidate);
    return url.hostname || null;
  } catch {
    return null;
  }
};

// Determine the best base URL we can for the current runtime.
const getBaseURL = () => {
  const explicit =
    Constants.expoConfig?.extra?.apiBaseUrl ??
    Constants.manifest?.extra?.apiBaseUrl;
  if (explicit) {
    return explicit;
  }

  const hostCandidates = [
    Constants.expoConfig?.extra?.apiHost,
    Constants.expoConfig?.hostUri,
    Constants.manifest?.debuggerHost,
    NativeModules.SourceCode?.scriptURL,
  ];

  for (const candidate of hostCandidates) {
    const hostname = parseHostname(
      typeof candidate === "string" ? candidate : undefined
    );
    const url = hostname ? buildUrlFromHostname(hostname) : null;
    if (url) {
      return url;
    }
  }

  return `http://localhost:${API_PORT}${API_PATH}`;
};

export const baseURL = getBaseURL();

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

let currentToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const setUnauthorizedHandler = (handler?: () => void) => {
  unauthorizedHandler = handler ?? null;
};

export const setAuthToken = (token?: string) => {
  currentToken = token ?? null;

  if (!token) {
    delete api.defaults.headers.common.Authorization;
    return;
  }

  api.defaults.headers.common.Authorization = `Bearer ${token}`;
};

api.interceptors.request.use((config) => {
  if (currentToken) {
    config.headers = config.headers ?? {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 && currentToken) {
        unauthorizedHandler?.();
      }
    }
    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (
  error: unknown,
  fallback = "Something went wrong"
) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (typeof responseData === "string" && responseData.trim().length > 0) {
      return responseData;
    }
    if (
      responseData &&
      typeof responseData === "object" &&
      "message" in responseData
    ) {
      const { message } = responseData as Record<string, unknown>;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};
