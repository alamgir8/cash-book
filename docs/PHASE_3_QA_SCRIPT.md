# Shop Local-First — Device QA Script

**Covers:** Phase 2 (products), Phase 3 (barcode), Phase 4 (inventory movements), Phase 5 (offline purchase/invoices), Phase 7 (party ledger signs)
**Branch:** `feat/local-first-sync`
**Written:** 2026-09-12
**Companion doc:** [`PHASE_1_AUDIT_ADDENDUM.md`](./PHASE_1_AUDIT_ADDENDUM.md) (§12–§16 record what shipped)

> This is a manual QA script. There is no automated device test yet; the automated suite is `mobile/npm run test:local-first` (pure functions only).

---

## 0. Pre-flight (read this first)

### 0.0 CRITICAL — the API URL protocol bug (found 2026-09-12)

**Everything backend-dependent was failing because of one character.** The local
backend serves **plain HTTP** on port 5050, but `mobile/.env.local` was set to
**`https://`**. There is no TLS listener, so every request died with
"Network Error".

Verified with `curl`:

```
http://192.168.0.249:5050/health   -> 200
https://192.168.0.249:5050/health  -> connection failed
```

This single issue explains all of these symptoms:

- `Failed to load organizations on startup: [AxiosError: Network Error]`
- `[reconcile] personal cloud fetch failed`
- `[sync] Cannot reach API at https://192.168.0.249:5050/api`
- "Migrate from cloud" never completing

**Fixed** — `.env.local` now uses `http://192.168.0.249:5050/api`. After any
`.env.local` change you must restart Metro with `--clear` (env vars are inlined at
bundle time):

```bash
npx expo start --dev-client --clear
```

If your Mac's IP changes, run `ipconfig getifaddr en0` and update it. Phone and
Mac must be on the same Wi‑Fi.

### 0.0b Restart the backend

The backend currently running on 5050 was started as `node api/index.js`
(**not** nodemon), so it is running pre-Phase-13 code. Restart it to pick up the
new shop sync entities:

```bash
cd cash-book/backend && npm start    # or: npm run dev (nodemon, auto-reload)
```

Without this restart the client will push `product`/`invoice`/`stock_movement`
changes and the server will reject them as an unsupported entity.

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

- ~~Products / invoices / stock rows do not sync yet~~ — **Phase 13 landed**: they push/pull and the badge counts them. Verify in Section H.
- ~~Server stock only moves for server products~~ — server stock now follows the pushed `stock_movement` rows. During sync, check it moves **once**, not twice (item 44).
- A credit invoice's unpaid balance lives on the invoice (`balance_due` + status), **not** on the party's balance card. Only *payments* post to the party ledger.
- "Backup Now" still does **not** include shop entities — Phase 14. Sync protects them; backup does not yet.
- Local invoice numbers can differ from server numbers; a collision is resolved server-side with a short suffix (item 47).
- Supplier party balances may legitimately **change** on first load after repair v9 (they converge to the server convention). Customer balances should not change.
- Full offline invoice **edit** and **returns/credit notes** are Phase 8.
- **Voice on the phone needs one rebuild** (free `expo-speech-recognition`). Typing the same phrase works today — Section I tests via typing.
- Zod validation **messages** are Bangla, but server/network error text comes from the backend and stays English.

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

## 10. Section H — Shop SYNC (Phase 13, new)

Do this after Section B so there are products to sync. Watch Metro logs for
`[sync]` warnings.

- [ ] **39.** Restart the backend, then in the app **Settings → Sync now** → no "Cannot reach API" error.
- [ ] **40.** Create a product offline (airplane mode) → sync badge shows pending work. Reconnect → **Sync now** → badge clears.
- [ ] **41.** Confirm the product reached the server: refresh `GET /products` (or look in Mongo `products`) → the row is there with `current_stock`, `purchase_price`, `additional_cost`, `cost_price`.
- [ ] **42.** **Idempotency:** with a product still pending, tap **Sync now** twice in a row → the server has **exactly one** product, not two.
- [ ] **43.** Create a purchase invoice offline → reconnect → sync → the server has **one** invoice with its items, and `unit_cost_at_sale` is populated on sale lines.
- [ ] **44.** **No double-counting (important):** after syncing a sale, the server product's `current_stock` must change by the **movement quantity once**, not twice. Compare `GET /products/:id` before/after.
- [ ] **45.** Check `stock_movements` in Mongo → one movement per business event (no duplicates after repeated syncs).
- [ ] **46.** Two-device check (optional): second device with the same account → **Migrate from cloud** → products/invoices appear.
- [ ] **47.** Invoice number collision: create an offline invoice whose number matches an existing server one → sync succeeds (server appends a short suffix) instead of the push failing.
- [ ] **48.** **Logout safety:** log out → sign in as a *different* account → Shop shows **no** products/invoices from the previous account.

## 11. Section I — Voice / natural-language entry

The bar is on **Shop → New Sale (POS)** and **Shop → Products → Add Product**.
**Requires a dev-client rebuild** (`expo run:ios --device`) so the native speech
module is present — Expo Go cannot run it. Typing works in both cases.

- [ ] **48a.** The mic shows as **active** (not muted). If it is muted, the module
      is missing → you are on an old build, or in Expo Go.
- [ ] **48b.** Tap the mic → the OS asks for microphone **and** speech-recognition
      permission → grant both.
- [ ] **48c.** Say `সাবান দুইটা পঁয়তাল্লিশ টাকা` in Bangla → the transcript appears
      in the field as **Bangla** (not English).
- [ ] **49.** In POS, type exactly: `Lux সাবান/সাবান ২টা ৪৫টাকা করে` → preview reads name **Lux সাবান/সাবান**, qty **2**, price **45**. Tap add → one cart line, qty 2, unit price 45.
- [ ] **50.** Type `২ কেজি চাল ৮০ টাকা` → qty 2, unit **kg**, price 80.
- [ ] **51.** Type `৫০০ গ্রাম চিনি ৬০ টাকা` → unit **g**, qty 500.
- [ ] **52.** Type `সাবান ২টা ৩৫ টাকা করে ৪৫ টাকা বিক্রয়` → cost 35 **and** sale 45 shown.
- [ ] **53.** Type two items in one line: `২টা সাবান ৪৫ করে আর ১ কেজি চাল ৮০ টাকা` → **two** preview rows → both added.
- [ ] **54.** Type a catalog product's name → it shows **existing** (matched) and a suggestion chip appears; tap the chip → added to cart without re-typing.
- [ ] **55.** In **Add Product**, type `লাক্স সাবান ২টা ৪৫ টাকা` → the form fills name, sale price 45, opening stock 2, unit pcs.
- [ ] **56.** Type `সাড়ে তিন কেজি চাল ৮০ টাকা` → qty **3.5** kg (not 3).
- [ ] **57.** Sale line shows **profit** when the product has a cost price. Sell below cost → the number goes negative (a loss).
- [ ] **58.** Say several items in one breath with commas → each becomes its own cart line.

### 11.1 If Bangla voice comes out as English

Two separate mics — check which you are using:

- [ ] **58a.** **In-app mic** (our button): should be Bangla. If a warning says
      Bangla voice is not installed, add it on the phone:
      **iOS** → Settings → General → Keyboard → Keyboards → add **বাংলা**; and
      Settings → General → Keyboard → **Dictation** → enable + add Bangla.
- [ ] **58b.** **The keyboard's own mic** (the 🎤 on the iOS keyboard): its language
      is set by **iOS**, following the active keyboard. Switch to the **Bangla
      keyboard first**, then dictate. No app can override this — it is not a bug
      in Hisab Boi.
- [ ] **58c.** Android: Settings → System → Languages & input → Voice input →
      add **বাংলা**.

## 12. Section J — Bangla localization (new)

- [ ] **59.** Settings → language → **বাংলা** → the whole app switches.
- [ ] **60.** **Shop tab label** reads **শপ** (was the only untranslated tab).
- [ ] **61.** Shop dashboard: quick actions, Today, Inventory stat labels all Bangla.
- [ ] **62.** POS: Scan/Find, cart empty text, payment modes (নগদ/আংশিক/বাকি), Subtotal/Grand Total, Charge button all Bangla.
- [ ] **63.** Products list + Add Product: labels, placeholders, empty states Bangla.
- [ ] **64.** Invoices list + detail + payment modal Bangla (status chips পরিশোধিত/বাকি/আংশিক).
- [ ] **65.** **Validation messages are Bangla:** submit an empty product name → **"পণ্যের নাম আবশ্যক"**, not English.
- [ ] **66.** Submit an invoice line with qty 0 → the error is Bangla.
- [ ] **67.** Organizations screen: status chips (সক্রিয়/স্থগিত/সংরক্ষিত) and offline banner Bangla.
- [ ] **68.** Transaction cards / account ledger show Bangla labels (due amount reads naturally, e.g. "৫০০ বাকি").

## 13. Section K — Offline settings (new)

- [ ] **69.** **Airplane mode.** Settings → Edit profile → change currency + language → **saves without an error** (toast mentions it will sync).
- [ ] **70.** Still offline: Shop → Edit shop → change currency → saves.
- [ ] **71.** Reconnect → **Sync now** → reopen the profile → the change persisted to the server.
- [ ] **72.** Enable the login PIN while offline → sign out/in → the PIN works **offline** (stored in SecureStore).
- [ ] **73.** Offline, previously-opened shops still list (cached), with the offline banner; **creating** a shop offline shows the "needs a connection once" message rather than a generic failure.
- [ ] **74.** Disable the PIN while offline → after sync, `has_login_pin` is false on the server.

## 14. Section L — banner retry button (new)

The banner is the coloured strip at the top when sync has work to do.

- [ ] **75.** With pending changes, the banner shows a small **Sync** chip on the **right**.
- [ ] **76.** **Airplane mode** → tap the chip → a message says your device is offline and to keep working (no crash, no silent no-op).
- [ ] **77.** With the device online but the **backend stopped** → tap the chip → "Backend is down or unreachable… keep working".
- [ ] **78.** Backend running, device online → tap the chip → it shows a spinner, then the pending count drops / banner disappears.
- [ ] **79.** While a sync is in progress the chip is hidden (nothing to retry).

## 15. Section M — Shop screen crash + input spacing (updated)

Both screens below crashed on device before; they must now open normally.
The smart bar sits **outside** the keyboard scroll view so focusing a form field
no longer opens a huge empty gap under the bar.

- [ ] **80.** Shop → **New Sale** opens the POS screen (no redbox). Smart bar at top with normal padding under the header.
- [ ] **81.** Shop → Products → **+ (Add Product)** opens; smart bar sits under the header with **~12px** top padding (not flush, not a huge gap).
- [ ] **82.** Tap **Product Name** (or any form field) → keyboard opens → **no giant white gap** between the smart bar and "BASIC INFORMATION". The focused field stays near the keyboard with only a small gap above the form section.
- [ ] **83.** Type a phrase in either bar → the preview appears (parser works on device).
- [ ] **84.** Tap the **mic** → app does **not** crash. Either: listening starts, or a permission/toast message appears. Keyboard dismisses first.
- [ ] **85.** If Bangla voice is missing, the orange caveat still shows, but English listening still works after grant.
- [ ] **86.** Grant mic + speech permissions → say a short phrase → text lands in the smart bar.

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
