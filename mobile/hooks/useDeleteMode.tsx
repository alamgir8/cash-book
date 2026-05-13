import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { Alert } from "react-native";

const DELETE_MODE_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const TAPS_REQUIRED = 6;
const TAP_WINDOW_MS = 3000; // taps must happen within 3s of each other

type DeleteModeContextType = {
  isDeleteModeActive: boolean;
  /** Call this on every tap of the secret trigger (settings icon) */
  recordTap: () => void;
  /** Remaining seconds while delete mode is active */
  secondsLeft: number;
};

const DeleteModeContext = createContext<DeleteModeContextType | undefined>(
  undefined,
);

export function DeleteModeProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tapTimestamps = useRef<number[]>([]);
  const deactivateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (deactivateTimer.current) clearTimeout(deactivateTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    deactivateTimer.current = null;
    countdownInterval.current = null;
  };

  const activate = useCallback(() => {
    clearTimers();
    setIsActive(true);
    const endsAt = Date.now() + DELETE_MODE_DURATION_MS;
    setSecondsLeft(Math.round(DELETE_MODE_DURATION_MS / 1000));

    countdownInterval.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearTimers();
        setIsActive(false);
      }
    }, 1000);

    deactivateTimer.current = setTimeout(() => {
      clearTimers();
      setIsActive(false);
      setSecondsLeft(0);
    }, DELETE_MODE_DURATION_MS);
  }, []);

  const recordTap = useCallback(() => {
    const now = Date.now();
    // Remove taps outside the window
    tapTimestamps.current = tapTimestamps.current.filter(
      (t) => now - t < TAP_WINDOW_MS,
    );
    tapTimestamps.current.push(now);

    if (tapTimestamps.current.length >= TAPS_REQUIRED) {
      tapTimestamps.current = [];
      if (!isActive) {
        Alert.alert(
          "Enable Delete Mode?",
          "This will show a Delete button on every transaction for 2 minutes. Use with caution.",
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
  }, [isActive, activate]);

  useEffect(() => () => clearTimers(), []);

  return (
    <DeleteModeContext.Provider
      value={{ isDeleteModeActive: isActive, recordTap, secondsLeft }}
    >
      {children}
    </DeleteModeContext.Provider>
  );
}

export function useDeleteMode() {
  const ctx = useContext(DeleteModeContext);
  if (!ctx)
    throw new Error("useDeleteMode must be used inside DeleteModeProvider");
  return ctx;
}
