import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveLastWriteWins } from "../conflicts.ts";
import {
  MAX_CLOCK_SKEW_MS,
  clampUpdatedAt,
  setClockOffsetMs,
} from "../clock.ts";
import { canonicalize } from "../checksum.ts";
import { createClientRequestId } from "../ids.ts";
import { errorCodeFromUnknown } from "../telemetry.ts";
import { googleIosReversedScheme } from "../google-oauth.ts";
import { computeUseLocalPersonalLedger } from "../ledger-scope-pure.ts";
import { localDayKey } from "../day-key.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("LWW prefers newer updated_at", () => {
  const decision = resolveLastWriteWins(
    {
      id: "1",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
      device_id: "a",
    },
    {
      id: "1",
      updated_at: "2026-01-02T00:00:00.000Z",
      deleted_at: null,
      device_id: "b",
    },
  );
  assert.equal(decision.winner, "incoming");
});

test("LWW equal ts uses higher device_id", () => {
  const ts = "2026-01-01T00:00:00.000Z";
  const decision = resolveLastWriteWins(
    { id: "1", updated_at: ts, deleted_at: null, device_id: "dev-a" },
    { id: "1", updated_at: ts, deleted_at: null, device_id: "dev-z" },
  );
  assert.equal(decision.winner, "incoming");
});

test("LWW equal prefers delete", () => {
  const ts = "2026-01-01T00:00:00.000Z";
  const decision = resolveLastWriteWins(
    { id: "1", updated_at: ts, deleted_at: null, device_id: "dev-a" },
    {
      id: "1",
      updated_at: ts,
      deleted_at: ts,
      device_id: "dev-a",
    },
  );
  assert.equal(decision.winner, "incoming");
});

test("migration 001 contains core tables", () => {
  const src = readFileSync(
    join(__dirname, "../../../db/migrations/index.ts"),
    "utf8",
  );
  assert.match(src, /CREATE TABLE IF NOT EXISTS accounts/);
  assert.match(src, /CREATE TABLE IF NOT EXISTS transactions/);
  assert.match(src, /CREATE TABLE IF NOT EXISTS parties/);
  assert.doesNotMatch(src, /CREATE TABLE IF NOT EXISTS schema_version/);
});

test("clampUpdatedAt leaves timestamps within skew alone", () => {
  setClockOffsetMs(0);
  const server = "2026-08-03T12:00:00.000Z";
  const local = "2026-08-03T12:02:00.000Z";
  assert.equal(clampUpdatedAt(local, server), local);
});

test("clampUpdatedAt clamps far-future device clocks", () => {
  setClockOffsetMs(0);
  const server = "2026-08-03T12:00:00.000Z";
  const skewed = new Date(
    Date.parse(server) + MAX_CLOCK_SKEW_MS + 60_000,
  ).toISOString();
  assert.equal(clampUpdatedAt(skewed, server), server);
});

test("canonicalize sorts object keys stably", () => {
  const a = canonicalize({ b: 1, a: { z: 2, y: 3 } });
  const b = canonicalize({ a: { y: 3, z: 2 }, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":{"y":3,"z":2},"b":1}');
});

test("createClientRequestId has expected prefix", () => {
  assert.match(createClientRequestId(), /^crid-[a-z0-9]+-[a-z0-9]+$/i);
});

test("errorCodeFromUnknown maps common failures", () => {
  assert.equal(
    errorCodeFromUnknown({ response: { status: 404 } }),
    "http_404",
  );
  assert.equal(
    errorCodeFromUnknown(new Error("insufficient authentication scopes")),
    "drive_scope_missing",
  );
  assert.equal(errorCodeFromUnknown(new Error("network down")), "network");
});

test("googleIosReversedScheme derives callback scheme", () => {
  assert.equal(
    googleIosReversedScheme(
      "470488515683-abc.apps.googleusercontent.com",
    ),
    "com.googleusercontent.apps.470488515683-abc",
  );
  assert.equal(googleIosReversedScheme("bad"), null);
});

test("computeUseLocalPersonalLedger is offline-first when LF on", () => {
  assert.equal(computeUseLocalPersonalLedger(false, false, null), false);
  assert.equal(computeUseLocalPersonalLedger(true, false, null), true);
  // Org scope still uses SQLite when local-first is on (not Mongo).
  assert.equal(computeUseLocalPersonalLedger(true, false, "org1"), true);
  assert.equal(computeUseLocalPersonalLedger(true, true, "org1"), true);
  assert.equal(computeUseLocalPersonalLedger(true, true, null), true);
});

test("local-first defaults are on-device + cloud sync", () => {
  const src = readFileSync(
    join(__dirname, "../flags.ts"),
    "utf8",
  );
  assert.match(src, /localFirstEnabled:\s*true/);
  assert.match(src, /cloudSyncEnabled:\s*true/);
});

test("login mode defaults to single", () => {
  const src = readFileSync(
    join(__dirname, "../../auth/login-mode.ts"),
    "utf8",
  );
  assert.match(src, /DEFAULT_MODE:\s*LoginMode\s*=\s*"single"/);
  assert.match(src, /every_time/);
});

test("localDayKey formats YYYY-MM-DD", () => {
  assert.equal(localDayKey(new Date(2026, 7, 3, 23, 30, 0)), "2026-08-03");
});

test("migration 002 adds sync_status columns", () => {
  const src = readFileSync(
    join(__dirname, "../../../db/migrations/index.ts"),
    "utf8",
  );
  assert.match(src, /name: "002_sync_status"/);
  assert.match(src, /ALTER TABLE accounts ADD COLUMN sync_status/);
  assert.match(src, /ALTER TABLE transactions ADD COLUMN retry_count/);
  assert.match(src, /idx_parties_updated/);
});

test("syncStatusForMutation maps create/update/delete", async () => {
  const { syncStatusForMutation } = await import(
    "../../../db/sync-status.ts"
  );
  assert.equal(syncStatusForMutation({ isCreate: true }), "pending_create");
  assert.equal(syncStatusForMutation({}), "pending_update");
  assert.equal(syncStatusForMutation({ deleted: true }), "pending_delete");
});

test("owner helper exports isolation API", () => {
  const src = readFileSync(
    join(__dirname, "../owner.ts"),
    "utf8",
  );
  assert.match(src, /export async function ensureLocalLedgerOwner/);
  assert.match(src, /export async function resetLocalLedgerForUserChange/);
  assert.match(src, /export async function clearLocalAttachmentFiles/);
  assert.match(src, /META_KEYS\.OWNER_ADMIN_ID/);
});

test("levelFromRatio uses configurable thresholds", async () => {
  const { levelFromRatio, DEFAULT_STORAGE_THRESHOLDS } = await import(
    "../storage-monitor.ts"
  );
  assert.equal(levelFromRatio(0.5, DEFAULT_STORAGE_THRESHOLDS), "ok");
  assert.equal(levelFromRatio(0.8, DEFAULT_STORAGE_THRESHOLDS), "warning");
  assert.equal(levelFromRatio(0.9, DEFAULT_STORAGE_THRESHOLDS), "strong");
  assert.equal(levelFromRatio(0.95, DEFAULT_STORAGE_THRESHOLDS), "critical");
});

test("scheduler exports mutation + backoff sync entry points", () => {
  const src = readFileSync(
    join(__dirname, "../../../sync/scheduler.ts"),
    "utf8",
  );
  assert.match(src, /export function requestSyncSoon/);
  assert.match(src, /export function requestSyncNow/);
  assert.match(src, /BACKOFF_STEPS_MS/);
  assert.match(src, /probeBackendAvailable/);
  assert.match(src, /reconnect/);
});

test("backend sync applies account \$inc on transaction push", () => {
  const src = readFileSync(
    join(
      __dirname,
      "../../../../backend/controllers/sync.controller.js",
    ),
    "utf8",
  );
  assert.match(src, /accountCashDelta/);
  assert.match(src, /applyAccountInc/);
  assert.match(src, /Do NOT trust client current_balance/);
});

test("ledger screens prefer DAL over raw partiesApi/fetchAccounts", () => {
  const invoice = readFileSync(
    join(__dirname, "../../../app/(app)/invoices/create.tsx"),
    "utf8",
  );
  assert.match(invoice, /dalFetchAccounts/);
  assert.match(invoice, /dalFetchParties/);
  assert.match(invoice, /dalCreateParty/);
  assert.doesNotMatch(invoice, /from "@\/services\/parties"/);
  assert.doesNotMatch(invoice, /from "@\/services\/accounts"/);

  const scheme = readFileSync(
    join(__dirname, "../../../app/(app)/schemes/[schemeId]/index.tsx"),
    "utf8",
  );
  assert.match(scheme, /dalFetchAccounts/);
  assert.match(scheme, /dalCreateParty/);
  assert.doesNotMatch(scheme, /from "@\/services\/parties"/);

  const reports = readFileSync(
    join(__dirname, "../../../services/reports.ts"),
    "utf8",
  );
  assert.match(reports, /dalFetchAccountDetail/);
  assert.match(reports, /dalFetchPartyLedger/);
  assert.doesNotMatch(reports, /partiesApi\.getLedger/);
});
