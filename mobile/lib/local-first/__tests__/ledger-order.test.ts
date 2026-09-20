/**
 * Regression tests for ledger ordering (see lib/local-first/ledger-order.ts).
 *
 * These run against a real in-memory SQLite database via `node:sqlite`, because
 * the bug was purely a string-comparison artefact of the `date` column and can
 * only be pinned down by asking SQLite itself to sort.
 *
 * The reported symptom: transfer the money, then add more transactions the same
 * day, and the transfer shows up as the LAST event of the day with a wrong
 * (sometimes negative) "Balance after" — even though it happened first.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));

import {
  SQL_LEDGER_DAY,
  ORDER_LEDGER_NEWEST_FIRST,
  ORDER_LEDGER_OLDEST_FIRST,
  toLedgerDay,
} from "../ledger-order.ts";
import { computeRunningBalances } from "../running-balance.ts";

const openDb = () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      date TEXT,
      created_at TEXT,
      type TEXT,
      amount REAL,
      payment_status TEXT
    )
  `);
  return db;
};

const insert = (db: ReturnType<typeof openDb>, rows: Array<[string, string, string, string, number, string?]>) => {
  const stmt = db.prepare(
    "INSERT INTO transactions (id, date, created_at, type, amount, payment_status) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const [id, date, createdAt, type, amount, status] of rows) {
    stmt.run(id, date, createdAt, type, amount, status ?? "paid");
  }
};

const orderedIds = (db: ReturnType<typeof openDb>, orderBy: string) =>
  db
    .prepare(`SELECT id FROM transactions ${orderBy}`)
    .all()
    .map((row: any) => String(row.id));

test("the end-of-day transfer date used to push a transfer behind same-day rows", () => {
  const db = openDb();
  // Realistic data: the transfer happened FIRST on Sep 20 (stored, by the old
  // code, as 23:59:59), then two normal transactions were entered that day.
  // Normal rows store a plain local day, because both pickers are mode="date".
  insert(db, [
    ["transfer-out", "2026-09-20T23:59:59.000Z", "2026-09-20T09:00:00.000Z", "debit", 3000],
    ["later-expense", "2026-09-20", "2026-09-20T11:00:00.000Z", "debit", 500],
    ["later-income", "2026-09-20", "2026-09-20T12:00:00.000Z", "credit", 200],
  ]);

  // OLD behaviour: raw string comparison.
  const oldAsc = orderedIds(db, "ORDER BY date ASC, created_at ASC, id ASC");
  assert.deepEqual(
    oldAsc,
    ["later-expense", "later-income", "transfer-out"],
    "reproduces the bug: the transfer sorts last within its own day",
  );

  // NEW behaviour: group by calendar day, then entry order.
  const newAsc = orderedIds(db, ORDER_LEDGER_OLDEST_FIRST);
  assert.deepEqual(
    newAsc,
    ["transfer-out", "later-expense", "later-income"],
    "the transfer is back in entry order",
  );

  db.close();
});

test("the old ordering produced a wrong (negative) Balance after for the transfer", () => {
  const db = openDb();
  insert(db, [
    ["transfer-out", "2026-09-20T23:59:59.000Z", "2026-09-20T09:00:00.000Z", "debit", 3000],
    ["later-expense", "2026-09-20", "2026-09-20T11:00:00.000Z", "debit", 500],
  ]);

  const readTrail = (orderBy: string) =>
    computeRunningBalances(
      1000,
      db
        .prepare(
          `SELECT id, type, amount, payment_status FROM transactions ${orderBy}`,
        )
        .all() as any,
    );

  // Opening 1000 - transfer 3000 => -2000, then -500 => -2500. The transfer was
  // the FIRST event, so a negative balance there is genuinely correct data —
  // what is wrong in the old trail is its POSITION: it claims the transfer came
  // after the later expense.
  const oldTrail = readTrail("ORDER BY date ASC, created_at ASC, id ASC");
  assert.deepEqual(oldTrail.map((r) => r.id), ["later-expense", "transfer-out"]);

  const fixedTrail = readTrail(ORDER_LEDGER_OLDEST_FIRST);
  assert.deepEqual(
    fixedTrail.map((r) => r.id),
    ["transfer-out", "later-expense"],
  );
  assert.equal(fixedTrail[0].balance_after, -2000, "transfer evaluated first");
  assert.equal(fixedTrail[1].balance_after, -2500, "expense evaluated second");

  db.close();
});

test("mixed legacy and canonical same-day rows interleave by entry order", () => {
  const db = openDb();
  // A legacy row (timestamped) older than a newly-written canonical row must
  // still sort by entry order, not by string shape.
  insert(db, [
    ["legacy-transfer", "2026-09-20T23:59:59.000Z", "2026-09-20T08:00:00.000Z", "debit", 100],
    ["new-canonical", "2026-09-20", "2026-09-20T10:00:00.000Z", "credit", 50],
  ]);

  assert.deepEqual(orderedIds(db, ORDER_LEDGER_OLDEST_FIRST), [
    "legacy-transfer",
    "new-canonical",
  ]);

  db.close();
});

test("different days are still ordered by calendar day, not by string length", () => {
  const db = openDb();
  insert(db, [
    ["sep19-plain", "2026-09-19", "2026-09-19T10:00:00.000Z", "credit", 10],
    ["sep20-stamped", "2026-09-20T23:59:59.000Z", "2026-09-20T09:00:00.000Z", "debit", 20],
    ["sep21-plain", "2026-09-21", "2026-09-21T10:00:00.000Z", "credit", 30],
  ]);

  assert.deepEqual(orderedIds(db, ORDER_LEDGER_OLDEST_FIRST), [
    "sep19-plain",
    "sep20-stamped",
    "sep21-plain",
  ]);
  assert.deepEqual(orderedIds(db, ORDER_LEDGER_NEWEST_FIRST), [
    "sep21-plain",
    "sep20-stamped",
    "sep19-plain",
  ]);

  db.close();
});

test("ASC and DESC are exact mirrors so paging and trails cannot disagree", () => {
  const db = openDb();
  insert(db, [
    ["a", "2026-09-20", "2026-09-20T09:00:00.000Z", "debit", 1],
    ["b", "2026-09-20", "2026-09-20T10:00:00.000Z", "debit", 2],
    ["c", "2026-09-21", "2026-09-21T09:00:00.000Z", "credit", 3],
    ["d", "2026-09-19", "2026-09-19T09:00:00.000Z", "credit", 4],
  ]);

  const asc = orderedIds(db, ORDER_LEDGER_OLDEST_FIRST);
  const desc = orderedIds(db, ORDER_LEDGER_NEWEST_FIRST);

  assert.deepEqual(asc, ["d", "a", "b", "c"]);
  assert.deepEqual(desc, [...asc].reverse());

  db.close();
});

test("identical date and created_at fall back to id so paging is stable", () => {
  const db = openDb();
  // created_at ties happen in practice: bulk import / cloud migration writes many
  // rows inside the same millisecond. Without a final tie-breaker, LIMIT/OFFSET
  // paging can show a row twice and skip another.
  insert(db, [
    ["id-c", "2026-09-20", "2026-09-20T09:00:00.000Z", "debit", 1],
    ["id-a", "2026-09-20", "2026-09-20T09:00:00.000Z", "debit", 2],
    ["id-b", "2026-09-20", "2026-09-20T09:00:00.000Z", "debit", 3],
  ]);

  assert.deepEqual(orderedIds(db, ORDER_LEDGER_OLDEST_FIRST), [
    "id-a",
    "id-b",
    "id-c",
  ]);
  assert.deepEqual(orderedIds(db, ORDER_LEDGER_NEWEST_FIRST), [
    "id-c",
    "id-b",
    "id-a",
  ]);

  db.close();
});

test("dates are grouped by calendar day, not by timezone-shifted instant", () => {
  const db = openDb();
  // substr(date,1,10) must not run the value through UTC conversion: the stored
  // value is already a local calendar day, so an offset-bearing string keeps its
  // own day rather than shifting.
  insert(db, [
    ["local-early", "2026-09-20T00:30:00+06:00", "2026-09-20T01:00:00.000Z", "credit", 1],
    ["utc-late", "2026-09-19T22:00:00.000Z", "2026-09-19T23:00:00.000Z", "debit", 2],
  ]);

  assert.deepEqual(orderedIds(db, ORDER_LEDGER_OLDEST_FIRST), [
    "utc-late",
    "local-early",
  ]);

  db.close();
});

test("SQL_LEDGER_DAY normalises both stored shapes to one day key", () => {
  const db = openDb();
  insert(db, [
    ["plain", "2026-09-20", "2026-09-20T09:00:00.000Z", "debit", 1],
    ["stamped", "2026-09-20T23:59:59.000Z", "2026-09-20T09:00:00.000Z", "debit", 1],
  ]);
  const days = db
    .prepare(`SELECT DISTINCT ${SQL_LEDGER_DAY} AS day FROM transactions ORDER BY day`)
    .all()
    .map((r: any) => String(r.day));
  assert.deepEqual(days, ["2026-09-20"]);
  db.close();
});

test("toLedgerDay canonicalises input and rejects garbage", () => {
  const today = () => "2026-09-20";

  assert.equal(toLedgerDay("2026-09-20", today), "2026-09-20");
  // Legacy end-of-day value written by the old transfer code.
  assert.equal(toLedgerDay("2026-09-20T23:59:59.000Z", today), "2026-09-20");
  assert.equal(toLedgerDay("  2026-09-20  ", today), "2026-09-20");
  assert.equal(toLedgerDay(undefined, today), "2026-09-20");
  assert.equal(toLedgerDay("", today), "2026-09-20");
  assert.equal(toLedgerDay("yesterday", today), "2026-09-20");
  assert.equal(toLedgerDay("2026-9-2", today), "2026-09-20");
});

test("the transfer write path no longer appends an end-of-day time", () => {
  // A source-level guard: the hack that caused this bug must not come back.
  // Matched as a template-literal expression so the explanatory comment above
  // (which quotes the old value) does not trip it.
  const src = readFileSync(
    join(__dirname, "../../../data/transactions.local.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    src,
    /\$\{[^}]*\}T23:59:59\.000Z/,
    "transfer dates must not be rewritten to end-of-day",
  );
  assert.match(src, /toLedgerDay\(payload\.date, localDayKey\)/);
});

test("every ledger query uses the shared ordering fragments", () => {
  // Drift here is exactly what caused the bug, so pin the sites.
  const read = (rel: string) =>
    readFileSync(join(__dirname, "../../..", rel), "utf8");

  for (const file of [
    "db/balances.ts",
    "db/repos/transactions.ts",
    "data/transactions.local.ts",
    "data/parties.local.ts",
  ]) {
    const src = read(file);
    const raw = src.match(/ORDER BY date (ASC|DESC)/g) ?? [];
    assert.deepEqual(
      raw,
      [],
      `${file} still orders ledger rows by the raw date column`,
    );
    assert.match(
      src,
      /substr\(date, 1, 10\)/,
      `${file} should use the calendar-day ordering`,
    );
  }
});
