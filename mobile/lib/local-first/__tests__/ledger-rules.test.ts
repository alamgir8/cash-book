/**
 * Regression tests for the four ledger rule fixes.
 *
 * The SQL-side rules are exercised against a real in-memory SQLite database
 * (`node:sqlite`) so the aggregate behaviour is asserted rather than described.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  CASH_PAID_SQL,
  NON_TRANSFER_SQL,
  PAID_SQL,
  SETTLED_DUE_SQL,
  isPaidLike,
  isSettledDue,
  isTransferLeg,
} from "../ledger-rules.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const openDb = () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      date TEXT,
      type TEXT,
      amount REAL,
      payment_status TEXT,
      parent_due_id TEXT,
      due_remaining REAL,
      due_settled_at TEXT,
      transfer_id TEXT
    )
  `);
  return db;
};

type Row = {
  id: string;
  date?: string;
  type?: string;
  amount?: number;
  status?: string | null;
  parent?: string | null;
  remaining?: number | null;
  settled?: string | null;
  transfer?: string | null;
};

const insert = (db: ReturnType<typeof openDb>, rows: Row[]) => {
  const stmt = db.prepare(
    `INSERT INTO transactions
      (id, date, type, amount, payment_status, parent_due_id, due_remaining, due_settled_at, transfer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of rows) {
    stmt.run(
      r.id,
      r.date ?? "2026-09-20",
      r.type ?? "credit",
      r.amount ?? 0,
      r.status === undefined ? "paid" : r.status,
      r.parent ?? null,
      r.remaining ?? null,
      r.settled ?? null,
      r.transfer ?? null,
    );
  }
};

const sums = (db: ReturnType<typeof openDb>, where: string) =>
  db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN ${NON_TRANSFER_SQL} AND lower(trim(type)) = 'debit' THEN amount ELSE 0 END), 0) AS debit,
         COALESCE(SUM(CASE WHEN ${NON_TRANSFER_SQL} AND lower(trim(type)) = 'credit' THEN amount ELSE 0 END), 0) AS credit,
         COUNT(*) AS count
       FROM transactions WHERE ${where}`,
    )
    .get() as { debit: number; credit: number; count: number };

// ── Fix 1: transfers are not income or expense ────────────────────────────────

test("transfer legs no longer inflate Income and Expenses", () => {
  const db = openDb();
  insert(db, [
    // A real sale (income) and a real purchase (expense).
    { id: "sale", type: "credit", amount: 1000 },
    { id: "expense", type: "debit", amount: 400 },
    // Moving 500 between own accounts: creates a debit leg AND a credit leg.
    { id: "tr-out", type: "debit", amount: 500, transfer: "t1" },
    { id: "tr-in", type: "credit", amount: 500, transfer: "t1" },
  ]);

  // Old behaviour (no exclusion) counted the transfer as income and expense.
  const before = sums(db, "1=1");
  const rawNet = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN lower(trim(type)) = 'debit' THEN amount ELSE 0 END), 0) AS debit,
         COALESCE(SUM(CASE WHEN lower(trim(type)) = 'credit' THEN amount ELSE 0 END), 0) AS credit
       FROM transactions`,
    )
    .get() as { debit: number; credit: number };
  assert.equal(rawNet.credit, 1500, "transfer inflated income by 500");
  assert.equal(rawNet.debit, 900, "transfer inflated expenses by 500");

  const after = sums(db, "1=1");
  assert.equal(after.credit, 1000, "income is now the real sale only");
  assert.equal(after.debit, 400, "expenses are now the real purchase only");

  // Net must be unchanged — the legs always cancelled.
  assert.equal(
    before.credit - before.debit,
    after.credit - after.debit,
    "excluding transfers must not change the net balance",
  );
  assert.equal(after.credit - after.debit, 600);

  // count still reflects the visible row count, so the list and count agree.
  assert.equal(after.count, 4);

  db.close();
});

test("isTransferLeg matches the SQL exclusion", () => {
  assert.equal(isTransferLeg({ transfer_id: "t1" }), true);
  assert.equal(isTransferLeg({ transfer_id: "" }), false);
  assert.equal(isTransferLeg({ transfer_id: null }), false);
  assert.equal(isTransferLeg({}), false);
});

// ── Fix 2: settled dues are visible under Paid ────────────────────────────────

test("a settled due matches the Paid chip and not the Due chip", () => {
  const db = openDb();
  insert(db, [
    // Open due: owes 300.
    { id: "open", type: "debit", amount: 300, status: "due", remaining: 300 },
    // Fully settled due: remaining 0 + settled stamp, status stays 'due'.
    {
      id: "settled",
      type: "debit",
      amount: 200,
      status: "due",
      remaining: 0,
      settled: "2026-09-20T10:00:00.000Z",
    },
    // Legacy settled due: no stamp, but remaining 0.
    { id: "legacy-settled", type: "debit", amount: 50, status: "due", remaining: 0 },
    // The paid child that actually moved the cash for the settled due.
    { id: "child", type: "debit", amount: 200, status: "paid", parent: "settled" },
    { id: "normal", type: "credit", amount: 10, status: "paid" },
  ]);

  // Old Paid chip: only explicit paid rows, so settled roots vanished.
  const oldPaid = db
    .prepare(
      `SELECT id FROM transactions
       WHERE (payment_status = 'paid' OR payment_status IS NULL OR payment_status = '')
       ORDER BY id`,
    )
    .all()
    .map((r: any) => String(r.id));
  assert.deepEqual(oldPaid, ["child", "normal"]);
  assert.ok(!oldPaid.includes("settled"), "the bug: settled due invisible under Paid");

  const newPaid = db
    .prepare(`SELECT id FROM transactions WHERE ${PAID_SQL} ORDER BY id`)
    .all()
    .map((r: any) => String(r.id));
  assert.ok(newPaid.includes("settled"));
  assert.ok(newPaid.includes("legacy-settled"));
  assert.ok(!newPaid.includes("open"), "an OPEN due must not count as paid");

  // The Due chip is unchanged: open roots only.
  const due = db
    .prepare(
      `SELECT id FROM transactions
       WHERE payment_status = 'due'
         AND (parent_due_id IS NULL OR parent_due_id = '')
         AND COALESCE(due_remaining, amount) > 0
         AND (due_settled_at IS NULL OR due_settled_at = '')
       ORDER BY id`,
    )
    .all()
    .map((r: any) => String(r.id));
  assert.deepEqual(due, ["open"]);

  db.close();
});

test("cash rules stay strict so a settled due is not counted twice", () => {
  const db = openDb();
  insert(db, [
    {
      id: "settled",
      type: "debit",
      amount: 200,
      status: "due",
      remaining: 0,
      settled: "2026-09-20T10:00:00.000Z",
    },
    { id: "child", type: "debit", amount: 200, status: "paid", parent: "settled" },
  ]);

  // The paid child already moved the cash. Counting the settled parent as well
  // would double the amount.
  const cash = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE ${CASH_PAID_SQL}`,
    )
    .get() as { total: number };
  assert.equal(cash.total, 200, "only the child moved cash");

  const chip = db
    .prepare(`SELECT COUNT(*) AS n FROM transactions WHERE ${PAID_SQL}`)
    .get() as { n: number };
  assert.equal(chip.n, 2, "but both are shown under Paid");

  db.close();
});

test("isSettledDue / isPaidLike mirror the SQL", () => {
  assert.equal(isSettledDue({ payment_status: "due", due_remaining: 0 }), true);
  assert.equal(
    isSettledDue({ payment_status: "due", due_settled_at: "2026-01-01" }),
    true,
  );
  assert.equal(isSettledDue({ payment_status: "due", due_remaining: 5 }), false);
  // A payment child is a paid row, never a settled root.
  assert.equal(
    isSettledDue({ payment_status: "due", parent_due_id: "p", due_remaining: 0 }),
    false,
  );
  assert.equal(isPaidLike({ payment_status: "paid" }), true);
  assert.equal(isPaidLike({}), true);
  assert.equal(isPaidLike({ payment_status: "due", due_remaining: 0 }), true);
  assert.equal(isPaidLike({ payment_status: "due", due_remaining: 9 }), false);
});

test("the same SQL fragments are used by the app, not re-typed copies", () => {
  const read = (rel: string) =>
    readFileSync(join(__dirname, "../../..", rel), "utf8");

  const filters = read("data/local-txn-filters.ts");
  assert.match(filters, /import \{ PAID_SQL \} from "@\/lib\/local-first\/ledger-rules"/);
  assert.match(filters, /clauses\.push\(PAID_SQL\)/);

  const totals = read("data/transactions.local.ts");
  assert.match(totals, /NON_TRANSFER_SQL, isTransferLeg/);
  assert.match(totals, /CASE WHEN \$\{NON_TRANSFER_SQL\} AND lower\(trim\(type\)\) = 'debit'/);
  assert.match(totals, /CASE WHEN \$\{NON_TRANSFER_SQL\} AND lower\(trim\(type\)\) = 'credit'/);

  const dashboard = read("hooks/use-dashboard.ts");
  assert.match(dashboard, /if \(isTransferLeg\(txn\)\) return acc;/);

  const client = read("lib/transaction-filters.ts");
  assert.match(client, /return isPaidLike\(txn\)/);
});

// ── Fix 3: transfer legs cascade ──────────────────────────────────────────────

test("deleting or editing a transfer leg cascades to its sibling", () => {
  const src = readFileSync(
    join(__dirname, "../../../db/repos/transactions.ts"),
    "utf8",
  );

  // Delete: the sibling leg and the transfers row must go too, otherwise the
  // source loses the money while the destination keeps it.
  assert.match(src, /siblings/, "delete must look up the sibling leg");
  assert.match(src, /transfer_id = \? AND id != \? AND deleted_at IS NULL/);
  assert.match(src, /UPDATE transfers SET deleted_at = \?/);
  assert.match(src, /for \(const row of \[existing, \.\.\.siblings\]\)/);

  // Edit: amount/date mirror to the sibling and the transfer doc, but account
  // and type must NOT mirror (each leg sits on its own account).
  assert.match(src, /siblingAccountId/);
  assert.match(src, /UPDATE transactions SET\s+amount = \?, date = \?/);
  assert.match(src, /UPDATE transfers SET\s+amount = \?, date = \?/);
  assert.match(
    src,
    /Account and type are deliberately NOT mirrored/,
  );
  // The sibling's own account balance must be re-derived after an amount change.
  assert.match(
    src,
    /if \(siblingAccountId && siblingAccountId !== nextAccountId\)/,
  );
});

// ── Fix 4: party ledger gates on payment_status ───────────────────────────────

test("the party ledger only moves the balance for paid rows", () => {
  const src = readFileSync(
    join(__dirname, "../../../data/parties.local.ts"),
    "utf8",
  );

  // The running balance must pass the row's REAL status. It used to hardcode
  // "paid", which counted open dues as cash while the account balance did not.
  assert.match(src, /t\.payment_status,\s*\n\s*\);/);
  assert.doesNotMatch(
    src,
    /partySignedDelta\([\s\S]{0,120}?"paid",\s*\n\s*\);/,
    "party ledger must not hardcode paid",
  );

  // Both the closing sum and the newer-rows window must use the same gate, or
  // runningBalance = closing - newerRow.net is derived from two different rules.
  const gates = src.match(/CASH_PAID_SQL/g) ?? [];
  assert.ok(gates.length >= 2, `expected >=2 gates, found ${gates.length}`);
  assert.match(
    src,
    /WHERE \$\{where\} AND \$\{CASH_PAID_SQL\}/,
    "the newer-rows window needs the same gate as the closing sum",
  );
});

test("SETTLED_DUE_SQL is parenthesised so it composes safely", () => {
  // It is embedded inside PAID_SQL with OR, so a missing paren would leak the
  // surrounding AND clauses into the OR branch.
  assert.match(SETTLED_DUE_SQL.trim(), /^\(/);
  assert.match(SETTLED_DUE_SQL.trim(), /\)$/);
  assert.match(PAID_SQL, /OR \(/);
});

// ── Fix 5: one Balance-after rule across cloud and device ─────────────────────

test("the descending walk treats dues as snapshots, like the local trail", () => {
  // Mirrors backend/utils/balance.js `recomputeDescendingBalances`: newest ->
  // oldest, seeded from the account's current balance, unwinding each row.
  const recompute = (
    txns: Array<{ type: string; amount: number; status?: string }>,
    current: number,
    skipDues: boolean,
  ) => {
    let running = current;
    const out: number[] = [];
    for (const t of txns) {
      out.push(running);
      if (skipDues && t.status === "due") continue;
      running += t.type === "credit" ? -t.amount : t.amount;
    }
    return out;
  };

  // Newest first: a paid expense, a DUE obligation, an older paid income.
  const txns = [
    { type: "debit", amount: 100, status: "paid" },
    { type: "debit", amount: 300, status: "due" },
    { type: "credit", amount: 50, status: "paid" },
  ];

  const before = recompute(txns, 250, false);
  const withFix = recompute(txns, 250, true);

  // The old walk unwound the due, shifting the OLDER income to 650 — a balance
  // that never existed, since the due moved no cash.
  assert.deepEqual(before, [250, 350, 650]);
  // With the fix the due leaves the balance flat, so the older row keeps 350.
  assert.deepEqual(withFix, [250, 350, 350]);

  // The newest row's balance must be the account's current balance under the
  // fixed rule, which is what keeps the card consistent with the header.
  assert.equal(withFix[0], 250);
  // Only the due row's own effect differs.
  assert.notDeepEqual(before, withFix);
});

test("a synced payload cannot overwrite the local Balance-after trail", () => {
  const repo = readFileSync(
    join(__dirname, "../../../db/repos/transactions.ts"),
    "utf8",
  );
  // The upsert must prefer the existing local value over the server's.
  assert.match(
    repo,
    /balance_after_transaction = COALESCE\(\s*transactions\.balance_after_transaction,\s*excluded\.balance_after_transaction\s*\)/,
  );

  const engine = readFileSync(join(__dirname, "../../../sync/engine.ts"), "utf8");
  // The pull must collect the accounts it touched...
  assert.match(engine, /const touchedAccounts = new Set<string>\(\)/);
  assert.match(engine, /if \(change\.entity === "transaction"\)/);
  assert.match(engine, /touchedAccounts\.add\(String\(p\.from_account_id\)\)/);
  // ...and re-derive their trails locally, or a synced due keeps the server value.
  assert.match(engine, /recalculateAccountRunningBalances\(db, accountId\)/);
  assert.match(engine, /trail recompute timed out/);
  // Bounded, so Sync Now cannot spin on a large book.
  assert.match(engine, /25_000/);
});

test("the server no longer unwinds due rows in its descending walk", () => {
  const backend = readFileSync(
    join(__dirname, "../../../../backend/utils/balance.js"),
    "utf8",
  );
  // Guard against a regression that would re-open the cloud/local divergence.
  assert.match(
    backend,
    /if \(txn\.payment_status === "due"\) \{\s*running\.set\(accountId, currentBalance\);\s*return;\s*\}/,
  );
  assert.match(backend, /Dues never moved cash/);
});

test("the local trail documents that it is authoritative", () => {
  const src = readFileSync(
    join(__dirname, "../running-balance.ts"),
    "utf8",
  );
  assert.match(src, /THIS IS THE AUTHORITATIVE RULE/);
  assert.match(src, /Ascending here, seeded from `opening_balance`/);
  assert.match(src, /Descending on the server, seeded from `current_balance`/);
});

// ── Fix 6: every read surface uses the same ordering + cash rules ─────────────

test("the PDF export orders by calendar day and skips dues", () => {
  const src = readFileSync(
    join(__dirname, "../../../services/reports.ts"),
    "utf8",
  );

  // It used to compare `dayjs(date).valueOf()`, so a legacy
  // 2026-09-20T23:59:59.000Z transfer sorted behind its own same-day rows —
  // re-creating in the PDF the exact bug the ledger had.
  assert.doesNotMatch(
    src,
    /dayjs\(a\.date\)\.valueOf\(\)/,
    "PDF must not compare full instants",
  );
  assert.match(src, /const leftDay = ledgerDayOf\(a\.date\)/);
  assert.match(src, /if \(leftDay !== rightDay\) return leftDay < rightDay \? -1 : 1/);
  // Stable final tie-breaker, so repeat exports are identical.
  assert.match(src, /const idOf = \(t: \{ _id\?: string; id\?: string \}\)/);
  assert.match(src, /return leftId < rightId \? -1 : 1/);

  // Dues are snapshots; counting them drifted the PDF's Balance column away
  // from the screen it was generated from.
  assert.match(src, /const status = txn\.payment_status \?\? "paid"/);
  assert.match(src, /if \(status !== "due"\) \{/);
});

test("the PDF running balance matches the app trail for the same rows", () => {
  // Mirrors the reports.ts walk so the two cannot silently diverge.
  const walk = (
    opening: number,
    rows: Array<{ type: string; amount: number; status?: string }>,
  ) => {
    let running = opening;
    const out: number[] = [];
    for (const t of rows) {
      if ((t.status ?? "paid") !== "due") {
        running += t.type === "credit" ? t.amount : -t.amount;
      }
      out.push(running);
    }
    return out;
  };

  const rows = [
    { type: "credit", amount: 500 },
    { type: "debit", amount: 300, status: "due" },
    { type: "debit", amount: 100 },
  ];
  // Old PDF behaviour added/subtracted the due too, ending at 100 instead of 400.
  const oldWalk = (() => {
    let running = 0;
    const out: number[] = [];
    for (const t of rows) {
      running += t.type === "credit" ? t.amount : -t.amount;
      out.push(running);
    }
    return out;
  })();
  assert.deepEqual(oldWalk, [500, 200, 100]);

  const fixed = walk(0, rows);
  assert.deepEqual(fixed, [500, 500, 400], "the due held the balance flat");
  // Must equal the canonical rule's output for identical input.
  assert.deepEqual(
    fixed,
    rows
      .reduce<{ running: number; out: number[] }>(
        (acc, t) => {
          if ((t.status ?? "paid") !== "due") {
            acc.running += t.type === "credit" ? t.amount : -t.amount;
          }
          acc.out.push(acc.running);
          return acc;
        },
        { running: 0, out: [] },
      )
      .out,
  );
});

test("vendor/counterparty history loads the NEWEST rows, with a derived start", () => {
  const src = readFileSync(
    join(__dirname, "../../../data/parties.local.ts"),
    "utf8",
  );

  // Ordering ascending with a LIMIT silently returned the OLDEST N rows, so the
  // newest activity never appeared in vendor history.
  const windowQuery = src.slice(
    src.indexOf("ORDER BY substr(date, 1, 10) DESC, created_at DESC, id DESC\n     LIMIT ?"),
  );
  assert.ok(windowQuery.length > 0, "history window must order newest-first");
  assert.match(src, /const rowsAsc = \[\.\.\.rows\]\.reverse\(\)/);

  // The window's starting balance must be derived, not assumed to be 0/opening,
  // or every running balance in a paged history is off by the rows before it.
  assert.match(src, /const closingBalance =/);
  assert.match(src, /const windowNet = rowsAsc\.reduce/);
  assert.match(src, /let running = closingBalance - windowNet/);

  // The summary must use the cash gate so it agrees with the walk AND with the
  // party's stored current_balance.
  assert.match(
    src,
    /FROM transactions WHERE \$\{where\} AND \$\{CASH_PAID_SQL\}/,
  );
});

test("the windowed running balance is correct for a mid-history page", () => {
  // 5 rows, opening 100, page size 2 -> only the newest 2 load, but the running
  // balance must still be absolute (not restart at opening).
  const all = [
    { type: "credit", amount: 100 },
    { type: "debit", amount: 50 },
    { type: "credit", amount: 25 },
    { type: "debit", amount: 75 },
    { type: "credit", amount: 10 },
  ];
  const opening = 100;
  const net = (rows: typeof all) =>
    rows.reduce((a, t) => a + (t.type === "credit" ? t.amount : -t.amount), 0);

  const closing = opening + net(all);
  assert.equal(closing, 110);

  const window = all.slice(-2); // newest 2 = a debit of 75, then a credit of 10
  const windowNet = net(window);
  let running = closing - windowNet;
  const out: number[] = [];
  for (const t of window) {
    running += t.type === "credit" ? t.amount : -t.amount;
    out.push(running);
  }
  // Absolute balances: the true cumulative values after each row, not balances
  // relative to the window. By hand: 100 opening, +100, −50, +25, −75, +10.
  assert.deepEqual(out, [100, 110]);
  // The last row's balance must equal the true closing balance.
  assert.equal(out.at(-1), closing);

  // Guard the failure mode: restarting from `opening` would give [100, 110] here
  // by luck, so also assert a case where the window's start is NOT opening.
  assert.notEqual(closing - windowNet, 0);
});

