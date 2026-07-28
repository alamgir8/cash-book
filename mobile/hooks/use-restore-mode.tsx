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
  /** Call on each tap of the "Settings" heading */
  recordRestoreTap: () => void;
};

const RestoreModeStateContext = createContext<RestoreModeState | undefined>(
  undefined,
);
const RestoreModeSecondsContext = createContext(0);

export function RestoreModeProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tapTimestamps = useRef<number[]>([]);
  const deactivateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (deactivateTimer.current) clearTimeout(deactivateTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    deactivateTimer.current = null;
    countdownInterval.current = null;
  }, []);

  const activate = useCallback(() => {
    clearTimers();
    isActiveRef.current = true;
    setIsActive(true);
    const endsAt = Date.now() + RESTORE_MODE_DURATION_MS;
    setSecondsLeft(Math.round(RESTORE_MODE_DURATION_MS / 1000));

    countdownInterval.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearTimers();
        isActiveRef.current = false;
        setIsActive(false);
      }
    }, 1000);

    deactivateTimer.current = setTimeout(() => {
      clearTimers();
      isActiveRef.current = false;
      setIsActive(false);
      setSecondsLeft(0);
    }, RESTORE_MODE_DURATION_MS);
  }, [clearTimers]);

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
    () => ({ isRestoreModeActive: isActive, recordRestoreTap }),
    [isActive, recordRestoreTap],
  );

  return (
    <RestoreModeStateContext.Provider value={stateValue}>
      <RestoreModeSecondsContext.Provider value={secondsLeft}>
        {children}
      </RestoreModeSecondsContext.Provider>
    </RestoreModeStateContext.Provider>
  );
}

export function useRestoreMode() {
  const ctx = useContext(RestoreModeStateContext);
  if (!ctx)
    throw new Error("useRestoreMode must be used inside RestoreModeProvider");
  return ctx;
}

export function useRestoreModeSeconds() {
  return useContext(RestoreModeSecondsContext);
}
