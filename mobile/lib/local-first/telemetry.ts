import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Privacy-safe local-first telemetry (Phase 8).
 * Never store amounts, names, emails, or entity payloads — only event names + coarse codes.
 */

export type LfEventName =
  | "sync_success"
  | "sync_fail"
  | "backup_success"
  | "backup_fail"
  | "migration_success"
  | "migration_fail"
  | "drive_backup_success"
  | "drive_backup_fail"
  | "drive_restore_success"
  | "drive_restore_fail";

export type LfEventProps = {
  /** Coarse error/reason code — no free-text that may contain PII */
  code?: string;
  /** Non-sensitive counters (pushed/pulled counts, etc.) */
  count?: number;
  count2?: number;
};

export type LfEvent = {
  name: LfEventName;
  at: string;
  props?: LfEventProps;
};

const STORAGE_KEY = "@lf_telemetry_events";
const MAX_EVENTS = 40;

function sanitizeCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  // Keep short alphanumeric / underscore tokens only
  const cleaned = String(code)
    .slice(0, 64)
    .replace(/[^a-zA-Z0-9_\-./]/g, "_");
  return cleaned || undefined;
}

export async function trackLfEvent(
  name: LfEventName,
  props?: LfEventProps,
): Promise<void> {
  const event: LfEvent = {
    name,
    at: new Date().toISOString(),
    props: props
      ? {
          code: sanitizeCode(props.code),
          count:
            typeof props.count === "number" && Number.isFinite(props.count)
              ? Math.trunc(props.count)
              : undefined,
          count2:
            typeof props.count2 === "number" && Number.isFinite(props.count2)
              ? Math.trunc(props.count2)
              : undefined,
        }
      : undefined,
  };

  if (__DEV__) {
    console.info("[lf-telemetry]", event.name, event.props ?? {});
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const prev: LfEvent[] = raw ? (JSON.parse(raw) as LfEvent[]) : [];
    const next = [...prev, event].slice(-MAX_EVENTS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* telemetry must never break product paths */
  }
}

export async function getRecentLfEvents(): Promise<LfEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LfEvent[];
  } catch {
    return [];
  }
}

/** Map thrown errors to a short privacy-safe code. */
export function errorCodeFromUnknown(err: unknown): string {
  const e = err as { response?: { status?: number }; message?: string };
  const status = e?.response?.status;
  if (status) return `http_${status}`;
  const msg = String(e?.message || err || "error").toLowerCase();
  if (msg.includes("network")) return "network";
  if (msg.includes("checksum")) return "checksum";
  if (msg.includes("insufficient") && msg.includes("scope")) {
    return "drive_scope_missing";
  }
  if (msg.includes("not on this server") || msg.includes("/sync")) {
    return "sync_api_missing";
  }
  if (msg.includes("disabled")) return "disabled";
  if (msg.includes("already")) return "already";
  return "error";
}
