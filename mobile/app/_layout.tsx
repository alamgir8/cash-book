import { useEffect } from "react";
import { Slot, SplashScreen, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import "../global.css";

SplashScreen.preventAutoHideAsync().catch(() => {
  // noop
});

const queryClient = new QueryClient();

const RootContent = () => {
  const { state } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "loading") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [state.status]);

  useEffect(() => {
    if (state.status === "loading") return;

    const inAuthGroup = segments[0] === "(auth)";

    if (state.status === "authenticated" && inAuthGroup) {
      router.replace("/(app)/index");
    } else if (state.status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    }
  }, [segments, state.status, router]);

  if (state.status === "loading") {
    return null;
  }

  return (
    <>
      <Slot />
      <StatusBar style="dark" backgroundColor="#f9fafb" />
      <Toast />
    </>
  );
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootContent />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
