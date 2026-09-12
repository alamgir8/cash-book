import { router } from "expo-router";

type RouterType = typeof router;

/**
 * Safe back navigation — avoids the Expo "GO_BACK was not handled" error
 * that freezes tabs when the stack has no history.
 */
export function safeGoBack(
  fallback: string = "/(app)/settings",
  nav: Pick<RouterType, "canGoBack" | "back" | "replace"> = router,
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
