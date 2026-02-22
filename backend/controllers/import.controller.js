import mongoose from "mongoose";
import multer from "multer";
import { Import } from "../models/Import.js";
import { Account } from "../models/Account.js";
import { Transaction } from "../models/Transaction.js";
import { Party } from "../models/Party.js";
import { Category } from "../models/Category.js";
import { parseFile, processRow } from "../utils/importParser.js";
import { checkOrgAccess, getOrgFromRequest } from "../utils/organization.js";

// ─── Multer Configuration ─────────────────────────────────────────────────────

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "application/csv",
  ];

  // Also check extension
  const ext = file.originalname.split(".").pop()?.toLowerCase();
  const allowedExt = ["pdf", "xlsx", "xls", "csv"];

  if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Unsupported file type. Please upload a PDF, XLSX, XLS, or CSV file.",
      ),
      false,
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

// ─── Helper: Get file type from filename ──────────────────────────────────────

const getFileType = (filename) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["xlsx", "xls", "csv", "pdf"].includes(ext)) return ext;
  return null;
};

// ─── Helper: Adjust account balance ───────────────────────────────────────────

const adjustAccountBalance = async ({ account, amount, type }) => {
  const delta = type === "credit" ? amount : -amount;
  account.current_balance = (account.current_balance ?? 0) + delta;
  await account.save();
  return account.current_balance;
};

// ─── 1. Upload & Parse File ──────────────────────────────────────────────────

export const uploadAndParse = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const organizationId = getOrgFromRequest(req);

    if (organizationId) {
      const access = await checkOrgAccess(
        req.user.id,
        organizationId,
        "create_transactions",
      );
      if (!access.hasAccess) {
        return res.status(403).json({ message: access.error });
      }
    }

    const fileType = getFileType(req.file.originalname);
    if (!fileType) {
      return res.status(400).json({ message: "Unsupported file type" });
    }

    // Decode URL-encoded filename (common with Bengali/Unicode filenames)
    let originalFilename = req.file.originalname;
    try {
      originalFilename = decodeURIComponent(originalFilename);
    } catch {
      // If decoding fails, keep the original
    }

    // Create import record
    const importRecord = await Import.create({
      admin: req.user.id,
      organization: organizationId || undefined,
      original_filename: originalFilename,
      file_type: fileType,
      file_size: req.file.size,
      status: "parsing",
    });

    try {
      // Parse the file (pass importMode + defaultType from client if provided)
      const importMode = req.body.import_mode || "auto"; // "auto" | "standard" | "ledger"
      const defaultType = req.body.default_type || "credit";

      const result = await parseFile(req.file.buffer, fileType, {
        importMode,
        defaultType,
      });

      // Update import record with parsed data
      importRecord.items = result.items;
      importRecord.detected_columns = result.detectedColumns;
      importRecord.column_mapping = result.columnMapping;
      importRecord.total_rows = result.items.length;
      importRecord.parser_metadata = result.metadata;
      importRecord.status = "parsed";

      // Set import mode from parser detection
      importRecord.import_mode = result.import_mode || "standard";

      // For ledger mode, store account columns & try auto-matching
      if (result.import_mode === "ledger" && result.account_columns) {
        // Fetch existing accounts for auto-matching
        const accountFilter = organizationId
          ? { organization: organizationId, is_deleted: { $ne: true } }
          : { admin: req.user.id, is_deleted: { $ne: true } };

        const existingAccounts = await Account.find(accountFilter)
          .select("_id name")
          .lean();

        // Build a mapping: try to match each column name to an existing account
        const accountColumnsMapping = result.account_columns.map((colName) => {
          const normalizedColName = colName.toLowerCase().trim();
          const match = existingAccounts.find(
            (acc) => acc.name.toLowerCase().trim() === normalizedColName,
          );
          return {
            column_name: colName,
            account_id: match ? match._id : undefined,
          };
        });

        importRecord.account_columns = accountColumnsMapping;
      }

      // Calculate initial stats
      let totalDebit = 0;
      let totalCredit = 0;
      for (const item of result.items) {
        if (item.status === "pending") {
          if (item.type === "debit") totalDebit += item.amount || 0;
          if (item.type === "credit") totalCredit += item.amount || 0;
        }
      }
      importRecord.total_debit = totalDebit;
      importRecord.total_credit = totalCredit;

      // Build parse warnings for the client
      const parse_warnings = [];

      if (result.items.length === 0) {
        if (fileType === "pdf") {
          parse_warnings.push({
            code: "PDF_NO_DATA",
            title: "No transactions found in PDF",
            message:
              "The PDF text could not be reliably extracted. Bengali/Bangla fonts in PDFs often use custom encodings that are not machine-readable.",
            suggestion:
              "Try downloading the file as XLSX (Excel) from Google Sheets or your bank portal and upload that instead.",
          });
        } else {
          parse_warnings.push({
            code: "NO_DATA",
            title: "No transactions found",
            message:
              "The parser could not find any valid transaction rows in the file. The file may be empty or in an unsupported format.",
            suggestion:
              "Check that the file has a header row followed by data rows with dates and amounts.",
          });
        }
        importRecord.status = "parsed"; // still parsed, just empty
      }

      if (
        result.items.length > 0 &&
        result.items.length < (result.totalRawRows || 0) * 0.3
      ) {
        parse_warnings.push({
          code: "LOW_MATCH_RATE",
          title: "Many rows could not be parsed",
          message: `Only ${result.items.length} of ${result.totalRawRows} rows were recognized as transactions.`,
          suggestion:
            "Some rows may have missing dates or amounts. Review the parsed items and check if the column mapping is correct.",
        });
      }

      await importRecord.save();

      res.status(201).json({
        import: {
          _id: importRecord._id,
          original_filename: importRecord.original_filename,
          file_type: importRecord.file_type,
          status: importRecord.status,
          import_mode: importRecord.import_mode,
          total_rows: importRecord.total_rows,
          total_debit: importRecord.total_debit,
          total_credit: importRecord.total_credit,
          detected_columns: importRecord.detected_columns,
          column_mapping: importRecord.column_mapping,
          account_columns: importRecord.account_columns,
          items: importRecord.items,
          parser_metadata: importRecord.parser_metadata,
          parse_warnings,
        },
      });
    } catch (parseError) {
      importRecord.status = "failed";
      importRecord.error_message = parseError.message;
      await importRecord.save();

      return res.status(422).json({
        message: "Failed to parse file",
        error: parseError.message,
        importId: importRecord._id,
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─── 2. Get Import Details ───────────────────────────────────────────────────

export const getImport = async (req, res, next) => {
  try {
    const { importId } = req.params;
    const organizationId = getOrgFromRequest(req);

    const filter = { _id: importId, admin: req.user.id };
    if (organizationId) {
      filter.organization = organizationId;
    }

    const importRecord = await Import.findOne(filter)
      .populate("default_account", "name kind")
      .populate("items.account", "name kind")
      .populate("items.category_id", "name type")
      .populate("items.party", "name code type")
      .lean();

    if (!importRecord) {
      return res.status(404).json({ message: "Import not found" });
    }

    res.json({ import: importRecord });
  } catch (error) {
    next(error);
  }
};

// ─── 3. List Imports ─────────────────────────────────────────────────────────

export const listImports = async (req, res, next) => {
  try {
    const organizationId = getOrgFromRequest(req);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const filter = { admin: req.user.id };
    if (organizationId) {
      filter.organization = organizationId;
    }

    const [imports, total] = await Promise.all([
      Import.find(filter)
        .select(
          "_id original_filename file_type status import_mode total_rows imported_count failed_count skipped_count total_debit total_credit createdAt",
        )
        .populate("default_account", "name kind")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Import.countDocuments(filter),
    ]);

    res.json({
      imports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── 4. Update Column Mapping ────────────────────────────────────────────────

export const updateMapping = async (req, res, next) => {
  try {
    const { importId } = req.params;
    const { column_mapping, default_account, account_columns } = req.body;
    const organizationId = getOrgFromRequest(req);

    const filter = { _id: importId, admin: req.user.id };
    if (organizationId) {
      filter.organization = organizationId;
    }

    const importRecord = await Import.findOne(filter);
    if (!importRecord) {
      return res.status(404).json({ message: "Import not found" });
    }

    if (!["parsed", "mapping"].includes(importRecord.status)) {
      return res.status(400).json({
        message: "Import is not in a mappable state",
      });
    }

    // Validate default account
    if (default_account) {
      const accountFilter = organizationId
        ? { _id: default_account, organization: organizationId }
        : { _id: default_account, admin: req.user.id };

      const account = await Account.findOne(accountFilter);
      if (!account) {
        return res.status(404).json({ message: "Default account not found" });
      }
      importRecord.default_account = default_account;
    }

    if (column_mapping) {
      importRecord.column_mapping = column_mapping;
      importRecord.status = "mapping";
    }

    // For ledger mode: update account_columns mapping (column_name → account_id)
    if (
      account_columns &&
      Array.isArray(account_columns) &&
      importRecord.import_mode === "ledger"
    ) {
      // Validate all provided account_ids
      const accountIds = account_columns
        .filter((ac) => ac.account_id)
        .map((ac) => ac.account_id);

      if (accountIds.length > 0) {
        const validAccounts = await Account.find({
          _id: { $in: accountIds },
        })
          .select("_id")
          .lean();

        const validIds = new Set(validAccounts.map((a) => a._id.toString()));

        for (const ac of account_columns) {
          if (ac.account_id && !validIds.has(ac.account_id.toString())) {
            return res.status(400).json({
              message: `Invalid account ID for column "${ac.column_name}"`,
            });
          }
        }
      }

      importRecord.account_columns = account_columns;
      importRecord.status = "mapping";
    }

    await importRecord.save();

    res.json({
      import: {
        _id: importRecord._id,
        column_mapping: importRecord.column_mapping,
        default_account: importRecord.default_account,
        account_columns: importRecord.account_columns,
        import_mode: importRecord.import_mode,
        status: importRecord.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── 5. Update Individual Items ──────────────────────────────────────────────

export const updateItems = async (req, res, next) => {
  try {
    const { importId } = req.params;
    const { items } = req.body; // Array of { itemId, account, category_id, party, type, amount, date, description, counterparty, status }
    const organizationId = getOrgFromRequest(req);

    const filter = { _id: importId, admin: req.user.id };
    if (organizationId) {
      filter.organization = organizationId;
    }

    const importRecord = await Import.findOne(filter);
    if (!importRecord) {
      return res.status(404).json({ message: "Import not found" });
    }

    if (!["parsed", "mapping"].includes(importRecord.status)) {
      return res.status(400).json({
        message: "Import is not in an editable state",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array is required" });
    }

    // Update items
    for (const update of items) {
      const item = importRecord.items.id(update.itemId);
      if (!item) continue;

      if (update.account !== undefined) item.account = update.account;
      if (update.category_id !== undefined)
        item.category_id = update.category_id;
      if (update.party !== undefined) item.party = update.party;
      if (update.type !== undefined) item.type = update.type;
      if (update.amount !== undefined) item.amount = update.amount;
      if (update.date !== undefined) item.date = new Date(update.date);
      if (update.description !== undefined)
        item.description = update.description;
      if (update.counterparty !== undefined)
        item.counterparty = update.counterparty;
      if (update.status !== undefined) item.status = update.status;
    }

    // Recalculate totals
    let totalDebit = 0;
    let totalCredit = 0;
    for (const item of importRecord.items) {
      if (item.status === "pending") {
        if (item.type === "debit") totalDebit += item.amount || 0;
        if (item.type === "credit") totalCredit += item.amount || 0;
      }
    }
    importRecord.total_debit = totalDebit;
    importRecord.total_credit = totalCredit;

    await importRecord.save();

    res.json({
      import: {
        _id: importRecord._id,
        items: importRecord.items,
        total_debit: importRecord.total_debit,
        total_credit: importRecord.total_credit,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── 6. Execute Import (Bulk Create Transactions) ────────────────────────────

export const executeImport = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { importId } = req.params;
    const { default_account, skip_duplicates = true } = req.body;
    const organizationId = getOrgFromRequest(req);

    const filter = { _id: importId, admin: req.user.id };
    if (organizationId) {
      filter.organization = organizationId;
    }

    const importRecord = await Import.findOne(filter);
    if (!importRecord) {
      return res.status(404).json({ message: "Import not found" });
    }

    if (importRecord.status === "completed") {
      return res.status(400).json({ message: "Import already completed" });
    }

    if (importRecord.status === "importing") {
      return res.status(400).json({ message: "Import is already in progress" });
    }

    // Determine default account
    const accountId = default_account || importRecord.default_account;

    // For ledger mode, build account_name → accountId mapping from account_columns
    const isLedger = importRecord.import_mode === "ledger";
    const accountNameMap = new Map(); // column_name → Account doc
    const accountCache = new Map(); // accountId string → Account doc

    if (isLedger && importRecord.account_columns?.length > 0) {
      // Pre-load all mapped accounts
      const mappedIds = importRecord.account_columns
        .filter((ac) => ac.account_id)
        .map((ac) => ac.account_id);

      if (mappedIds.length > 0) {
        const mappedAccounts = await Account.find({
          _id: { $in: mappedIds },
        });
        for (const acc of mappedAccounts) {
          accountCache.set(acc._id.toString(), acc);
        }
      }

      for (const ac of importRecord.account_columns) {
        if (ac.account_id) {
          const accDoc = accountCache.get(ac.account_id.toString());
          if (accDoc) {
            accountNameMap.set(ac.column_name, accDoc);
          }
        }
      }
    }

    // For standard mode, account is required. For ledger, it's optional fallback.
    if (!isLedger && !accountId) {
      return res.status(400).json({
        message: "Default account is required for standard import",
      });
    }

    // Validate default account if provided
    let account = null;
    if (accountId) {
      const accountFilter = organizationId
        ? { _id: accountId, organization: organizationId }
        : { _id: accountId, admin: req.user.id };

      account = await Account.findOne(accountFilter);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }
      accountCache.set(account._id.toString(), account);
    }

    // For ledger mode, check that at least some account columns are mapped
    if (isLedger && accountNameMap.size === 0 && !account) {
      return res.status(400).json({
        message:
          "At least one account column must be mapped, or a default account must be provided",
      });
    }

    // Update status to importing
    importRecord.status = "importing";
    importRecord.default_account = accountId;
    await importRecord.save();

    // Process items one by one (for reliability and individual error handling)
    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    session.startTransaction();

    try {
      for (const item of importRecord.items) {
        if (item.status !== "pending") {
          skippedCount++;
          continue;
        }

        if (!item.amount || item.amount <= 0) {
          item.status = "skipped";
          item.error_message = "Invalid amount";
          skippedCount++;
          continue;
        }

        try {
          // Check for duplicates if enabled
          if (skip_duplicates && item.date && item.amount) {
            const duplicateFilter = {
              admin: req.user.id,
              account: item.account || accountId,
              amount: item.amount,
              type: item.type,
              is_deleted: false,
            };

            if (organizationId) {
              duplicateFilter.organization = organizationId;
            }

            // Check within ±1 day
            const dateObj = new Date(item.date);
            duplicateFilter.date = {
              $gte: new Date(dateObj.getTime() - 86400000),
              $lte: new Date(dateObj.getTime() + 86400000),
            };

            if (item.description) {
              duplicateFilter.description = item.description;
            }

            const existing = await Transaction.findOne(duplicateFilter)
              .session(session)
              .lean();

            if (existing) {
              item.status = "skipped";
              item.error_message = "Duplicate transaction detected";
              skippedCount++;
              continue;
            }
          }

          // Create the transaction
          // For ledger mode, resolve account from account_name column mapping
          let targetAccountId = item.account || accountId;
          if (isLedger && item.account_name) {
            const mappedAccount = accountNameMap.get(item.account_name);
            if (mappedAccount) {
              targetAccountId = mappedAccount._id;
            } else if (!targetAccountId) {
              item.status = "skipped";
              item.error_message = `No account mapped for column: ${item.account_name}`;
              skippedCount++;
              continue;
            }
          }

          const transactionPayload = {
            admin: req.user.id,
            organization: organizationId || undefined,
            account: targetAccountId,
            category_id: item.category_id || undefined,
            party: item.party || undefined,
            type: item.type,
            amount: item.amount,
            date: item.date || new Date(),
            description: item.description || undefined,
            counterparty: item.counterparty || undefined,
            note: item.notes || undefined,
            meta_data: {
              imported: true,
              import_id: importRecord._id,
              row_index: item.row_index,
              original_filename: importRecord.original_filename,
              account_name: item.account_name || undefined,
            },
          };

          const [transaction] = await Transaction.create([transactionPayload], {
            session,
          });

          // Update account balance
          let targetAccount;
          const resolvedAccountId = targetAccountId || accountId;
          const resolvedIdStr = resolvedAccountId?.toString();

          if (accountCache.has(resolvedIdStr)) {
            targetAccount = accountCache.get(resolvedIdStr);
          } else if (resolvedAccountId) {
            targetAccount =
              await Account.findById(resolvedAccountId).session(session);
            if (targetAccount) accountCache.set(resolvedIdStr, targetAccount);
          }

          if (targetAccount) {
            const delta = item.type === "credit" ? item.amount : -item.amount;
            targetAccount.current_balance =
              (targetAccount.current_balance ?? 0) + delta;
            await targetAccount.save({ session });

            transaction.balance_after_transaction =
              targetAccount.current_balance;
            await transaction.save({ session });
          }

          item.status = "imported";
          item.transaction = transaction._id;
          importedCount++;
        } catch (itemError) {
          item.status = "failed";
          item.error_message = itemError.message;
          failedCount++;
        }
      }

      await session.commitTransaction();

      // Update import record
      importRecord.imported_count = importedCount;
      importRecord.skipped_count = skippedCount;
      importRecord.failed_count = failedCount;
      importRecord.status =
        failedCount > 0 && importedCount === 0 ? "failed" : "completed";

      // Recalculate totals based on imported items
      let totalDebit = 0;
      let totalCredit = 0;
      for (const item of importRecord.items) {
        if (item.status === "imported") {
          if (item.type === "debit") totalDebit += item.amount || 0;
          if (item.type === "credit") totalCredit += item.amount || 0;
        }
      }
      importRecord.total_debit = totalDebit;
      importRecord.total_credit = totalCredit;

      await importRecord.save();

      res.json({
        import: {
          _id: importRecord._id,
          status: importRecord.status,
          total_rows: importRecord.total_rows,
          imported_count: importRecord.imported_count,
          skipped_count: importRecord.skipped_count,
          failed_count: importRecord.failed_count,
          total_debit: importRecord.total_debit,
          total_credit: importRecord.total_credit,
        },
        message: `Import completed: ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed`,
      });
    } catch (txError) {
      await session.abortTransaction();

      importRecord.status = "failed";
      importRecord.error_message = txError.message;
      await importRecord.save();

      return res.status(500).json({
        message: "Import failed",
        error: txError.message,
      });
    }
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// ─── 7. Delete Import Record ─────────────────────────────────────────────────

export const deleteImport = async (req, res, next) => {
  try {
    const { importId } = req.params;
    const organizationId = getOrgFromRequest(req);

    const filter = { _id: importId, admin: req.user.id };
    if (organizationId) {
      filter.organization = organizationId;
    }

    const importRecord = await Import.findOne(filter);
    if (!importRecord) {
      return res.status(404).json({ message: "Import not found" });
    }

    if (importRecord.status === "importing") {
      return res.status(400).json({
        message: "Cannot delete an import that is in progress",
      });
    }

    await Import.deleteOne({ _id: importId });

    res.json({ message: "Import deleted successfully" });
  } catch (error) {
    next(error);
  }
};
