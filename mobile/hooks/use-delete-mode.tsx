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

const DELETE_MODE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const TAPS_REQUIRED = 6;
const TAP_WINDOW_MS = 3000; // taps must happen within 3s of each other

type DeleteModeState = {
  isDeleteModeActive: boolean;
  /** Call this on every tap of the secret trigger (settings icon) */
  recordTap: () => void;
};

const DeleteModeStateContext = createContext<DeleteModeState | undefined>(
  undefined,
);
const DeleteModeSecondsContext = createContext(0);

export function DeleteModeProvider({ children }: { children: ReactNode }) {
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
    const endsAt = Date.now() + DELETE_MODE_DURATION_MS;
    setSecondsLeft(Math.round(DELETE_MODE_DURATION_MS / 1000));

    // Only tick secondsLeft — do not put it in the main context value,
    // or every consumer (parties list, dashboard, etc.) re-renders every second.
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
    }, DELETE_MODE_DURATION_MS);
  }, [clearTimers]);

  const recordTap = useCallback(() => {
    const now = Date.now();
    tapTimestamps.current = tapTimestamps.current.filter(
      (t) => now - t < TAP_WINDOW_MS,
    );
    tapTimestamps.current.push(now);

    if (tapTimestamps.current.length >= TAPS_REQUIRED) {
      tapTimestamps.current = [];
      if (!isActiveRef.current) {
        Alert.alert(
          "Enable Delete Mode?",
          "This will show Delete actions for 5 minutes. Use with caution.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Enable",
              style: "destructive",
              onPress: activate,
            },
          ],
        );
      }
    }
  }, [activate]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const stateValue = useMemo(
    () => ({ isDeleteModeActive: isActive, recordTap }),
    [isActive, recordTap],
  );

  return (
    <DeleteModeStateContext.Provider value={stateValue}>
      <DeleteModeSecondsContext.Provider value={secondsLeft}>
        {children}
      </DeleteModeSecondsContext.Provider>
    </DeleteModeStateContext.Provider>
  );
}

/** Active flag + secret tap handler. Does not re-render on countdown ticks. */
export function useDeleteMode() {
  const ctx = useContext(DeleteModeStateContext);
  if (!ctx)
    throw new Error("useDeleteMode must be used inside DeleteModeProvider");
  return ctx;
}

/** Countdown only — subscribe from Settings UI, not list screens. */
export function useDeleteModeSeconds() {
  return useContext(DeleteModeSecondsContext);
}
