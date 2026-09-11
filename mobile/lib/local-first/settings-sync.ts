import { getDb } from "@/db/client";
import * as settingsRepo from "@/db/repos/settings";
import { SETTINGS_KEYS } from "@/db/repos/settings";
import { markSettingsSynced, markSettingsSyncError } from "@/db/repos/settings";
import type { LocalPendingOp } from "@/db/types";
import { updateProfile as apiUpdateProfile } from "@/services/auth";
import { organizationsApi } from "@/services/organizations";
import { getApiErrorMessage } from "@/lib/api";
import { nowIso } from "./ids";
import {
  isPermanentOpFailure,
  isValidQueuedPin,
  toServerProfilePayload,
} from "./settings-pure";

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

// ── Pure helpers ────────────────────────────────────────────────────────────
// Implemented in `./settings-pure` (dependency-free) and re-exported here so
// existing callers can keep importing from this module.
export {
  mergeSettings,
  toServerProfilePayload,
  isValidQueuedPin,
  isPermanentOpFailure,
  applyProfilePatchToUser,
} from "./settings-pure";

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

/** Clear the queued PIN — only call AFTER the server accepted it. */
export async function clearQueuedPin(): Promise<void> {
  try {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(QUEUED_PIN_KEY);
  } catch {
    /* nothing to clear */
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
  // Read (do not consume) the queued PIN so a failed request cannot lose it.
  const pin = await peekQueuedPin();
  const body: Record<string, any> = { ...payload };
  if (pin !== null) {
    if (!isValidQueuedPin(pin)) {
      throw new Error("Queued PIN is invalid");
    }
    body.login_pin = pin;
  }
  await apiUpdateProfile(body as any);
  // Server accepted it — now it is safe to forget the PIN.
  if (pin !== null) await clearQueuedPin();
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
