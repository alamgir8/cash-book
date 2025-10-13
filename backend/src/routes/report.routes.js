import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { exportTransactionsPdf } from "../controllers/report.controller.js";

const router = Router();

router.use(authenticate);
router.get("/transactions/pdf", exportTransactionsPdf);

export default router;
