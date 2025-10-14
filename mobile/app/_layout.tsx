import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { PreferencesProvider } from "../hooks/usePreferences";
import "../global.css";
import { SafeAreaView } from "react-native-safe-area-context";

const queryClient = new QueryClient();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* no-op */
});

const RootContent = () => {
  const { state } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setReady] = useState(false);

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
      if (isReady && state.status !== "loading") {
        await SplashScreen.hideAsync();
      }
    };
    void maybeHideSplash();
  }, [isReady, state.status]);

  useEffect(() => {
    if (state.status === "loading") return;

    const inAuthGroup = segments[0] === "(auth)";

    if (state.status === "authenticated" && inAuthGroup) {
      router.replace("/(app)" as any);
    } else if (state.status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/sign-in" as any);
    }
  }, [segments, state.status, router]);

  if (!isReady || state.status === "loading") {
    return null;
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1 }}
      // className="[bg-[#f8f7f4]"
    >
      <Slot />
      <StatusBar style="dark" backgroundColor="#f9fafb" />
      <Toast />
    </SafeAreaView>
  );
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PreferencesProvider>
            <RootContent />
          </PreferencesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
