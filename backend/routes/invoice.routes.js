import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as invoiceController from "../controllers/invoice.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get options
router.get("/options", invoiceController.getOptions);

// Get summary/stats
router.get("/summary", invoiceController.getInvoiceSummary);

// CRUD operations
router.get("/", invoiceController.getInvoices);
router.post("/", invoiceController.createInvoice);
router.get("/:invoiceId", invoiceController.getInvoice);
router.patch("/:invoiceId", invoiceController.updateInvoice);

// Payment operations
router.post("/:invoiceId/payments", invoiceController.recordPayment);

// Cancel invoice
router.post("/:invoiceId/cancel", invoiceController.cancelInvoice);

export default router;
