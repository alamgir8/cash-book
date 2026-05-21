import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getOptions,
  createProduct,
  getProducts,
  getProductByBarcode,
  getProduct,
  updateProduct,
  adjustStock,
  getStockMovements,
  deleteProduct,
  getProductStats,
} from "../controllers/product.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Options & stats
router.get("/options", getOptions);
router.get("/stats", getProductStats);

// Barcode lookup (before /:productId to avoid conflicts)
router.get("/barcode/:barcode", getProductByBarcode);

// CRUD
router.post("/", createProduct);
router.get("/", getProducts);
router.get("/:productId", getProduct);
router.patch("/:productId", updateProduct);
router.delete("/:productId", deleteProduct);

// Stock management
router.post("/:productId/adjust-stock", adjustStock);
router.get("/:productId/stock-movements", getStockMovements);

export default router;
