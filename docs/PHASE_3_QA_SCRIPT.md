# Shop Local-First — Device QA Script

**Covers:** Phase 2 (products), Phase 3 (barcode), Phase 4 (inventory movements), Phase 5 (offline purchase/invoices), Phase 7 (party ledger signs)
**Branch:** `feat/local-first-sync`
**Written:** 2026-09-12
**Companion doc:** [`PHASE_1_AUDIT_ADDENDUM.md`](./PHASE_1_AUDIT_ADDENDUM.md) (§12–§16 record what shipped)

> This is a manual QA script. There is no automated device test yet; the automated suite is `mobile/npm run test:local-first` (pure functions only).

---

## 0. Pre-flight (read this first)

### 0.1 You need a Debug dev-client build — a Release build cannot test code changes

A Release / internal-distribution build (EAS `preview`, `production`, or `eas build --profile simulator`) bakes the JS bundle and `EXPO_PUBLIC_*` values in at build time. It never talks to Metro, so it will **never** show local changes. A `Release` build that "works fine on the phone" is running old code.

### 0.2 The `exp+hisab-boi://` CommandError

Symptom:

```
CommandError: Device iPhone 16 Plus (447BE35C-…) has no app to handle the URI:
exp+hisab-boi://expo-development-client/?url=http%3A%2F%2F192.168.0.249%3A8081
```

Two independent causes, both diagnosed 2026-09-12:

1. **Wrong target.** Metro pressed `i` opened the booted **iOS Simulator** named "iPhone 16 Plus", not the physical iPhone. Confirm with `xcrun simctl list devices | grep -i booted`.
2. **Stale installed app.** The simulator's installed `HisabBoi.app` was a debug build (`EXDevLauncher.bundle` present, no `main.jsbundle`) but its `Info.plist` registered only `hisab-boi` — **not** `exp+hisab-boi`, so iOS had nothing to handle the dev-client URL.

The current project is correct — verified without writing files:

```bash
npx expo config --type introspect --json   # final schemes include exp+hisab-boi
plutil -extract CFBundleURLTypes json -o - ios/HisabBoi/Info.plist
```

A rebuild fixes it.

### 0.3 Build commands

```bash
cd cash-book/mobile

# Physical iPhone (recommended for QA) — installs a Debug dev-client over the release build
npx expo run:ios --device

# Simulator (faster iteration)
npx expo run:ios
```

- Stop any already-running Metro first (`Ctrl+C`) so the build owns port 8081 with a clean cache.
- Phone and Mac must be on the same Wi-Fi (Metro serves at the LAN IP, e.g. `192.168.0.249:8081`).
- `--device` replaces the release app on the phone (same bundle id `com.alamgir.hisabboi`). To keep both, the dev build needs its own bundle id.
- EAS alternative for the phone: `eas build --profile development --platform ios --device` (`eas.json` already sets `buildConfiguration: "Debug"`).

### 0.4 First launch on a device that already has the app

Because the bundle id is unchanged, the existing SQLite container **persists** and is upgraded in place:

- `user_version` **v2 → v4** (migrations `003_shop`, `004_invoices` run against real data).
- Ledger repair **v8 → v9** fires on the first Home/Accounts load (Phase 7 party convention).
- **If the app redboxes or fails to open the DB on first launch, that is migration trouble — capture the error before retrying.** Recovery: delete the app, reinstall, then Migrate from cloud.

### 0.5 You must re-seed once (products/invoices start empty)

The new tables are empty even though the rest of the ledger is populated. Tap:

**Settings → "Migrate from cloud" → confirm "Re-download from cloud?"**

If you skip this, `Shop → Products` looks broken when it is not.

Watch the Metro / Xcode console for non-fatal seed skips (expected if the server holds duplicate barcodes, since the backend barcode index is not unique):

```
[migrate] skipped product (duplicate barcode?) …
[migrate] skipped invoice …
```

---

## 1. Known limitations — do NOT file these as bugs

- Products / invoices / stock rows are created locally but **do not sync to the server yet** (shop sync is Phase 13). The sync badge counts ledger pending only, so shop rows will sit local.
- Server stock only moves for products that exist on the server (migrated ones). A product created offline does not affect server stock.
- A credit invoice's unpaid balance lives on the invoice (`balance_due` + status), **not** on the party's balance card. Only *payments* post to the party ledger.
- "Backup Now" does not yet include shop entities (products/invoices/movements) — Phase 14.
- Local invoice numbers can differ from server numbers until Phase 13 reconciles.
- Supplier party balances may legitimately **change** on first load after repair v9 (they converge to the server convention). Customer balances should not change.
- Full offline invoice **edit** and **returns/credit notes** are Phase 8.

---

## 2. Ten-minute smoke (if you are short on time)

Do only: **3, 5, 7, 9, 15, 24, 28, 33, 35.**
If those pass, the core of Phases 2–7 is working.

---

## 3. Section A — ledger regression (must not break)

- [ ] **1.** Add income to a cash account + category → saves instantly, account balance increases.
- [ ] **2.** Add an expense → balance decreases. Transfer between two accounts → both update.
- [ ] **3.** Parties → create a customer → open ledger → add a party-linked transaction → running balance updates correctly.
- [ ] **4.** **Airplane mode:** repeat 1–3 → all work; pending indicator appears.
- [ ] **5.** Re-enable network → **Sync now** → no duplicates, balances unchanged. Reopen the app → data persists.

## 4. Section B — products (offline CRUD + cost basis)

- [ ] **6.** Shop → Products → migrated products visible (list not empty).
- [ ] **7.** Create product: purchase 100, additional cost 20, sale 150, opening stock 10, unit pcs → saves instantly, appears in list.
- [ ] **8.** Reopen it → **Cost Price = 120** and Additional Cost = 20 shown.
- [ ] **9.** Edit additional cost → 30 → Cost Price becomes 130.
- [ ] **10.** Duplicate barcode → error "Barcode already used by …".
- [ ] **11.** Partial-name search filters instantly. Set low-stock threshold above current stock → appears under **Low Stock**.
- [ ] **12.** **Airplane mode:** create / edit / delete a product → all work.

## 5. Section C — barcode + scan → qty merge

- [ ] **13.** Product create → tap barcode scan → camera opens → scan fills the field.
- [ ] **14.** *Cannot be verified statically.* If the camera never opens or no permission prompt appears, record exact behavior + device OS.
- [ ] **15.** Invoice → Create (sale) → line item → **Scan** a barcode matching a local product → name/price/tax fill. **Scan it again** → quantity increments on the **same** line (1 → 2), no duplicate row.
- [ ] **16.** Scan an **unknown** barcode with network on → description fills (Open\*Facts org or the raw code) + "Not in catalog — save as new product" banner appears.
- [ ] **17.** Tap the banner → New Product sheet → name/price/unit → **Create & Add to Invoice** → line links to the new product.
- [ ] **18.** **Airplane mode:** scan a known local product → still attaches and merges.
- [ ] **19.** Create a product with **no barcode** → saves fine (barcode optional).

## 6. Section D — inventory movements

- [ ] **20.** Product detail → **Adjust Stock +5** → stock increases; history shows "adjustment in" with **After** = new stock.
- [ ] **21.** Adjust **−100** on a 10-stock tracked product → error "Insufficient stock for this movement", no change.
- [ ] **22.** **Airplane mode:** adjust stock → works, movement listed.
- [ ] **23.** Restart the app → stock equals the last movement (no reconcile drift).

## 7. Section E — offline purchase + invoices

- [ ] **24.** Create a **purchase invoice**: supplier party, two lines added via **Product** search (so they link), quantities + prices, payment mode **Due** → save.
- [ ] **25.** List shows status **Pending** with `balance_due = grand_total`.
- [ ] **26.** Purchased products' stock **increased**; history shows a **purchase** movement referencing the invoice.
- [ ] **27.** Open the invoice → items and totals correct.
- [ ] **28.** **Record a partial payment** with an account → `balance_due` drops, status **Partial**, and the chosen **account balance changes** by the paid amount.
- [ ] **29.** Record the remaining payment → status **Paid**.
- [ ] **30.** **Airplane mode:** create another purchase + partial payment → all work offline.
- [ ] **31.** **Credit sale smoke:** sale invoice for a product with stock → stock decreases; a sale exceeding stock is rejected.
- [ ] **32.** **PDF** the invoice → renders offline with correct totals.

## 8. Section F — party ledger signs (Phase 7)

- [ ] **33.** Note a **supplier** balance → record a purchase payment with an account → reopen the supplier ledger → the payment appears and the balance moves in the supplier direction.
- [ ] **34.** A **customer** sale payment moves their balance in the customer direction.
- [ ] **35.** **Upgrade check:** if this device already had supplier balances, the first load runs repair v9 → supplier balances may change. Confirm they now **match the cloud UI**, not the old local value.
- [ ] **36.** Supplier ledger totals/net no longer use the old credit-positive sign.

## 9. Section G — offline / sync safety

- [ ] **37.** Ledger transactions push/pull on reconnect with no duplicates; shop rows stay local (expected).
- [ ] **38.** Fresh install → **Migrate from cloud** → products **and** invoices are seeded.

---

## 10. Failure report template

Copy this per failure:

```
Item #:
Screen + exact action:
Expected:
Actual:
State: online / airplane mode
Redbox or console error (verbatim):
Settings → sync "last error" text:
Device + OS (and simulator vs physical):
```

For camera failures, always include device model + OS and whether the permission prompt appeared.

---

## 11. Automated checks to run alongside QA

```bash
cd cash-book/mobile
npm run test:local-first     # expect 25/25 pass
npx tsc --noEmit             # expect 37 pre-existing errors, none in app/runtime files
```

`tsc` caveat: the count includes known-benign errors in unrelated files (`absoluteFillObject`, react-hook-form duplicate-type in `invoices/create.tsx`, `lib/api.ts` manifest props, node types in the test file). Compare against a clean baseline rather than expecting zero.
