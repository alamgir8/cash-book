import axios, {
  AxiosHeaders,
  type AxiosRequestHeaders,
  type AxiosRequestConfig,
} from "axios";
import Constants from "expo-constants";
import { NativeModules } from "react-native";

const API_PORT = 4000;
const API_PATH = "/api";

const normalizeUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidates = trimmed.includes("://")
    ? [trimmed]
    : [`https://${trimmed}`, `http://${trimmed}`];

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const pathname = url.pathname.replace(/\/+$/, "");
      return `${url.origin}${pathname}${url.search}${url.hash}` || url.origin;
    } catch {
      continue;
    }
  }

  return null;
};

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
  const envUrl = normalizeUrl(process.env.EXPO_PUBLIC_BASE_URL);
  if (envUrl) {
    return envUrl;
  }

  const explicit =
    normalizeUrl(Constants.expoConfig?.extra?.apiBaseUrl) ??
    normalizeUrl(Constants.manifest?.extra?.apiBaseUrl);
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
      typeof candidate === "string" ? candidate : undefined,
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
let unauthorizedHandler: (() => void | Promise<void>) | null = null;
let tokenRefreshHandler: (() => Promise<string | null>) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const setUnauthorizedHandler = (
  handler?: (() => void | Promise<void>) | null,
) => {
  unauthorizedHandler = handler ?? null;
};

export const setTokenRefreshHandler = (
  handler?: (() => Promise<string | null>) | null,
) => {
  tokenRefreshHandler = handler ?? null;
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
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }
    if (config.headers instanceof AxiosHeaders) {
      if (!config.headers.has("Authorization")) {
        config.headers.set("Authorization", `Bearer ${currentToken}`);
      }
    } else {
      const headers = config.headers as Record<string, unknown>;
      if (headers.Authorization == null) {
        (headers as Record<string, string>).Authorization =
          `Bearer ${currentToken}`;
      }
      config.headers = headers as AxiosRequestHeaders;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
      _refreshNetworkError?: boolean;
    };

    if (
      error.response?.status === 401 &&
      tokenRefreshHandler &&
      !originalRequest?._retry
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = tokenRefreshHandler().finally(() => {
            refreshPromise = null;
          });
        }

        const newToken = await refreshPromise;

        if (newToken) {
          if (!originalRequest.headers) {
            originalRequest.headers = new AxiosHeaders();
          }
          if (originalRequest.headers instanceof AxiosHeaders) {
            originalRequest.headers.set("Authorization", `Bearer ${newToken}`);
          } else {
            (originalRequest.headers as Record<string, string>).Authorization =
              `Bearer ${newToken}`;
          }
          return api(originalRequest);
        }
      } catch (refreshError) {
        if (axios.isAxiosError(refreshError) && !refreshError.response) {
          (originalRequest as any)._refreshNetworkError = true;
          return Promise.reject(refreshError);
        }
        await Promise.resolve(unauthorizedHandler?.());
        return Promise.reject(refreshError);
      }
    }

    if (
      error.response?.status === 401 &&
      currentToken &&
      !(originalRequest as any)?._refreshNetworkError
    ) {
      await Promise.resolve(unauthorizedHandler?.());
    }

    return Promise.reject(error);
  },
);

export const getApiErrorMessage = (
  error: unknown,
  fallback = "Something went wrong",
) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    // Map well-known HTTP status codes to readable messages
    if (status === 413)
      return "File too large. Please use a smaller file (max 10 MB).";
    if (status === 429)
      return "Too many requests. Please slow down and try again.";
    if (status === 503) return "Service unavailable. Please try again later.";
    if (status === 504) return "Request timed out. Please try again.";

    const responseData = error.response?.data;

    // Axios sometimes returns the body as a string (e.g. HTML from Vercel/nginx)
    if (typeof responseData === "string" && responseData.trim().length > 0) {
      // Strip HTML tags — Vercel returns a full HTML 413 page
      const stripped = responseData
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      // If it still looks like a meaningful short message, use it
      if (stripped.length > 0 && stripped.length < 200) return stripped;
      // Otherwise fall through to status-based or fallback
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

    // Network error (no response)
    if (!error.response)
      return "Network error. Check your connection and try again.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};
