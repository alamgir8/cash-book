import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Animated,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import type { BackupStats } from "@/hooks/use-auto-backup";

interface AutoBackupSectionProps {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  /** Initial value loaded from AsyncStorage by the hook */
  initialLastBackupAt: Date | null;
  /**
   * Called when user taps "Backup Now". Receives an onProgress callback so the
   * component can update its own progress bar. Should return BackupStats on
   * success and throw on error.
   */
  onBackupNow: (
    onProgress: (step: string, pct: number) => void,
  ) => Promise<BackupStats>;
  onShare: () => Promise<void>;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin !== 1 ? "s" : ""} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr !== 1 ? "s" : ""} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
}

function StatBadge({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <View
      className="items-center px-3 py-1.5 rounded-xl"
      style={{ backgroundColor: color + "15" }}
    >
      <Text className="text-base font-bold" style={{ color }}>
        {count}
      </Text>
      <Text className="text-xs" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

export function AutoBackupSection({
  enabled,
  onToggle,
  initialLastBackupAt,
  onBackupNow,
  onShare,
}: AutoBackupSectionProps) {
  const { colors } = useTheme();
  const accentColor = "#10b981";

  // All visual state lives here — no prop-drilling race conditions
  const [status, setStatus] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [backupStats, setBackupStats] = useState<BackupStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(
    initialLastBackupAt,
  );

  // If the parent loads initialLastBackupAt asynchronously, sync it in once
  useEffect(() => {
    if (initialLastBackupAt && !lastBackupAt) {
      setLastBackupAt(initialLastBackupAt);
    }
  }, [initialLastBackupAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRunning = status === "running";

  const handleBackupNow = async () => {
    if (isRunning || !enabled) return;
    setStatus("running");
    setProgress(0);
    setProgressText("Starting…");
    setError(null);
    setBackupStats(null);
    try {
      const stats = await onBackupNow((step, pct) => {
        setProgressText(step);
        setProgress(pct);
      });
      setProgress(100);
      setProgressText("Done");
      setBackupStats(stats);
      setLastBackupAt(new Date());
      setStatus("success");
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Backup failed";
      setError(msg);
      setStatus("error");
      setProgress(0);
      setProgressText("");
      throw e; // let settings.tsx show Toast
    }
  };

  // Animated progress bar width
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: progress,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [progress, barAnim]);

  // Pulsing animation for the running indicator dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isRunning) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRunning, pulseAnim]);

  return (
    <View
      className="rounded-3xl p-6 border shadow-lg"
      style={{
        backgroundColor: colors.bg.secondary,
        borderColor: colors.border,
      }}
    >
      {/* ── Header ───────────────────────────────── */}
      <View className="flex-row items-center gap-4 mb-4">
        <View
          className="w-14 h-14 rounded-full items-center justify-center"
          style={{ backgroundColor: accentColor + "15" }}
        >
          <Ionicons name="shield-checkmark" size={28} color={accentColor} />
        </View>
        <View className="flex-1">
          <Text
            className="text-xl font-bold"
            style={{ color: colors.text.primary }}
          >
            Auto Backup
          </Text>
          <Text
            className="text-sm mt-0.5"
            style={{ color: colors.text.secondary }}
          >
            Automatic local backup every 24 hours
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: accentColor + "80" }}
          thumbColor={enabled ? accentColor : colors.text.secondary}
          ios_backgroundColor={colors.border}
        />
      </View>

      {/* ── Info box ─────────────────────────────── */}
      <View
        className="rounded-2xl p-4 mb-4"
        style={{ backgroundColor: accentColor + "10" }}
      >
        <View className="flex-row items-start gap-3">
          <Ionicons name="information-circle" size={20} color={accentColor} />
          <Text className="text-sm flex-1" style={{ color: accentColor }}>
            {enabled
              ? "Your data is automatically saved to this device on login and every 24 hours. Up to 5 backups are kept."
              : "Auto backup is currently disabled. Tap the toggle to enable it."}
          </Text>
        </View>
      </View>

      {/* ── WhatsApp-style status card ───────────── */}
      <View
        className="rounded-2xl p-4 mb-4"
        style={{
          backgroundColor:
            status === "error"
              ? colors.error + "10"
              : status === "success"
                ? accentColor + "08"
                : colors.bg.primary,
          borderWidth: 1,
          borderColor:
            status === "error"
              ? colors.error + "40"
              : status === "success"
                ? accentColor + "30"
                : colors.border,
        }}
      >
        {/* Running: progress bar + step text */}
        {isRunning && (
          <View className="gap-3">
            {/* Header row */}
            <View className="flex-row items-center gap-3">
              <ActivityIndicator size="small" color={accentColor} />
              <Text
                className="text-sm font-semibold flex-1"
                style={{ color: accentColor }}
              >
                {progressText || "Backing up…"}
              </Text>
              <Text
                className="text-sm font-bold tabular-nums"
                style={{ color: accentColor }}
              >
                {progress}%
              </Text>
            </View>

            {/* Progress bar track */}
            <View
              className="rounded-full overflow-hidden"
              style={{
                height: 8,
                backgroundColor: accentColor + "20",
              }}
            >
              <Animated.View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: accentColor,
                  width: barAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"],
                  }),
                }}
              />
            </View>

            {/* Step checklist */}
            <View className="gap-1.5">
              {[
                { label: "Connecting to server", threshold: 0 },
                { label: "Fetching account data", threshold: 10 },
                { label: "Processing records", threshold: 60 },
                { label: "Saving to device", threshold: 75 },
                { label: "Finishing up", threshold: 90 },
              ].map(({ label, threshold }) => {
                const done = progress > threshold + 14;
                const active = progress >= threshold && !done;
                return (
                  <View key={label} className="flex-row items-center gap-2">
                    <Ionicons
                      name={
                        done
                          ? "checkmark-circle"
                          : active
                            ? "ellipse"
                            : "ellipse-outline"
                      }
                      size={14}
                      color={
                        done
                          ? accentColor
                          : active
                            ? accentColor
                            : colors.border
                      }
                    />
                    <Text
                      className="text-xs"
                      style={{
                        color:
                          done || active
                            ? colors.text.primary
                            : colors.text.secondary,
                        fontWeight: active ? "600" : "400",
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Success stats row */}
        {status === "success" && backupStats && (
          <View className="gap-2">
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="checkmark-circle" size={18} color={accentColor} />
              <Text
                className="text-sm font-semibold"
                style={{ color: accentColor }}
              >
                Backup complete
              </Text>
            </View>
            <View className="flex-row gap-2 flex-wrap">
              <StatBadge
                count={backupStats.accounts}
                label="Accounts"
                color={colors.info}
              />
              <StatBadge
                count={backupStats.categories}
                label="Categories"
                color="#8b5cf6"
              />
              <StatBadge
                count={backupStats.transactions}
                label="Transactions"
                color={accentColor}
              />
              {backupStats.transfers > 0 && (
                <StatBadge
                  count={backupStats.transfers}
                  label="Transfers"
                  color={colors.warning}
                />
              )}
            </View>
          </View>
        )}

        {/* Error row */}
        {status === "error" && (
          <View
            className="rounded-xl p-3 flex-row items-start gap-3"
            style={{ backgroundColor: colors.error + "18" }}
          >
            <Ionicons name="warning" size={20} color={colors.error} />
            <View className="flex-1">
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.error }}
              >
                Backup failed
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.error + "cc" }}
              >
                {error || "Could not complete backup. Please try again."}
              </Text>
            </View>
          </View>
        )}

        {/* Idle row */}
        {status === "idle" && (
          <View className="flex-row items-center gap-3">
            <Ionicons
              name={lastBackupAt ? "checkmark-circle-outline" : "time-outline"}
              size={18}
              color={lastBackupAt ? accentColor : colors.text.secondary}
            />
            <Text className="text-sm" style={{ color: colors.text.secondary }}>
              {lastBackupAt
                ? `Last backed up ${formatRelativeTime(lastBackupAt)}`
                : "No backup yet — tap Backup Now"}
            </Text>
          </View>
        )}
      </View>

      {/* ── Action buttons ───────────────────────── */}
      <View className="gap-3">
        {/* Backup Now */}
        <TouchableOpacity
          onPress={() => void handleBackupNow()}
          disabled={isRunning || !enabled}
          activeOpacity={0.75}
          className="flex-row items-center gap-4 rounded-2xl p-4"
          style={{
            backgroundColor: accentColor + "15",
            opacity: isRunning || !enabled ? 0.45 : 1,
          }}
        >
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: accentColor + "30" }}
          >
            {isRunning ? (
              <ActivityIndicator size="small" color={accentColor} />
            ) : (
              <Ionicons name="save-outline" size={22} color={accentColor} />
            )}
          </View>
          <View className="flex-1">
            <Text
              className="text-base font-semibold"
              style={{ color: colors.text.primary }}
            >
              {isRunning ? "Backing up…" : "Backup Now"}
            </Text>
            <Text
              className="text-sm mt-0.5"
              style={{ color: colors.text.secondary }}
            >
              {isRunning
                ? progressText || "Please wait…"
                : "Save a backup to device storage immediately"}
            </Text>
          </View>
          {!isRunning && (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.text.secondary}
            />
          )}
        </TouchableOpacity>

        {/* Share to Google Drive / Email — always visible */}
        <TouchableOpacity
          onPress={onShare}
          disabled={isRunning}
          activeOpacity={0.75}
          className="flex-row items-center gap-4 rounded-2xl p-4"
          style={{
            backgroundColor: colors.info + "15",
            opacity: isRunning ? 0.45 : 1,
          }}
        >
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.info + "30" }}
          >
            <Ionicons
              name="share-social-outline"
              size={22}
              color={colors.info}
            />
          </View>
          <View className="flex-1">
            <Text
              className="text-base font-semibold"
              style={{ color: colors.text.primary }}
            >
              Share to Google Drive / Email
            </Text>
            <Text
              className="text-sm mt-0.5"
              style={{ color: colors.text.secondary }}
            >
              {lastBackupAt
                ? "Send latest backup via Google Drive, Gmail or Files"
                : "Create a backup first, then share it"}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.text.secondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
