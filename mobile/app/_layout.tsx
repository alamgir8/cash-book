import { useEffect, useState, useRef } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import ToastManager from "toastify-react-native";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { PreferencesProvider } from "../hooks/usePreferences";
import { ThemeProvider, useTheme } from "../hooks/useTheme";
import {
  OrganizationProvider,
  useOrganization,
} from "../hooks/useOrganization";
import { ErrorBoundary } from "../components/error-boundary";
import { AuthLoading } from "../components/auth-loading";
import { queryClient } from "../lib/queryClient";
import { organizationsApi } from "../services/organizations";
import type { OrganizationSummary } from "../services/organizations";
import "../global.css";
import { SafeAreaView } from "react-native-safe-area-context";
import { View } from "react-native";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* no-op */
});

// Component to load organizations when user is authenticated
const OrganizationLoader = ({ children }: { children: React.ReactNode }) => {
  const { state } = useAuth();
  const { setOrganizations, organizations } = useOrganization();
  const hasLoadedOrgs = useRef(false);

  useEffect(() => {
    const loadOrganizations = async () => {
      if (state.status === "authenticated" && !hasLoadedOrgs.current) {
        try {
          hasLoadedOrgs.current = true;
          const orgs = await organizationsApi.list();
          const summaries: OrganizationSummary[] = orgs.map((o) => ({
            id: o._id,
            name: o.name,
            business_type: o.business_type,
            role: o.role || "owner",
            permissions: o.permissions || {},
            settings: o.settings,
          }));
          setOrganizations(summaries);
        } catch (error) {
          console.warn("Failed to load organizations on startup:", error);
          // Reset flag so it can be retried
          hasLoadedOrgs.current = false;
        }
      }
    };

    // Reset when user logs out
    if (state.status === "unauthenticated") {
      hasLoadedOrgs.current = false;
      setOrganizations([]);
    }

    loadOrganizations();
  }, [state.status, setOrganizations]);

  return <>{children}</>;
};

const RootContent = () => {
  const { state } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setReady] = useState(false);
  const [isNavigationReady, setNavigationReady] = useState(false);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        await Font.loadAsync({
          // Add any custom fonts here if needed
        });
      } catch (e) {
        console.warn(e);
      } finally {
        setReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    const maybeHideSplash = async () => {
      // Only hide splash when both resources are ready AND auth check is complete
      if (isReady && state.status !== "loading") {
        await SplashScreen.hideAsync();
      }
    };
    void maybeHideSplash();
  }, [isReady, state.status]);

  useEffect(() => {
    // Don't navigate until auth state is determined
    if (state.status === "loading") return;

    const inAuthGroup = segments[0] === "(auth)";

    if (state.status === "authenticated" && inAuthGroup) {
      router.replace("/(app)" as any);
      setNavigationReady(true);
    } else if (state.status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/sign-in" as any);
      setNavigationReady(true);
    } else {
      // Already on the correct route
      setNavigationReady(true);
    }
  }, [segments, state.status, router]);

  // Show loading screen while checking auth or resources not ready
  if (!isReady || state.status === "loading") {
    return <AuthLoading />;
  }

  // Show loading screen until navigation is complete to prevent flash
  if (!isNavigationReady) {
    return <AuthLoading />;
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
    >
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.bg.primary}
      />
      <ToastManager />
      <Slot />
      <Toast />
    </SafeAreaView>
  );
};

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider>
              <PreferencesProvider>
                <OrganizationProvider>
                  <OrganizationLoader>
                    <RootContent />
                  </OrganizationLoader>
                </OrganizationProvider>
              </PreferencesProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
