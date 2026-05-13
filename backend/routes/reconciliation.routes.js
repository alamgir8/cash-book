import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  verifyBalances,
  reconcileBalances,
  fixAccount,
} from "../controllers/reconciliation.controller.js";

const router = Router();

// GET  /api/reconciliation/verify                  — read-only balance verification report
router.get("/verify", authenticate, verifyBalances);

// POST /api/reconciliation/reconcile               — fix ALL account balances
router.post("/reconcile", authenticate, reconcileBalances);

// POST /api/reconciliation/fix-account/:accountId  — fix a single account
router.post("/fix-account/:accountId", authenticate, fixAccount);

export default router;
