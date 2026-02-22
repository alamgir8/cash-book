/**
 * Enterprise-grade file parser for PDF and XLSX bank statements.
 *
 * Supports:
 * - Bengali (Bangla) text with English numbers
 * - Multiple bank statement formats
 * - Auto-detection of columns and date formats
 * - Debit/Credit type inference from separate columns or keyword detection
 */

import XLSX from "xlsx";

// ─── Bengali/Bangla Number Conversion ─────────────────────────────────────────

const BANGLA_DIGITS = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

/**
 * Convert Bengali/Bangla digits to English digits.
 * Handles mixed text that may contain both Bengali and English numbers.
 */
export const convertBanglaToEnglish = (text) => {
  if (!text || typeof text !== "string") return text;
  return text.replace(/[০-৯]/g, (match) => BANGLA_DIGITS[match] || match);
};

/**
 * Parse a number string that may contain Bengali digits, commas, spaces, etc.
 * Returns a clean float or null if not a valid number.
 */
export const parseAmount = (value) => {
  if (value === null || value === undefined) return null;

  // If already a number, return it
  if (typeof value === "number" && !isNaN(value)) {
    return Math.abs(value);
  }

  let str = String(value).trim();
  if (!str) return null;

  // Convert Bengali digits
  str = convertBanglaToEnglish(str);

  // Track if negative
  const isNegative = str.startsWith("-") || str.startsWith("(");

  // Remove currency symbols, commas, spaces, parentheses
  str = str.replace(/[৳$€£¥₹,\s()BDTTktk]/gi, "").trim();

  // Remove trailing minus sign (some formats put it at end)
  if (str.endsWith("-")) {
    str = str.slice(0, -1);
  }

  const num = parseFloat(str);
  if (isNaN(num)) return null;

  return isNegative ? -Math.abs(num) : Math.abs(num);
};

// ─── Date Parsing ─────────────────────────────────────────────────────────────

const DATE_FORMATS = [
  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  {
    regex: /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/,
    parse: (m) => new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
  },
  // YYYY-MM-DD, YYYY/MM/DD
  {
    regex: /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/,
    parse: (m) => new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  },
  // DD/MM/YY, DD-MM-YY
  {
    regex: /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/,
    parse: (m) => {
      const yr = Number(m[3]);
      const fullYear = yr > 50 ? 1900 + yr : 2000 + yr;
      return new Date(fullYear, Number(m[2]) - 1, Number(m[1]));
    },
  },
  // MM/DD/YYYY (US format, try if DD > 12 fails)
  {
    regex: /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/,
    parse: (m) => new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2])),
    fallback: true,
  },
];

/**
 * Parse date string supporting multiple formats including Bengali dates.
 */
export const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  let str = String(value).trim();
  str = convertBanglaToEnglish(str);

  // Try standard JS Date parsing first for ISO strings
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime()) && str.includes("T")) return isoDate;

  // Try each format
  for (const fmt of DATE_FORMATS) {
    if (fmt.fallback) continue;
    const match = str.match(fmt.regex);
    if (match) {
      const date = fmt.parse(match);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Fallback formats
  for (const fmt of DATE_FORMATS) {
    if (!fmt.fallback) continue;
    const match = str.match(fmt.regex);
    if (match) {
      const date = fmt.parse(match);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Last resort: try native parsing
  const native = new Date(str);
  if (!isNaN(native.getTime())) return native;

  return null;
};

// ─── Column Detection ─────────────────────────────────────────────────────────

const COLUMN_PATTERNS = {
  date: [
    /date/i,
    /তারিখ/i,
    /তাং/i,
    /দিন/i,
    /trans.*date/i,
    /value.*date/i,
    /posting.*date/i,
  ],
  description: [
    /description/i,
    /particulars/i,
    /narration/i,
    /details/i,
    /বিবরণ/i,
    /বিস্তারিত/i,
    /নোট/i,
    /remarks/i,
    /memo/i,
  ],
  counterparty: [
    /counter\s?party/i,
    /payee/i,
    /payer/i,
    /beneficiary/i,
    /party/i,
    /sender/i,
    /receiver/i,
    /name/i,
    /প্রাপক/i,
    /প্রেরক/i,
  ],
  debit: [
    /debit/i,
    /withdrawal/i,
    /withdraw/i,
    /dr/i,
    /expense/i,
    /ডেবিট/i,
    /খরচ/i,
    /উত্তোলন/i,
  ],
  credit: [/credit/i, /deposit/i, /cr/i, /income/i, /ক্রেডিট/i, /আয়/i, /জমা/i],
  amount: [/amount/i, /total/i, /sum/i, /value/i, /টাকা/i, /পরিমাণ/i, /অর্থ/i],
  balance: [/balance/i, /closing/i, /running/i, /ব্যালেন্স/i, /জের/i],
  type: [/type/i, /trans.*type/i, /ধরন/i, /প্রকার/i],
};

/**
 * Auto-detect column mapping from header row.
 * Returns an object mapping field names to column header names.
 */
export const detectColumnMapping = (headers) => {
  const mapping = {};
  const usedHeaders = new Set();

  // Priority order: date, debit, credit, amount, description, counterparty, balance, type
  const fieldOrder = [
    "date",
    "debit",
    "credit",
    "amount",
    "description",
    "counterparty",
    "balance",
    "type",
  ];

  for (const field of fieldOrder) {
    const patterns = COLUMN_PATTERNS[field];
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const normalized = String(header).trim();
      for (const pattern of patterns) {
        if (pattern.test(normalized)) {
          mapping[field] = normalized;
          usedHeaders.add(header);
          break;
        }
      }
      if (mapping[field]) break;
    }
  }

  return mapping;
};

// ─── Type Inference ───────────────────────────────────────────────────────────

const DEBIT_KEYWORDS = [
  /withdraw/i,
  /debit/i,
  /payment/i,
  /transfer out/i,
  /purchase/i,
  /charge/i,
  /fee/i,
  /expense/i,
  /ডেবিট/i,
  /খরচ/i,
  /উত্তোলন/i,
  /প্রদান/i,
];

const CREDIT_KEYWORDS = [
  /deposit/i,
  /credit/i,
  /refund/i,
  /transfer in/i,
  /salary/i,
  /income/i,
  /received/i,
  /ক্রেডিট/i,
  /আয়/i,
  /জমা/i,
  /প্রাপ্ত/i,
];

/**
 * Infer transaction type from description text.
 */
export const inferTypeFromDescription = (description) => {
  if (!description) return null;
  const text = String(description);
  for (const pattern of DEBIT_KEYWORDS) {
    if (pattern.test(text)) return "debit";
  }
  for (const pattern of CREDIT_KEYWORDS) {
    if (pattern.test(text)) return "credit";
  }
  return null;
};

// ─── Row Processing ───────────────────────────────────────────────────────────

/**
 * Process a single row of data using the column mapping.
 * Returns a normalized import item or null if the row is empty/invalid.
 */
export const processRow = (row, columnMapping, rowIndex) => {
  const getValue = (field) => {
    const colName = columnMapping[field];
    if (!colName) return null;
    const val = row[colName];
    if (val === null || val === undefined || String(val).trim() === "") {
      return null;
    }
    return String(val).trim();
  };

  const rawDate = getValue("date");
  const rawDescription = getValue("description");
  const rawCounterparty = getValue("counterparty");
  const rawDebit = getValue("debit");
  const rawCredit = getValue("credit");
  const rawAmount = getValue("amount");
  const rawType = getValue("type");

  // Skip completely empty rows
  if (!rawDate && !rawDescription && !rawDebit && !rawCredit && !rawAmount) {
    return null;
  }

  // Parse amount and determine type
  let amount = null;
  let type = null;

  // If separate debit/credit columns exist
  const debitAmount = parseAmount(rawDebit);
  const creditAmount = parseAmount(rawCredit);

  if (debitAmount !== null && debitAmount > 0) {
    amount = debitAmount;
    type = "debit";
  } else if (creditAmount !== null && creditAmount > 0) {
    amount = creditAmount;
    type = "credit";
  } else if (rawAmount !== null) {
    const parsedAmount = parseAmount(rawAmount);
    if (parsedAmount !== null) {
      amount = Math.abs(parsedAmount);
      // Negative amounts are debits, positive are credits (bank convention)
      if (parsedAmount < 0) {
        type = "debit";
      } else {
        type = "credit";
      }
    }
  }

  // Type from explicit type column
  if (rawType) {
    const normalizedType = convertBanglaToEnglish(rawType).toLowerCase().trim();
    if (/debit|dr|withdrawal|ডেবিট/i.test(normalizedType)) {
      type = "debit";
    } else if (/credit|cr|deposit|ক্রেডিট/i.test(normalizedType)) {
      type = "credit";
    }
  }

  // Infer type from description if still unknown
  if (!type && rawDescription) {
    type = inferTypeFromDescription(rawDescription);
  }

  // Default to debit if still unknown
  if (!type) type = "debit";

  const parsedDate = parseDate(rawDate);

  return {
    row_index: rowIndex,
    date: parsedDate,
    description: rawDescription ? convertBanglaToEnglish(rawDescription) : null,
    counterparty: rawCounterparty
      ? convertBanglaToEnglish(rawCounterparty)
      : null,
    amount,
    type,
    raw_date: rawDate,
    raw_amount: rawDebit || rawCredit || rawAmount,
    raw_description: rawDescription,
    raw_counterparty: rawCounterparty,
    raw_type: rawType,
    status: amount && amount > 0 ? "pending" : "skipped",
    error_message:
      !amount || amount <= 0 ? "Invalid or missing amount" : undefined,
  };
};

// ─── Ledger Row Processing ────────────────────────────────────────────────────

/**
 * Detect whether an XLSX/CSV is a "ledger" format where:
 *  - Headers are account names (each column = an account)
 *  - Second column from the left = counterparty / description
 *  - Last column = notes
 *  - All amounts in account columns are for a specific type (credit/debit)
 *
 * Returns { isLedger, counterpartyCol, notesCol, accountCols, dateCols }
 */
export const detectLedgerFormat = (headers) => {
  // First try standard detection
  const standardMapping = detectColumnMapping(headers);

  // Heuristic: count how many headers match known column patterns
  const knownPatterns = Object.values(COLUMN_PATTERNS).flat();
  let unmatchedCount = 0;
  let matchedCount = 0;

  for (const header of headers) {
    const normalized = String(header).trim();
    if (!normalized) continue;
    let matched = false;
    for (const pattern of knownPatterns) {
      if (pattern.test(normalized)) {
        matched = true;
        break;
      }
    }
    if (matched) matchedCount++;
    else unmatchedCount++;
  }

  // Strong ledger signal: many columns (>8) and most are unmatched account names
  // This catches dual-section spreadsheets (income + expense side-by-side)
  if (headers.length > 8 && unmatchedCount > headers.length * 0.5) {
    return { isLedger: true };
  }

  // If standard detection finds date + (debit/credit or amount), AND
  // most columns are matched → standard format
  const hasStandardAmount =
    standardMapping.debit || standardMapping.credit || standardMapping.amount;
  if (
    standardMapping.date &&
    hasStandardAmount &&
    matchedCount > unmatchedCount
  ) {
    return { isLedger: false };
  }

  // If more than half are unmatched, likely ledger
  if (unmatchedCount > matchedCount && unmatchedCount >= 2) {
    return { isLedger: true };
  }

  return { isLedger: false };
};

/**
 * Process a ledger-format spreadsheet.
 * In ledger format:
 *  - Column 0 (first) = date (or serial/SL number)
 *  - Column 1 (second from left) = counterparty + description
 *  - Last column = notes
 *  - All other middle columns = account names, values are amounts
 *  - All transactions are a single type (credit or debit, configurable)
 *
 * Each row with amounts in N account columns generates N import items.
 */
export const processLedgerSheet = (rawData, headers, options = {}) => {
  const defaultType = options.defaultType || "credit";
  const items = [];
  const accountColumns = []; // { index, name, type }

  // ─── Identify special columns ──────────────────────────────
  // Patterns for non-account columns (dates, descriptions, totals, notes)
  const DATE_HEADER = /date|তারিখ/i;
  const DESC_HEADER = /description|particulars|narration|বিবরণ|name|নাম/i;
  const TOTAL_HEADER =
    /total|মোট|sum|subtotal|actual|প্রদান|balance|ব্যালেন্স/i;
  const NOTES_HEADER = /note|remark|comment|মন্তব্য|কথায়/i;
  const SERIAL_HEADER = /sl|serial|no|#|ক্রম/i;
  const DEBIT_SECTION_HINT =
    /খরচ|expense|debit|ব্যয়|কেনা|বাবদ|mistri|rong|tails|glass|doroja|rod|cement|বালু|ইট|সিমেন্ট|রড|মিস্ত্রি|ওয়ারিং|বেতন|গ্রীল|জানালা/i;

  // Detect date columns, description columns, and account columns
  const dateCols = [];
  const descCols = [];
  const notesCols = [];
  const totalCols = [];
  const serialCols = [];

  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || "").trim();
    if (!h) continue;
    if (DATE_HEADER.test(h)) dateCols.push(i);
    else if (DESC_HEADER.test(h)) descCols.push(i);
    else if (NOTES_HEADER.test(h)) notesCols.push(i);
    else if (TOTAL_HEADER.test(h)) totalCols.push(i);
    else if (SERIAL_HEADER.test(h)) serialCols.push(i);
  }

  // ─── Detect sections ──────────────────────────────────────
  // If we have 2+ date columns, this is a multi-section sheet
  // Section 1: from first date col to second date col (exclusive)
  // Section 2: from second date col to end
  const sections = [];

  if (dateCols.length >= 2) {
    // Multi-section: income + expense side by side
    for (let s = 0; s < dateCols.length; s++) {
      const sectionStart = dateCols[s];
      const sectionEnd =
        s + 1 < dateCols.length ? dateCols[s + 1] : headers.length;

      // Find the desc column for this section (first desc col after date)
      const sectionDescCol = descCols.find(
        (d) => d > sectionStart && d < sectionEnd,
      );
      const sectionNotes = notesCols.filter(
        (n) => n >= sectionStart && n < sectionEnd,
      );

      // Determine type for this section: check if any account col names hint at debit/expense
      const sectionHeaders = headers.slice(sectionStart, sectionEnd);
      const hasDebitHint = sectionHeaders.some((h) =>
        DEBIT_SECTION_HINT.test(h || ""),
      );
      const sectionType = hasDebitHint ? "debit" : "credit";

      sections.push({
        dateCol: sectionStart,
        descCol: sectionDescCol ?? sectionStart + 1,
        notesCol:
          sectionNotes.length > 0 ? sectionNotes[sectionNotes.length - 1] : -1,
        start: sectionStart,
        end: sectionEnd,
        type: sectionType,
      });
    }
  } else {
    // Single section: treat entire sheet as one
    sections.push({
      dateCol: dateCols[0] ?? 0,
      descCol: descCols[0] ?? 1,
      notesCol: notesCols.length > 0 ? notesCols[notesCols.length - 1] : -1,
      start: 0,
      end: headers.length,
      type: defaultType,
    });
  }

  // ─── Build account columns per section ─────────────────────
  const skipIndices = new Set([
    ...dateCols,
    ...descCols,
    ...notesCols,
    ...totalCols,
    ...serialCols,
  ]);

  for (const section of sections) {
    for (let col = section.start; col < section.end; col++) {
      if (skipIndices.has(col)) continue;
      const name = String(headers[col] || "").trim();
      if (!name) continue;
      accountColumns.push({ index: col, name, type: section.type, section });
    }
  }

  // ─── Parse data rows ──────────────────────────────────────
  let itemIndex = 0;
  for (let rowIdx = 0; rowIdx < rawData.length; rowIdx++) {
    const row = rawData[rowIdx];

    // Skip summary/total rows
    const rowText = row
      .map((c) => String(c || ""))
      .join(" ")
      .toLowerCase();
    if (
      /total|মোট|subtotal|grand|closing|opening/i.test(rowText) &&
      !/[০-৯0-9]{2,}/.test(rowText.replace(/total|মোট/gi, ""))
    ) {
      continue;
    }

    // Process each section
    for (const section of sections) {
      // Get date for this section's row
      let dateValue = row[section.dateCol] ?? null;
      if (
        dateValue !== null &&
        dateValue !== undefined &&
        String(dateValue).trim() === ""
      ) {
        dateValue = null;
      }
      let parsedDate = dateValue
        ? parseDate(convertBanglaToEnglish(String(dateValue).trim()))
        : null;

      // Get description for this section
      const descRaw =
        row[section.descCol] != null
          ? String(row[section.descCol]).trim()
          : null;
      const description = descRaw ? convertBanglaToEnglish(descRaw) : null;

      // Get notes
      const notesRaw =
        section.notesCol >= 0 && row[section.notesCol] != null
          ? String(row[section.notesCol]).trim()
          : null;
      const notes = notesRaw ? convertBanglaToEnglish(notesRaw) : null;

      // Check each account column in this section for amounts
      for (const accCol of accountColumns) {
        if (accCol.section !== section) continue;

        const cellValue = row[accCol.index];
        if (
          cellValue === null ||
          cellValue === undefined ||
          String(cellValue).trim() === ""
        ) {
          continue;
        }

        const amount = parseAmount(cellValue);
        if (amount === null || amount <= 0) continue;

        itemIndex++;
        items.push({
          row_index: itemIndex,
          date: parsedDate,
          description: description,
          counterparty: description,
          notes: notes || null,
          amount,
          type: accCol.type || section.type,
          account_name: accCol.name,
          raw_date: dateValue ? String(dateValue) : null,
          raw_amount: String(cellValue),
          raw_description: descRaw,
          raw_counterparty: descRaw,
          raw_type: accCol.type || section.type,
          raw_notes: notesRaw,
          status: "pending",
        });
      }
    }
  }

  // Build return data
  const allAccountNames = accountColumns.map((c) => c.name);
  const firstSection = sections[0];
  const dateColumn =
    firstSection && firstSection.dateCol >= 0
      ? headers[firstSection.dateCol] || "Column 1"
      : null;
  const counterpartyColumn = firstSection
    ? headers[firstSection.descCol] || "Column 2"
    : "Column 2";
  const notesColumn =
    firstSection && firstSection.notesCol >= 0
      ? headers[firstSection.notesCol] || "Last Column"
      : null;

  return {
    items,
    accountColumns: allAccountNames,
    counterpartyColumn,
    notesColumn,
    dateColumn,
    sections: sections.map((s) => ({
      type: s.type,
      dateColumn: headers[s.dateCol],
      descColumn: headers[s.descCol],
      columns: accountColumns
        .filter((ac) => ac.section === s)
        .map((ac) => ac.name),
    })),
  };
};

// ─── XLSX Parser ──────────────────────────────────────────────────────────────

/**
 * Parse an XLSX/XLS/CSV file buffer into structured rows.
 * Supports both standard (one row = one transaction) and ledger
 * (headers = accounts, one row = N transactions) formats.
 *
 * @param {Buffer} buffer
 * @param {object} options
 * @param {string} [options.importMode] - "standard" | "ledger" | "auto" (default)
 * @param {string} [options.defaultType] - default transaction type for ledger mode
 */
export const parseXLSX = (buffer, options = {}) => {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: true,
    cellText: true,
    ...options,
  });

  const sheetName = options.sheetName || workbook.SheetNames[0];
  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw new Error("No valid sheet found in the file");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (rawData.length < 2) {
    throw new Error("File must contain at least a header row and one data row");
  }

  // Find the header row (first row with at least 3 non-empty cells)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawData.length, 10); i++) {
    const nonEmpty = rawData[i].filter(
      (cell) =>
        cell !== null && cell !== undefined && String(cell).trim() !== "",
    );
    if (nonEmpty.length >= 3) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = rawData[headerRowIndex].map((h) => String(h ?? "").trim());

  // Deduplicate headers by appending " - N" suffix for duplicates
  const headerCount = {};
  const headers = rawHeaders.map((h) => {
    if (!h) return h;
    headerCount[h] = (headerCount[h] || 0) + 1;
    if (headerCount[h] > 1) {
      return `${h} - ${headerCount[h]}`;
    }
    return h;
  });
  const detectedColumns = headers.filter((h) => h.length > 0);
  const dataRows = rawData.slice(headerRowIndex + 1);

  // Determine import mode: auto-detect or forced
  const importMode = options.importMode || "auto";
  let useLedger = importMode === "ledger";

  if (importMode === "auto") {
    const detection = detectLedgerFormat(detectedColumns);
    useLedger = detection.isLedger;
  }

  if (useLedger) {
    // ─── Ledger Mode ────────────────────────────────────────────
    const ledgerResult = processLedgerSheet(dataRows, headers, {
      defaultType: options.defaultType || "credit",
    });

    return {
      items: ledgerResult.items,
      detectedColumns,
      columnMapping: {
        counterparty: ledgerResult.counterpartyColumn,
        notes: ledgerResult.notesColumn,
        date: ledgerResult.dateColumn,
      },
      import_mode: "ledger",
      account_columns: ledgerResult.accountColumns,
      sheetNames: workbook.SheetNames,
      totalRawRows: dataRows.length,
      metadata: {
        headerRowIndex,
        sheetName,
        format: "ledger",
        counterpartyColumn: ledgerResult.counterpartyColumn,
        notesColumn: ledgerResult.notesColumn,
        dateColumn: ledgerResult.dateColumn,
      },
    };
  }

  // ─── Standard Mode ──────────────────────────────────────────
  const columnMapping = detectColumnMapping(detectedColumns);

  const items = [];
  for (let i = 0; i < dataRows.length; i++) {
    const rowArray = dataRows[i];
    const row = {};
    headers.forEach((header, idx) => {
      if (header) {
        row[header] = rowArray[idx] ?? "";
      }
    });

    const item = processRow(row, columnMapping, i + 1);
    if (item) {
      items.push(item);
    }
  }

  return {
    items,
    detectedColumns,
    columnMapping,
    import_mode: "standard",
    sheetNames: workbook.SheetNames,
    totalRawRows: dataRows.length,
    metadata: {
      headerRowIndex,
      sheetName,
      format: "standard",
    },
  };
};

// ─── PDF Parser ───────────────────────────────────────────────────────────────

/**
 * Extract a table grid from PDF text lines by detecting consistent column boundaries.
 * Used for ledger-format PDFs where columns are separated by whitespace alignment.
 */
const extractPDFTable = (lines) => {
  // Strategy: find lines with multiple space-separated segments
  // Use spacing patterns to detect column boundaries

  // First pass: look for a "header" line (a line with several distinct text segments)
  let headerLine = null;
  let headerIdx = -1;

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i];
    // Header candidate: has 3+ segments separated by 2+ spaces
    const segments = line
      .split(/\s{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (segments.length >= 3) {
      // Check it's not just a sentence — segments should be relatively short (column headers)
      const avgLen =
        segments.reduce((a, b) => a + b.length, 0) / segments.length;
      if (avgLen < 30) {
        headerLine = segments;
        headerIdx = i;
        break;
      }
    }
  }

  if (!headerLine || headerIdx < 0) {
    return null; // Can't detect table structure
  }

  // Parse data rows starting after header
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const segments = line
      .split(/\s{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Skip lines with too few or too many segments compared to header
    if (segments.length < 2 || segments.length > headerLine.length + 2) {
      continue;
    }

    // Skip summary/total lines
    const joined = segments.join(" ").toLowerCase();
    if (/total|মোট|subtotal|grand|balance|closing|opening/i.test(joined)) {
      continue;
    }

    rows.push(segments);
  }

  return { headers: headerLine, rows };
};

/**
 * Parse a PDF buffer into structured rows.
 * Handles both standard bank statement PDFs and ledger-format PDFs.
 *
 * @param {Buffer} buffer
 * @param {object} options
 * @param {string} [options.importMode] - "standard" | "ledger" | "auto" (default)
 * @param {string} [options.defaultType] - default type for ledger mode
 */
export const parsePDF = async (buffer, options = {}) => {
  // pdf-parse v2: use PDFParse class
  const { PDFParse } = await import("pdf-parse");

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const pdfData = await parser.getText();
  const text = pdfData.text;

  // Split into lines and clean
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const importMode = options.importMode || "auto";

  // ─── Try Ledger Format ────────────────────────────────────────
  if (importMode === "ledger" || importMode === "auto") {
    const table = extractPDFTable(lines);

    if (table && table.headers.length >= 3) {
      // Check if this looks like a ledger (most headers don't match standard patterns)
      const detection = detectLedgerFormat(table.headers);
      const shouldUseLedger = importMode === "ledger" || detection.isLedger;

      if (shouldUseLedger) {
        // Convert extracted table rows to array-of-arrays for processLedgerSheet
        const convertedHeaders = table.headers.map((h) =>
          convertBanglaToEnglish(h),
        );
        const convertedRows = table.rows.map((row) =>
          row.map((cell) => convertBanglaToEnglish(cell)),
        );

        const ledgerResult = processLedgerSheet(
          convertedRows,
          convertedHeaders,
          {
            defaultType: options.defaultType || "credit",
          },
        );

        return {
          items: ledgerResult.items,
          detectedColumns: convertedHeaders,
          columnMapping: {
            counterparty: ledgerResult.counterpartyColumn,
            notes: ledgerResult.notesColumn,
            date: ledgerResult.dateColumn,
          },
          import_mode: "ledger",
          account_columns: ledgerResult.accountColumns,
          totalRawRows: convertedRows.length,
          metadata: {
            pages: pdfData.total,
            totalTextLines: lines.length,
            format: "ledger-pdf",
            counterpartyColumn: ledgerResult.counterpartyColumn,
            notesColumn: ledgerResult.notesColumn,
            dateColumn: ledgerResult.dateColumn,
          },
        };
      }
    }
  }

  // ─── Standard PDF Parsing ───────────────────────────────────────
  const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
  const amountPattern = /[\d,]+\.\d{2}/;

  const parsedRows = [];
  let currentRow = null;

  for (let i = 0; i < lines.length; i++) {
    const line = convertBanglaToEnglish(lines[i]);
    const dateMatch = line.match(datePattern);

    if (dateMatch) {
      if (currentRow) {
        parsedRows.push(currentRow);
      }

      const amounts = [];
      const amountMatches = line.matchAll(/[\d,]+\.\d{2}/g);
      for (const m of amountMatches) {
        const val = parseAmount(m[0]);
        if (val !== null && val > 0) {
          amounts.push({ value: val, index: m.index });
        }
      }

      const dateEnd = dateMatch.index + dateMatch[0].length;
      let description = "";
      if (amounts.length > 0) {
        const firstAmountIdx = line.indexOf(
          line.match(/[\d,]+\.\d{2}/)?.[0] || "",
          dateEnd,
        );
        if (firstAmountIdx > dateEnd) {
          description = line.substring(dateEnd, firstAmountIdx).trim();
        }
      } else {
        description = line.substring(dateEnd).trim();
      }

      let type = null;
      let amount = null;

      if (amounts.length >= 2) {
        if (amounts.length >= 3) {
          if (amounts[0].value > 0 && amounts[1].value === 0) {
            amount = amounts[0].value;
            type = "debit";
          } else if (amounts[1].value > 0) {
            amount = amounts[1].value;
            type = "credit";
          } else {
            amount = amounts[0].value;
            type = inferTypeFromDescription(description) || "debit";
          }
        } else {
          amount = amounts[0].value;
          type = inferTypeFromDescription(description) || "debit";
        }
      } else if (amounts.length === 1) {
        amount = amounts[0].value;
        type = inferTypeFromDescription(description) || "debit";
      }

      currentRow = {
        row_index: parsedRows.length + 1,
        date: parseDate(dateMatch[1]),
        description: description || null,
        counterparty: null,
        amount,
        type,
        raw_date: dateMatch[1],
        raw_amount: amount ? String(amount) : null,
        raw_description: description || null,
        raw_counterparty: null,
        raw_type: type,
        status: amount && amount > 0 ? "pending" : "skipped",
        error_message:
          !amount || amount <= 0
            ? "Could not parse amount from PDF row"
            : undefined,
      };
    } else if (currentRow && !amountPattern.test(line)) {
      if (currentRow.description) {
        currentRow.description += " " + line;
        currentRow.raw_description = currentRow.description;
      } else {
        currentRow.description = line;
        currentRow.raw_description = line;
      }
    }
  }

  if (currentRow) {
    parsedRows.push(currentRow);
  }

  return {
    items: parsedRows,
    detectedColumns: ["Date", "Description", "Amount"],
    columnMapping: {
      date: "Date",
      description: "Description",
      amount: "Amount",
    },
    import_mode: "standard",
    totalRawRows: parsedRows.length,
    metadata: {
      pages: pdfData.total,
      totalTextLines: lines.length,
      format: "standard-pdf",
    },
  };
};

// ─── Unified Parser ───────────────────────────────────────────────────────────

/**
 * Parse a file buffer based on its type.
 * @param {Buffer} buffer - File buffer
 * @param {string} fileType - One of: pdf, xlsx, xls, csv
 * @param {object} options - Parser options (importMode, defaultType, etc.)
 */
export const parseFile = async (buffer, fileType, options = {}) => {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return parsePDF(buffer, options);
    case "xlsx":
    case "xls":
      return parseXLSX(buffer, options);
    case "csv":
      return parseXLSX(buffer, { ...options, raw: true });
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
};
