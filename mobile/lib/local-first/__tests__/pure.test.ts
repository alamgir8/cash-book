import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveLastWriteWins } from "../conflicts.ts";

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
