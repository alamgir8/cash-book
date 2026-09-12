# Bangla shop lexicon guide

How to add or update common product names, aliases, and brands used by the
Smart Add bar (voice / type matching) in Hisab Boi.

**No rebuild required** for seed edits — reload the Metro bundle (or restart
the app) after saving. Admin UI for editing this from the phone is planned
later; for now edit the seed files in the repo.

---

## Where the data lives

```
mobile/lib/voice/lexicon/
  format.ts          # parser (do not change unless extending the grammar)
  lookup.ts          # matching / brand suggestions
  index.ts           # loads seed + warms the index
  seed/
    staples.ts       # rice, dal, flour, spices, oil, dairy…
    produce.ts       # meat, fish, vegetables, fruits
    goods.ts         # snacks, drinks, personal care, household…
    brands.ts        # brand aliases + extra kirana lines
    brand-map.ts     # product family → suggested brands
    index.ts         # concatenates all packs — register new files here
```

Docs reference: this file. Runtime docs also point here from Phase QA notes.

---

## Line format (keep it compact)

### 1. Product or brand entry

```text
canonical|alias1|alias2|alias3
```

- **First field** = Bangla display name shown in the UI.
- Later fields = search aliases (Bangla, English, romanized).
- Example:

```text
সাবান|soap|sabun|lux soap
চাল|rice|chal|মোটা চাল|সরু চাল
লাক্স|lux|Lux
```

### 2. Brand map (product → brands)

```text
productFamily>brand1|brand2|brand3
```

Used when the guided Add Product flow is on the **Brand** step.

```text
সাবান>লাক্স|লাইফবয়|ডেটল|মারকো
তেল>রুপচাঁদা|ফ্রেশ|পুস্টি
```

### 3. Category headers

```text
# category:staples
# category:brands
# category:brand_map
```

Comments start with `#`. Blank lines are fine.

---

## How to add more words

1. Open the right seed file (or create `seed/pharmacy.ts`, etc.).
2. Append lines in the format above (UTF-8).
3. If you created a **new file**, import it in `seed/index.ts` and add it to
   `getBundledLexiconBlob()`.
4. Save → reload the app.
5. Optional: run

```bash
cd cash-book/mobile && npm run test:local-first
```

---

## Matching behaviour (what users see)

| Source | Chip colour | Meaning |
|--------|-------------|---------|
| Existing catalog product | Green (`✓`) | Already in the shop — tap fills **all** fields |
| Saved phrase alias | Green | Shopkeeper nickname learned earlier |
| Lexicon suggestion | Blue | Dictionary name — tap fills name (+ inferred brand) |

On **Add Product**:

- Tap a chip → applies immediately (no need to press +).
- Tap another chip → replaces the previous selection.
- **+ / →** advances to the next form field (name → brand → unit → prices…).
- On the brand step, chips show brands for the current product title.

---

## Tips for large lists

- Prefer **aliases on one line** over many near-duplicate entries.
- Put the most common Bangla name first.
- Always add **English + romanized** aliases so English mic transcripts still match
  (`soap`, `chal`, `lux`).
- Keep packs under ~80KB total so startup stays fast (currently ~20–30KB).

---

## Do not

- Do not put secrets or customer-specific prices in the seed.
- Do not switch to a huge JSON array of objects — the pipe format stays smaller
  and easier to diff in git.
- Do not import seed packs with dynamic `import(variable)` — Metro will break.

---

## Later: admin UI

A Settings / Shop admin screen to append custom phrases into SQLite
(`phrase_aliases`) without editing code is planned. Until then:

- Shared vocabulary → edit these seed files.
- Per-shop nicknames → already learned automatically when a user taps a
  suggestion that differs from what they typed.
