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

  // Map any party id (local UUID or Mongo server_id) → canonical local id.
  const parties = await db.getAllAsync<{
    id: string;
    server_id: string | null;
  }>(`SELECT id, server_id FROM parties WHERE deleted_at IS NULL`);
  const canonicalPartyId = new Map<string, string>();
  for (const p of parties) {
    canonicalPartyId.set(p.id, p.id);
    if (p.server_id) canonicalPartyId.set(p.server_id, p.id);
  }
  const canon = (id: string | null | undefined) =>
    id ? (canonicalPartyId.get(id) ?? id) : null;

  const partyIds = [
    ...new Set(
      loanOnPage
        .flatMap((t) => [canon(partyId(t)), canon(forPartyId(t))])
        .filter(Boolean),
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
    orParts.push(
      `party_id IN (SELECT server_id FROM parties WHERE id IN (${pp}) AND server_id IS NOT NULL)`,
    );
    orParts.push(`for_party_id IN (${pp})`);
    orParts.push(
      `for_party_id IN (SELECT id FROM parties WHERE server_id IN (${pp}))`,
    );
    orParts.push(
      `for_party_id IN (SELECT server_id FROM parties WHERE id IN (${pp}) AND server_id IS NOT NULL)`,
    );
    params.push(
      ...partyIds,
      ...partyIds,
      ...partyIds,
      ...partyIds,
      ...partyIds,
      ...partyIds,
    );
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
    const pid = canon(r.party_id);
    const fpid = canon(r.for_party_id);
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
      party: pid ? { _id: pid, name: "", type: "customer" } : null,
      for_party: fpid ? { _id: fpid, name: "", type: "customer" } : null,
    };
  };

  const ledger = rows.map(asTxn);
  const summaries = new Map<string, LoanSummary>();

  const ensure = (key: string, pick: (t: Transaction) => boolean) => {
    if (summaries.has(key)) return;
    summaries.set(key, summarizeLedger(ledger.filter(pick)));
  };

  for (const t of loanOnPage) {
    const pid = canon(partyId(t));
    const fpid = canon(forPartyId(t));
    if (pid && fpid) {
      const key = pairKey(pid, fpid);
      ensure(key, (lt) => {
        const lp = partyId(lt);
        const lfp = forPartyId(lt);
        return (lp === pid && lfp === fpid) || (lp === fpid && lfp === pid);
      });
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
    const pid = canon(partyId(t));
    const fpid = canon(forPartyId(t));
    let key: string | null = null;
    if (pid && fpid) key = pairKey(pid, fpid);
    else if (pid) key = pid;
    else key = t.counterparty?.trim() || null;
    const summary = key ? summaries.get(key) : undefined;
    return summary
      ? { ...t, loan_summary: summary }
      : { ...t, loan_summary: emptySummary() };
  });
}

/**
 * Full loan ledger for History sheet (local-first). Mirrors cloud
 * `/transactions/counterparty-ledger`.
 */
export async function fetchLocalCounterpartyLedger(params: {
  partyId?: string;
  forPartyId?: string;
  counterparty?: string;
}): Promise<{
  counterparty: string;
  timeline: Array<
    Transaction & {
      entry_type: "borrow" | "repayment" | "loan_given" | "loan_received_back";
      running_balance: number;
    }
  >;
  summary: LoanSummary;
}> {
  const { getDb } = await import("@/db/client");
  const db = await getDb();

  const loanCats = await db.getAllAsync<{
    id: string;
    server_id: string | null;
    name: string;
    type: string;
  }>(
    `SELECT id, server_id, name, type FROM categories
     WHERE deleted_at IS NULL AND type IN ('loan_in','loan_out')`,
  );
  if (!loanCats.length) {
    return {
      counterparty: params.forPartyId ?? params.partyId ?? params.counterparty ?? "",
      timeline: [],
      summary: emptySummary(),
    };
  }

  const catIds = new Set<string>();
  for (const c of loanCats) {
    catIds.add(c.id);
    if (c.server_id) catIds.add(c.server_id);
  }
  const catIdList = [...catIds];
  const placeholders = catIdList.map(() => "?").join(",");

  const parties = await db.getAllAsync<{
    id: string;
    server_id: string | null;
    name: string;
  }>(`SELECT id, server_id, name FROM parties WHERE deleted_at IS NULL`);
  const canonicalPartyId = new Map<string, string>();
  const partyNameByCanon = new Map<string, string>();
  for (const p of parties) {
    canonicalPartyId.set(p.id, p.id);
    if (p.server_id) canonicalPartyId.set(p.server_id, p.id);
    partyNameByCanon.set(p.id, p.name);
  }
  const canon = (id: string | null | undefined) =>
    id ? (canonicalPartyId.get(id) ?? id) : null;

  const pid = canon(params.partyId);
  const fpid = canon(params.forPartyId);
  const cp = params.counterparty?.trim() || "";

  const orParts: string[] = [];
  const bind: (string | number)[] = [...catIdList];

  const pushPartyMatch = (id: string) => {
    orParts.push(`party_id = ? OR party_id = ?`);
    orParts.push(`for_party_id = ? OR for_party_id = ?`);
    const server =
      parties.find((p) => p.id === id)?.server_id || id;
    bind.push(id, server, id, server);
  };

  if (pid && fpid) {
    // Pair either direction (same as cloud), plus either party alone so
    // repayments that only tag one side still appear.
    orParts.push(
      `(party_id IN (?, ?) AND for_party_id IN (?, ?))`,
      `(party_id IN (?, ?) AND for_party_id IN (?, ?))`,
    );
    const pServer = parties.find((p) => p.id === pid)?.server_id || pid;
    const fServer = parties.find((p) => p.id === fpid)?.server_id || fpid;
    bind.push(pid, pServer, fpid, fServer, fpid, fServer, pid, pServer);
    pushPartyMatch(fpid);
    pushPartyMatch(pid);
  } else if (pid) {
    pushPartyMatch(pid);
  } else if (fpid) {
    pushPartyMatch(fpid);
  } else if (cp) {
    orParts.push(`(party_id IS NULL AND counterparty = ?)`);
    bind.push(cp);
  } else {
    return {
      counterparty: "",
      timeline: [],
      summary: emptySummary(),
    };
  }

  const rows = await db.getAllAsync<{
    id: string;
    type: string;
    amount: number;
    date: string;
    created_at: string;
    description: string | null;
    category_id: string | null;
    party_id: string | null;
    for_party_id: string | null;
    counterparty: string | null;
    account_id: string;
  }>(
    `SELECT id, type, amount, date, created_at, description, category_id,
            party_id, for_party_id, counterparty, account_id
     FROM transactions
     WHERE deleted_at IS NULL
       AND category_id IN (${placeholders})
       AND (${orParts.join(" OR ")})
     ORDER BY date ASC, created_at ASC, id ASC`,
    ...bind,
  );

  // When both parties provided, keep pair + txs involving the "other"
  // party (for_party preferred) — mirrors useful Full Ledger for borrower.
  let filtered = rows;
  if (pid && fpid) {
    filtered = rows.filter((r) => {
      const lp = canon(r.party_id);
      const lfp = canon(r.for_party_id);
      const isPair =
        (lp === pid && lfp === fpid) || (lp === fpid && lfp === pid);
      const involvesOther = lp === fpid || lfp === fpid;
      return isPair || involvesOther;
    });
  }

  const catById = new Map(loanCats.map((c) => [c.id, c]));
  for (const c of loanCats) {
    if (c.server_id) catById.set(c.server_id, c);
  }

  const asTxn = (r: (typeof rows)[0]): Transaction => {
    const cat = r.category_id ? catById.get(r.category_id) : null;
    const lp = canon(r.party_id);
    const lfp = canon(r.for_party_id);
    return {
      _id: r.id,
      account: { _id: r.account_id, name: "" },
      type: r.type as "debit" | "credit",
      amount: Number(r.amount),
      date: r.date,
      createdAt: r.created_at,
      description: r.description ?? undefined,
      counterparty: r.counterparty ?? undefined,
      category: cat
        ? { _id: cat.id, name: cat.name, type: cat.type }
        : null,
      party: lp
        ? {
            _id: lp,
            name: partyNameByCanon.get(lp) ?? "",
            type: "customer",
          }
        : null,
      for_party: lfp
        ? {
            _id: lfp,
            name: partyNameByCanon.get(lfp) ?? "",
            type: "customer",
          }
        : null,
    };
  };

  const ledgerTxns = filtered.map(asTxn);
  const summary = summarizeLedger(ledgerTxns);

  // Build timeline with entry_type + running balance (owed_by_them - owed_by_me)
  let owedByMe = 0;
  let owedByThem = 0;
  const timelineAsc = ledgerTxns.map((transaction) => {
    const categoryType = transaction.category?.type ?? "";
    const amount = Number(transaction.amount ?? 0);
    const isIncoming = transaction.type === "credit";
    let entry_type: "borrow" | "repayment" | "loan_given" | "loan_received_back";

    if (categoryType === "loan_in") {
      if (isIncoming) {
        owedByMe += amount;
        entry_type = "borrow";
      } else {
        owedByMe = Math.max(0, owedByMe - amount);
        entry_type = "repayment";
      }
    } else if (isIncoming) {
      owedByThem = Math.max(0, owedByThem - amount);
      entry_type = "loan_received_back";
    } else {
      owedByThem += amount;
      entry_type = "loan_given";
    }

    return {
      ...transaction,
      entry_type,
      running_balance: round2(owedByThem - owedByMe),
    };
  });

  const displayId = fpid || pid || cp;
  return {
    counterparty:
      (displayId && partyNameByCanon.get(displayId)) || cp || displayId || "",
    timeline: [...timelineAsc].reverse(),
    summary,
  };
}
