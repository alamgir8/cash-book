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
  /** Epoch ms when delete mode ends; null when inactive */
  endsAt: number | null;
  /** Call this on every tap of the secret trigger (settings icon) */
  recordTap: () => void;
};

const DeleteModeStateContext = createContext<DeleteModeState | undefined>(
  undefined,
);

export function DeleteModeProvider({ children }: { children: ReactNode }) {
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
    const nextEndsAt = Date.now() + DELETE_MODE_DURATION_MS;
    setIsActive(true);
    setEndsAt(nextEndsAt);

    // No per-second setState here — that re-renders the entire app tree
    // (parties FlatList "jumps"). Countdown UI ticks locally in Settings.
    deactivateTimer.current = setTimeout(deactivate, DELETE_MODE_DURATION_MS);
  }, [clearTimers, deactivate]);

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
    () => ({ isDeleteModeActive: isActive, endsAt, recordTap }),
    [isActive, endsAt, recordTap],
  );

  return (
    <DeleteModeStateContext.Provider value={stateValue}>
      {children}
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

/**
 * Countdown for Settings badge only.
 * Local interval — does not re-render list screens under the provider.
 */
export function useDeleteModeSeconds() {
  const { isDeleteModeActive, endsAt } = useDeleteMode();
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!isDeleteModeActive || !endsAt) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      setSecondsLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isDeleteModeActive, endsAt]);

  return secondsLeft;
}
