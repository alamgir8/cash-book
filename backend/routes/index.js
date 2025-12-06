import { Router } from "express";
import authRoutes from "./auth.routes.js";
import accountRoutes from "./account.routes.js";
import categoryRoutes from "./category.routes.js";
import transactionRoutes from "./transaction.routes.js";
import reportRoutes from "./report.routes.js";
import backupRoutes from "./backup.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/accounts", accountRoutes);
router.use("/categories", categoryRoutes);
router.use("/transactions", transactionRoutes);
router.use("/reports", reportRoutes);
router.use("/backup", backupRoutes);

export default router;
