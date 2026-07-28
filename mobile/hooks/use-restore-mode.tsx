/**
 * useRestoreMode
 *
 * Mirrors the delete-mode pattern: tap the "Settings" title 6 times quickly
 * to unlock Restore Backup for 2 minutes. Prevents accidental restores.
 */
import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { Alert } from "react-native";

const RESTORE_MODE_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const TAPS_REQUIRED = 6;
const TAP_WINDOW_MS = 3000;

type RestoreModeState = {
  isRestoreModeActive: boolean;
  /** Epoch ms when restore mode ends; null when inactive */
  endsAt: number | null;
  /** Call on each tap of the "Settings" heading */
  recordRestoreTap: () => void;
};

const RestoreModeStateContext = createContext<RestoreModeState | undefined>(
  undefined,
);

export function RestoreModeProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const tapTimestamps = useRef<number[]>([]);
  const deactivateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (deactivateTimer.current) clearTimeout(deactivateTimer.current);
    deactivateTimer.current = null;
  }, []);

  const deactivate = useCallback(() => {
    clearTimers();
    isActiveRef.current = false;
    setIsActive(false);
    setEndsAt(null);
  }, [clearTimers]);

  const activate = useCallback(() => {
    clearTimers();
    isActiveRef.current = true;
    const nextEndsAt = Date.now() + RESTORE_MODE_DURATION_MS;
    setIsActive(true);
    setEndsAt(nextEndsAt);

    // No per-second setState on the provider (avoids app-wide list jumps).
    deactivateTimer.current = setTimeout(deactivate, RESTORE_MODE_DURATION_MS);
  }, [clearTimers, deactivate]);

  const recordRestoreTap = useCallback(() => {
    const now = Date.now();
    tapTimestamps.current = tapTimestamps.current.filter(
      (t) => now - t < TAP_WINDOW_MS,
    );
    tapTimestamps.current.push(now);

    if (tapTimestamps.current.length >= TAPS_REQUIRED) {
      tapTimestamps.current = [];
      if (!isActiveRef.current) {
        Alert.alert(
          "Unlock Restore?",
          "This will enable Restore Backup for 2 minutes. Restoring will import data on top of your existing data.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Unlock", style: "destructive", onPress: activate },
          ],
        );
      }
    }
  }, [activate]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const stateValue = useMemo(
    () => ({ isRestoreModeActive: isActive, endsAt, recordRestoreTap }),
    [isActive, endsAt, recordRestoreTap],
  );

  return (
    <RestoreModeStateContext.Provider value={stateValue}>
      {children}
    </RestoreModeStateContext.Provider>
  );
}

export function useRestoreMode() {
  const ctx = useContext(RestoreModeStateContext);
  if (!ctx)
    throw new Error("useRestoreMode must be used inside RestoreModeProvider");
  return ctx;
}

/** Countdown for Settings badge only — local interval, not provider-wide. */
export function useRestoreModeSeconds() {
  const { isRestoreModeActive, endsAt } = useRestoreMode();
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!isRestoreModeActive || !endsAt) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      setSecondsLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRestoreModeActive, endsAt]);

  return secondsLeft;
}
