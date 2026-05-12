import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  verifyBalances,
  reconcileBalances,
} from "../controllers/reconciliation.controller.js";

const router = Router();

// GET  /api/reconciliation/verify    — read-only balance verification report
router.get("/verify", authenticate, verifyBalances);

// POST /api/reconciliation/reconcile — fix balances from transaction history
router.post("/reconcile", authenticate, reconcileBalances);

export default router;
