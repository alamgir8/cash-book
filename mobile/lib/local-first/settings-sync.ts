import { getDb } from "@/db/client";
import * as settingsRepo from "@/db/repos/settings";
import { SETTINGS_KEYS } from "@/db/repos/settings";
import { markSettingsSynced, markSettingsSyncError } from "@/db/repos/settings";
import type { LocalPendingOp } from "@/db/types";
import { updateProfile as apiUpdateProfile } from "@/services/auth";
import { organizationsApi } from "@/services/organizations";
import { getApiErrorMessage } from "@/lib/api";
import { nowIso } from "./ids";

/**
 * Offline-first settings layer.
 *
 * Settings live on the server but are NOT sync entities (the sync engine only
 * carries account/category/party/transaction/transfer), so the backend used to
 * be required for every save. This module mirrors them into SQLite and queues
 * writes in an outbox that is flushed whenever the backend is reachable.
 *
 * Security: the login PIN is a credential and is therefore never written to
 * SQLite — it is held in SecureStore until flushed.
 */

const QUEUED_PIN_KEY = "@lf_queued_login_pin";

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

/** Deep-merge plain objects; arrays and scalars replace. */
export function mergeSettings<T extends Record<string, any>>(
  base: T | null | undefined,
  patch: Partial<T> | Record<string, any>,
): T {
  const out: Record<string, any> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const prev = out[key];
    if (
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev) &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      out[key] = mergeSettings(prev, value as Record<string, any>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/** Normalize the several shapes the API accepts into one server payload. */
export function toServerProfilePayload(
  patch: Record<string, any>,
): Record<string, any> {
  const payload: Record<string, any> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.phone !== undefined) payload.phone = patch.phone;

  const profileSettings = patch.profile_settings ?? patch.settings;
  if (profileSettings) {
    const currency = profileSettings.currency_code ?? profileSettings.currency;
    const next: Record<string, any> = { ...profileSettings };
    if (currency) next.currency_code = currency;
    delete next.currency;
    payload.profile_settings = next;
  }
  // Note: login_pin is intentionally never part of a merged payload.
  return payload;
}

/**
 * A queued PIN may only exist as "" (remove) or 5 digits (set).
 * Anything else is corrupt and must not be transmitted.
 */
export function isValidQueuedPin(pin: unknown): pin is string {
  return typeof pin === "string" && (pin === "" || /^[0-9]{5}$/.test(pin));
}

/**
 * Apply a profile/preferences patch to the in-memory user optimistically, so
 * the UI reflects an offline save before the server confirms it. Mirrors the
 * two shapes the app uses for currency/language (`settings` and
 * `profile_settings`) so both stay consistent.
 */
export function applyProfilePatchToUser<T extends Record<string, any>>(
  user: T,
  patch: Record<string, any>,
  loginPin?: string,
): T {
  const next: Record<string, any> = { ...(user ?? {}) };

  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.phone !== undefined) next.phone = patch.phone;

  const ps = patch.profile_settings ?? patch.settings;
  if (ps) {
    const currency = ps.currency_code ?? ps.currency;
    const language = ps.language;

    next.profile_settings = { ...(user?.profile_settings ?? {}) };
    if (currency) {
      next.profile_settings.currency_code = currency;
      next.profile_settings.currency_symbol =
        ps.currency_symbol ?? user?.profile_settings?.currency_symbol;
    }
    if (language) next.profile_settings.language = language;

    next.settings = { ...(user?.settings ?? {}) };
    if (currency) next.settings.currency = currency;
    if (language) next.settings.language = language;
  }

  if (loginPin !== undefined) {
    next.security = {
      ...(user?.security ?? {}),
      // "" means the user disabled their PIN.
      has_login_pin: loginPin !== "",
    };
  }

  return next as T;
}

/** Ops that can never succeed and should be dropped rather than retried. */
export function isPermanentOpFailure(status?: number): boolean {
  return status === 400 || status === 403 || status === 404 || status === 422;
}

// ── PIN queue (SecureStore only — never SQLite) ─────────────────────────────

export async function queuePinChange(pin: string): Promise<void> {
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(QUEUED_PIN_KEY, pin);
}

export async function takeQueuedPin(): Promise<string | null> {
  try {
    const SecureStore = await import("expo-secure-store");
    const pin = await SecureStore.getItemAsync(QUEUED_PIN_KEY);
    if (pin !== null) await SecureStore.deleteItemAsync(QUEUED_PIN_KEY);
    return pin;
  } catch {
    return null;
  }
}

// ── Local writes (instant, offline) ─────────────────────────────────────────

export type ProfilePatch = Record<string, any>;

/**
 * Persist a profile patch locally and queue it for the server.
 * Returns immediately so the UI never blocks on the network.
 */
export async function saveLocalProfile(patch: ProfilePatch): Promise<void> {
  const db = await getDb();
  await settingsRepo.putSettingsValue(db, SETTINGS_KEYS.PROFILE, patch, {
    dirty: true,
  });
  await settingsRepo.enqueuePendingOp(db, {
    entity: "profile",
    payload: patch,
  });
}

export async function saveLocalPreferences(
  patch: Record<string, any>,
): Promise<void> {
  const db = await getDb();
  await settingsRepo.putSettingsValue(db, SETTINGS_KEYS.PREFERENCES, patch, {
    dirty: true,
  });
  // Preferences are part of the admin profile on the server.
  await settingsRepo.enqueuePendingOp(db, {
    entity: "profile",
    payload: { profile_settings: patch },
  });
}

export async function loadLocalProfile<
  T extends Record<string, any> = Record<string, any>,
>(): Promise<T | null> {
  const db = await getDb();
  const cached = await settingsRepo.getSettingsValue<T>(
    db,
    SETTINGS_KEYS.PROFILE,
  );
  return cached?.value ?? null;
}

export async function loadLocalPreferences<
  T extends Record<string, any> = Record<string, any>,
>(): Promise<T | null> {
  const db = await getDb();
  const cached = await settingsRepo.getSettingsValue<T>(
    db,
    SETTINGS_KEYS.PREFERENCES,
  );
  return cached?.value ?? null;
}

/**
 * Record the server's authoritative profile locally (dirty = 0) without
 * clobbering unsynced local edits.
 */
export async function cacheServerProfile(
  profile: Record<string, any>,
): Promise<void> {
  const db = await getDb();
  const existing = await settingsRepo.getSettingsValue(
    db,
    SETTINGS_KEYS.PROFILE,
  );
  if (existing?.dirty) return; // local edit still pending — keep it
  await settingsRepo.putSettingsValue(db, SETTINGS_KEYS.PROFILE, profile, {
    dirty: false,
  });
}

// ── Outbox flush ────────────────────────────────────────────────────────────

export type FlushResult = { flushed: number; failed: number; skipped: boolean };

async function flushProfileOp(
  op: LocalPendingOp,
  payload: Record<string, any>,
): Promise<void> {
  // The PIN rides in SecureStore; attach it to this single request only.
  const pin = await takeQueuedPin();
  const body: Record<string, any> = { ...payload };
  if (pin !== null) {
    if (!isValidQueuedPin(pin)) {
      throw new Error("Queued PIN is invalid");
    }
    body.login_pin = pin;
  }
  await apiUpdateProfile(body as any);
}

/**
 * Push all queued settings writes. Never throws: a failure leaves the op
 * queued for the next attempt so nothing is lost.
 */
export async function flushPendingOps(): Promise<FlushResult> {
  try {
    const { ensureLocalFirstFlags } = await import("./flags");
    await ensureLocalFirstFlags();
  } catch {
    /* flags unavailable — proceed with defaults */
  }

  let db;
  try {
    db = await getDb();
  } catch {
    return { flushed: 0, failed: 0, skipped: true };
  }

  const ops = await settingsRepo.listPendingOps(db);
  if (ops.length === 0) return { flushed: 0, failed: 0, skipped: false };

  let flushed = 0;
  let failed = 0;

  // Oldest first so a profile rename lands before later dependent edits.
  for (const op of ops) {
    let payload: Record<string, any> = {};
    try {
      payload = op.payload_json ? JSON.parse(op.payload_json) : {};
    } catch {
      await settingsRepo.deletePendingOp(db, op.id);
      continue;
    }

    try {
      if (op.entity === "profile") {
        const body = toServerProfilePayload(payload);
        // A queued PIN alone (no other fields) still needs a request.
        const hasPin = (await peekQueuedPin()) !== null;
        if (Object.keys(body).length === 0 && !hasPin) {
          await settingsRepo.deletePendingOp(db, op.id);
          continue;
        }
        await flushProfileOp(op, body);
        await markSettingsSynced(db, SETTINGS_KEYS.PROFILE);
      } else if (op.entity === "organization") {
        if (!op.entity_id) {
          await settingsRepo.deletePendingOp(db, op.id);
          continue;
        }
        await organizationsApi.update(
          op.entity_id,
          payload as any,
        );
      } else {
        // organization_create / organization_delete are queued but not yet
        // replayable (they need server id reconciliation) — retry later.
        failed += 1;
        await settingsRepo.markPendingOpFailed(
          db,
          op.id,
          "Not replayable yet — will retry",
        );
        continue;
      }

      await settingsRepo.deletePendingOp(db, op.id);
      flushed += 1;
    } catch (e: any) {
      const status = e?.response?.status;
      if (isPermanentOpFailure(status)) {
        await settingsRepo.deletePendingOp(db, op.id);
        await markSettingsSyncError(
          db,
          SETTINGS_KEYS.PROFILE,
          getApiErrorMessage(e, "Server rejected the change"),
        );
        failed += 1;
      } else {
        // Network/5xx — keep the op queued for the next sync.
        await settingsRepo.markPendingOpFailed(
          db,
          op.id,
          getApiErrorMessage(e, "Will retry"),
        );
        failed += 1;
      }
    }
  }

  return { flushed, failed, skipped: false };
}

async function peekQueuedPin(): Promise<string | null> {
  try {
    const SecureStore = await import("expo-secure-store");
    return await SecureStore.getItemAsync(QUEUED_PIN_KEY);
  } catch {
    return null;
  }
}

/** Count of settings writes still waiting to reach the server. */
export async function countPendingSettingsOps(): Promise<number> {
  try {
    const db = await getDb();
    return await settingsRepo.countPendingOps(db);
  } catch {
    return 0;
  }
}

export const __settingsInternals = {
  QUEUED_PIN_KEY,
  SETTINGS_KEYS,
  now: nowIso,
};
