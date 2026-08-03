import { useEffect, useState, useRef } from "react";
import { Slot, Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AuthProvider, useAuth } from "../hooks/use-auth";
import { PreferencesProvider } from "../hooks/use-preferences";
import { ThemeProvider, useTheme } from "../hooks/use-theme";
import {
  OrganizationProvider,
  useOrganization,
} from "../hooks/use-organization";
import { DeleteModeProvider } from "../hooks/use-delete-mode";
import { RestoreModeProvider } from "../hooks/use-restore-mode";
import { ErrorBoundary } from "../components/error-boundary";
import { AuthLoading } from "../components/auth-loading";
import { queryClient } from "../lib/queryClient";
import { organizationsApi } from "../services/organizations";
import type { OrganizationSummary } from "../services/organizations";
import { bootstrapLocalFirst } from "../lib/local-first/bootstrap";
import { startDailyLocalFirstJobs } from "../lib/local-first/daily-jobs";
import { startSyncScheduler } from "../sync/scheduler";
import {
  setDriveBackupUserKeyProvider,
  startDriveBackupScheduler,
} from "../services/drive-scheduler";
import { OfflineBanner } from "../components/offline-banner";
import { useInvalidateOnLocalFirstFlags } from "../hooks/use-invalidate-on-local-first";
import "../global.css";
import { SafeAreaView } from "react-native-safe-area-context";

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
        } catch (error: any) {
          const status = error?.response?.status;
          // 401 often means token refresh race / expired session — retry later quietly.
          if (status !== 401 && __DEV__) {
            console.warn("Failed to load organizations on startup:", error);
          }
          // Local-first: seed org switcher from SQLite so org-scoped books stay reachable.
          try {
            const { isLocalFirstEnabled } = await import(
              "@/lib/local-first/flags"
            );
            if (isLocalFirstEnabled()) {
              const { getDb } = await import("@/db/client");
              const db = await getDb();
              const rows = await db.getAllAsync<{
                organization_id: string;
                c: number;
              }>(
                `SELECT organization_id, COUNT(*) as c FROM transactions
                 WHERE deleted_at IS NULL
                   AND organization_id IS NOT NULL AND organization_id != ''
                 GROUP BY organization_id
                 ORDER BY c DESC`,
              );
              if (rows.length) {
                setOrganizations(
                  rows.map((r, i) => ({
                    id: r.organization_id,
                    name:
                      rows.length === 1
                        ? "Organization"
                        : `Organization ${i + 1}`,
                    business_type: "other",
                    role: "owner",
                    permissions: {},
                    settings: {},
                  })),
                );
              }
            }
          } catch {
            /* ignore */
          }
          // Reset flag so it can be retried when online
          hasLoadedOrgs.current = false;
        }
      }
    };

    // Reset when user logs out / switches account
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
  useInvalidateOnLocalFirstFlags();

  useEffect(() => {
    // Mark as ready immediately — add Font.loadAsync here if custom fonts are needed later
    void bootstrapLocalFirst().finally(() => setReady(true));
  }, []);

  const authUserKey =
    state.status === "authenticated"
      ? String(
          (state.user as { _id?: string; email?: string })?._id ||
            (state.user as { email?: string })?.email ||
            "user",
        )
      : null;

  useEffect(() => {
    if (!isReady || !authUserKey) return;
    setDriveBackupUserKeyProvider(() => authUserKey);
    const stopSync = startSyncScheduler();
    const stopDrive = startDriveBackupScheduler();
    // Once per local day after midnight (on foreground / 15m poll): Mongo sync + Drive backup.
    const stopDaily = startDailyLocalFirstJobs();
    return () => {
      stopSync();
      stopDrive();
      stopDaily();
    };
  }, [isReady, authUserKey]);

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
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
    >
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.bg.primary}
      />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }} />
      <Toast position="top" topOffset={56} visibilityTime={3000} />
    </SafeAreaView>
  );
};

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThemeProvider>
                <PreferencesProvider>
                  <OrganizationProvider>
                    <DeleteModeProvider>
                      <RestoreModeProvider>
                        <OrganizationLoader>
                          <RootContent />
                        </OrganizationLoader>
                      </RestoreModeProvider>
                    </DeleteModeProvider>
                  </OrganizationProvider>
                </PreferencesProvider>
              </ThemeProvider>
            </AuthProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
