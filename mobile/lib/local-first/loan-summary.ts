import type { Db } from "@/db/client";
import type { Transaction } from "@/services/transactions";

type LoanSummary = NonNullable<Transaction["loan_summary"]>;

const LOAN_TYPES = new Set(["loan_in", "loan_out"]);

function partyId(t: Transaction): string | null {
  const p = t.party;
  if (!p) return null;
  return typeof p === "string" ? p : p._id ? String(p._id) : null;
}

function forPartyId(t: Transaction): string | null {
  const p = t.for_party;
  if (!p) return null;
  return typeof p === "string" ? p : p._id ? String(p._id) : null;
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

function isLoanTxn(t: Transaction): boolean {
  const type = t.category?.type;
  if (!type || !LOAN_TYPES.has(type)) return false;
  return Boolean(partyId(t) || forPartyId(t) || t.counterparty?.trim());
}

function emptySummary(): LoanSummary {
  return {
    total_borrowed: 0,
    total_repaid: 0,
    total_given: 0,
    total_received_back: 0,
    outstanding: 0,
    net_owed_by_me: 0,
    owed_by_me: 0,
    owed_by_them: 0,
    transaction_count: 0,
    is_settled: true,
  };
}

/** Sub-cent residue from float math must not read as an open loan. */
const SETTLED_EPSILON = 0.005;

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Port of backend calculateLoanLedger summary (pair/solo/legacy).
 *
 * Classification is driven by category type + cash direction, which is the
 * canonical pairing enforced by the repair rules:
 *   loan_out + debit  → lent out          (they owe me)
 *   loan_out + credit → repayment in      (they owe me less)
 *   loan_in  + credit → borrowed          (I owe them)
 *   loan_in  + debit  → repayment out     (I owe them less)
 * Matching on English category names would misread renamed or translated
 * categories, so names are never consulted here.
 */
function summarizeLedger(txns: Transaction[]): LoanSummary {
  let owedByMe = 0;
  let owedByThem = 0;
  let totalBorrowed = 0;
  let totalRepaid = 0;
  let totalGiven = 0;
  let totalReceivedBack = 0;

  const sorted = [...txns].sort((a, b) => {
    const da = String(a.date);
    const db = String(b.date);
    if (da !== db) return da < db ? -1 : 1;
    return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
  });

  for (const transaction of sorted) {
    const categoryType = transaction.category?.type ?? "";
    const amount = Number(transaction.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const isIncoming = transaction.type === "credit";

    if (categoryType === "loan_in") {
      if (isIncoming) {
        owedByMe += amount;
        totalBorrowed += amount;
      } else {
        totalRepaid += amount;
        owedByMe = Math.max(0, owedByMe - amount);
      }
    } else {
      if (isIncoming) {
        totalReceivedBack += amount;
        owedByThem = Math.max(0, owedByThem - amount);
      } else {
        owedByThem += amount;
        totalGiven += amount;
      }
    }
  }

  owedByMe = round2(owedByMe);
  owedByThem = round2(owedByThem);

  return {
    total_borrowed: round2(totalBorrowed),
    total_repaid: round2(totalRepaid),
    total_given: round2(totalGiven),
    total_received_back: round2(totalReceivedBack),
    outstanding: round2(owedByMe + owedByThem),
    net_owed_by_me: round2(owedByMe - owedByThem),
    owed_by_me: owedByMe,
    owed_by_them: owedByThem,
    transaction_count: sorted.length,
    is_settled: owedByMe < SETTLED_EPSILON && owedByThem < SETTLED_EPSILON,
  };
}

/**
 * Attach loan_summary like the cloud list API so Loan Given/Received chips
 * and card badges work offline.
 */
export async function decorateLocalLoanSummaries(
  db: Db,
  transactions: Transaction[],
): Promise<Transaction[]> {
  if (!transactions.length) return transactions;
  const loanOnPage = transactions.filter(isLoanTxn);
  if (!loanOnPage.length) return transactions;

  const loanCats = await db.getAllAsync<{
    id: string;
    server_id: string | null;
    name: string;
    type: string;
  }>(
    `SELECT id, server_id, name, type FROM categories
     WHERE deleted_at IS NULL AND type IN ('loan_in','loan_out')`,
  );
  if (!loanCats.length) return transactions;

  const catIds = new Set<string>();
  for (const c of loanCats) {
    catIds.add(c.id);
    if (c.server_id) catIds.add(c.server_id);
  }
  const catIdList = [...catIds];
  const placeholders = catIdList.map(() => "?").join(",");

  const partyIds = [
    ...new Set(
      loanOnPage.flatMap((t) => [partyId(t), forPartyId(t)].filter(Boolean)),
    ),
  ] as string[];
  const legacyCps = [
    ...new Set(
      loanOnPage
        .filter((t) => !partyId(t))
        .map((t) => t.counterparty?.trim())
        .filter(Boolean),
    ),
  ] as string[];

  if (!partyIds.length && !legacyCps.length) return transactions;

  const orParts: string[] = [];
  const params: (string | number | null)[] = [...catIdList];
  if (partyIds.length) {
    const pp = partyIds.map(() => "?").join(",");
    orParts.push(`party_id IN (${pp})`);
    orParts.push(
      `party_id IN (SELECT id FROM parties WHERE server_id IN (${pp}))`,
    );
    orParts.push(`for_party_id IN (${pp})`);
    orParts.push(
      `for_party_id IN (SELECT id FROM parties WHERE server_id IN (${pp}))`,
    );
    params.push(...partyIds, ...partyIds, ...partyIds, ...partyIds);
  }
  if (legacyCps.length) {
    const cp = legacyCps.map(() => "?").join(",");
    orParts.push(`(party_id IS NULL AND counterparty IN (${cp}))`);
    params.push(...legacyCps);
  }

  const rows = await db.getAllAsync<{
    id: string;
    type: string;
    amount: number;
    date: string;
    created_at: string;
    category_id: string | null;
    party_id: string | null;
    for_party_id: string | null;
    counterparty: string | null;
  }>(
    `SELECT id, type, amount, date, created_at, category_id, party_id, for_party_id, counterparty
     FROM transactions
     WHERE deleted_at IS NULL
       AND category_id IN (${placeholders})
       AND (${orParts.join(" OR ")})
     ORDER BY date ASC, created_at ASC`,
    ...params,
  );

  const catById = new Map(loanCats.map((c) => [c.id, c]));
  for (const c of loanCats) {
    if (c.server_id) catById.set(c.server_id, c);
  }

  const asTxn = (r: (typeof rows)[0]): Transaction => {
    const cat = r.category_id ? catById.get(r.category_id) : null;
    return {
      _id: r.id,
      account: { _id: "", name: "" },
      type: r.type as "debit" | "credit",
      amount: Number(r.amount),
      date: r.date,
      createdAt: r.created_at,
      counterparty: r.counterparty ?? undefined,
      category: cat
        ? { _id: cat.id, name: cat.name, type: cat.type }
        : null,
      party: r.party_id ? { _id: r.party_id, name: "", type: "customer" } : null,
      for_party: r.for_party_id
        ? { _id: r.for_party_id, name: "", type: "customer" }
        : null,
    };
  };

  const ledger = rows.map(asTxn);
  const summaries = new Map<string, LoanSummary>();

  const ensure = (key: string, pick: (t: Transaction) => boolean) => {
    if (summaries.has(key)) return;
    summaries.set(key, summarizeLedger(ledger.filter(pick)));
  };

  for (const t of loanOnPage) {
    const pid = partyId(t);
    const fpid = forPartyId(t);
    if (pid && fpid) {
      const key = pairKey(pid, fpid);
      ensure(
        key,
        (lt) => {
          const lp = partyId(lt);
          const lfp = forPartyId(lt);
          return (
            (lp === pid && lfp === fpid) || (lp === fpid && lfp === pid)
          );
        },
      );
    } else if (pid) {
      ensure(pid, (lt) => partyId(lt) === pid && !forPartyId(lt));
    } else {
      const cp = t.counterparty?.trim();
      if (cp) {
        ensure(
          cp,
          (lt) => !partyId(lt) && (lt.counterparty?.trim() ?? "") === cp,
        );
      }
    }
  }

  return transactions.map((t) => {
    if (!isLoanTxn(t)) return t;
    const pid = partyId(t);
    const fpid = forPartyId(t);
    let key: string | null = null;
    if (pid && fpid) key = pairKey(pid, fpid);
    else if (pid) key = pid;
    else key = t.counterparty?.trim() || null;
    const summary = key ? summaries.get(key) : undefined;
    return summary ? { ...t, loan_summary: summary } : { ...t, loan_summary: emptySummary() };
  });
}
