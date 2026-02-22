import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  upload,
  uploadAndParse,
  getImport,
  listImports,
  updateMapping,
  updateItems,
  executeImport,
  deleteImport,
} from "../controllers/import.controller.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Upload and parse a file (PDF/XLSX/CSV)
router.post("/upload", upload.single("file"), uploadAndParse);

// List all imports
router.get("/", listImports);

// Get a specific import with all items
router.get("/:importId", getImport);

// Update column mapping and default account
router.put("/:importId/mapping", updateMapping);

// Update individual items (type, account, amount overrides)
router.put("/:importId/items", updateItems);

// Execute import (bulk create transactions)
router.post("/:importId/execute", executeImport);

// Delete an import record
router.delete("/:importId", deleteImport);

export default router;
