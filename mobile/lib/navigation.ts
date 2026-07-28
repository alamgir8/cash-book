import { router, type Router } from "expo-router";

/**
 * Safe back navigation — avoids the Expo "GO_BACK was not handled" error
 * that freezes tabs when the stack has no history.
 */
export function safeGoBack(
  fallback: string = "/(app)/settings",
  nav: Pick<Router, "canGoBack" | "back" | "replace"> = router,
) {
  try {
    if (typeof nav.canGoBack === "function" && nav.canGoBack()) {
      nav.back();
      return;
    }
  } catch {
    // fall through to replace
  }
  nav.replace(fallback as any);
}
