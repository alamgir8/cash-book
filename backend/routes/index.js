import { Router } from "express";
import authRoutes from "./auth.routes.js";
import accountRoutes from "./account.routes.js";
import categoryRoutes from "./category.routes.js";
import transactionRoutes from "./transaction.routes.js";
import reportRoutes from "./report.routes.js";
import backupRoutes from "./backup.routes.js";
import organizationRoutes from "./organization.routes.js";
import partyRoutes from "./party.routes.js";
import invoiceRoutes from "./invoice.routes.js";
import importRoutes from "./import.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/accounts", accountRoutes);
router.use("/categories", categoryRoutes);
router.use("/transactions", transactionRoutes);
router.use("/reports", reportRoutes);
router.use("/backup", backupRoutes);
router.use("/organizations", organizationRoutes);
router.use("/parties", partyRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/imports", importRoutes);

export default router;
