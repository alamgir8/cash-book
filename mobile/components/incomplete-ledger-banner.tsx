import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import {
  isLocalFirstEnabled,
  loadLocalFirstFlags,
  subscribeLocalFirstFlags,
} from "@/lib/local-first/flags";

const SUSPICIOUSLY_LOW = 50;

/**
 * Warn when on-device ledger looks incomplete vs a typical cloud book,
 * so the user re-downloads instead of trusting a thin Drive restore.
 */
export function IncompleteLedgerBanner({
  localTransactionCount,
}: {
  localTransactionCount: number;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const [localFirst, setLocalFirst] = useState(isLocalFirstEnabled());
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    void loadLocalFirstFlags().then((f) => {
      setLocalFirst(f.localFirstEnabled);
      setMigrated(Boolean(f.migrationCompletedAt));
    });
    return subscribeLocalFirstFlags((f) => {
      setLocalFirst(f.localFirstEnabled);
      setMigrated(Boolean(f.migrationCompletedAt));
    });
  }, []);

  if (
    !localFirst ||
    !migrated ||
    localTransactionCount <= 0 ||
    localTransactionCount >= SUSPICIOUSLY_LOW
  ) {
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push("/(app)/settings")}
      style={{
        backgroundColor: colors.warning + "33",
        borderColor: colors.warning,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: 13,
          fontWeight: "700",
        }}
      >
        Only {localTransactionCount} transactions on this phone
      </Text>
      <Text
        style={{
          color: colors.text.secondary,
          fontSize: 12,
          marginTop: 4,
          lineHeight: 16,
        }}
      >
        Cloud has your full book (~1200+). Open Settings → On-device storage →
        Re-download from cloud (not an old Drive file).
      </Text>
    </TouchableOpacity>
  );
}
