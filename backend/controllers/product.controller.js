import mongoose from "mongoose";
import { Product, PRODUCT_UNIT_OPTIONS } from "../models/Product.js";
import { StockMovement } from "../models/StockMovement.js";
import { OrganizationMember } from "../models/OrganizationMember.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const checkOrgAccess = async (userId, organizationId, permission) => {
  if (!organizationId) return { hasAccess: true, isPersonal: true };
  const membership = await OrganizationMember.findOne({
    organization: organizationId,
    user: userId,
    status: "active",
  });
  if (!membership)
    return { hasAccess: false, error: "Access denied to this organization" };
  if (permission && !membership.hasPermission(permission)) {
    return {
      hasAccess: false,
      error: `You don't have ${permission} permission`,
    };
  }
  return { hasAccess: true, membership, isPersonal: false };
};

const buildScope = (userId, organizationId) =>
  organizationId
    ? { organization: organizationId }
    : { admin: userId, organization: { $exists: false } };

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /products/options
 */
export const getOptions = (_req, res) => {
  res.json({ units: PRODUCT_UNIT_OPTIONS });
};

/**
 * POST /products
 */
export const createProduct = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      organization,
      name,
      sku,
      barcode,
      description,
      category_id,
      unit,
      purchase_price,
      sale_price,
      tax_rate,
      current_stock,
      low_stock_threshold,
      track_inventory,
      images,
      meta_data,
    } = req.body;

    if (!name?.trim())
      return res.status(400).json({ message: "Product name is required" });

    const access = await checkOrgAccess(
      userId,
      organization,
      "manage_products",
    );
    if (!access.hasAccess)
      return res.status(403).json({ message: access.error });

    const product = await Product.create({
      organization: organization || undefined,
      admin: userId,
      name,
      sku,
      barcode,
      description,
      category_id,
      unit: unit || "pcs",
      purchase_price: purchase_price || 0,
      sale_price: sale_price || 0,
      tax_rate: tax_rate || 0,
      current_stock: current_stock || 0,
      opening_stock: current_stock || 0,
      low_stock_threshold: low_stock_threshold || 0,
      track_inventory: track_inventory !== false,
      images: images || [],
      meta_data,
      created_by: userId,
    });

    // Record opening stock movement
    if (product.current_stock > 0) {
      await StockMovement.create({
        organization: organization || undefined,
        admin: userId,
        product: product._id,
        type: "opening_stock",
        quantity: product.current_stock,
        unit_cost: product.purchase_price,
        stock_after: product.current_stock,
        notes: "Opening stock",
        date: new Date(),
        created_by: userId,
      });
    }

    res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /products
 */
export const getProducts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      organization,
      search,
      category_id,
      is_active,
      low_stock,
      page = 1,
      limit = 50,
      sort = "name",
    } = req.query;

    const access = await checkOrgAccess(userId, organization, "view_products");
    if (!access.hasAccess)
      return res.status(403).json({ message: access.error });

    const query = { ...buildScope(userId, organization), is_deleted: false };

    if (is_active !== undefined) query.is_active = is_active === "true";
    if (category_id) query.category_id = category_id;

    if (search) {
      query.$text = { $search: search };
    }

    if (low_stock === "true") {
      query.track_inventory = true;
      query.low_stock_threshold = { $gt: 0 };
      query.$expr = { $lte: ["$current_stock", "$low_stock_threshold"] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
    sortObj[sortField] = sort.startsWith("-") ? -1 : 1;

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("category_id", "name color icon")
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean({ virtuals: true }),
      Product.countDocuments(query),
    ]);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /products/barcode/:barcode
 * Lookup product by barcode — used by scanner
 */
export const getProductByBarcode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { barcode } = req.params;
    const { organization } = req.query;

    const access = await checkOrgAccess(userId, organization, "view_products");
    if (!access.hasAccess)
      return res.status(403).json({ message: access.error });

    const query = {
      ...buildScope(userId, organization),
      barcode: barcode.trim(),
      is_deleted: false,
    };

    const product = await Product.findOne(query)
      .populate("category_id", "name color icon")
      .lean({ virtuals: true });

    if (!product)
      return res
        .status(404)
        .json({ message: "Product not found for this barcode" });

    res.json({ product });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /products/:productId
 */
export const getProduct = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({ _id: productId, is_deleted: false })
      .populate("category_id", "name color icon")
      .lean({ virtuals: true });

    if (!product) return res.status(404).json({ message: "Product not found" });

    // Access check
    if (product.organization) {
      const access = await checkOrgAccess(
        userId,
        product.organization,
        "view_products",
      );
      if (!access.hasAccess)
        return res.status(403).json({ message: access.error });
    } else if (product.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ product });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /products/:productId
 */
export const updateProduct = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const updates = req.body;

    const product = await Product.findOne({
      _id: productId,
      is_deleted: false,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.organization) {
      const access = await checkOrgAccess(
        userId,
        product.organization,
        "manage_products",
      );
      if (!access.hasAccess)
        return res.status(403).json({ message: access.error });
    } else if (product.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const allowedFields = [
      "name",
      "sku",
      "barcode",
      "description",
      "category_id",
      "unit",
      "purchase_price",
      "sale_price",
      "tax_rate",
      "low_stock_threshold",
      "track_inventory",
      "images",
      "meta_data",
      "is_active",
    ];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) product[field] = updates[field];
    }

    product.updated_by = userId;
    await product.save();

    res.json({ message: "Product updated successfully", product });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /products/:productId/adjust-stock
 * Manual stock adjustment (in or out)
 */
export const adjustStock = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { type, quantity, unit_cost, notes, date } = req.body;

    const validTypes = ["adjustment_in", "adjustment_out"];
    if (!validTypes.includes(type)) {
      return res
        .status(400)
        .json({ message: "type must be adjustment_in or adjustment_out" });
    }
    if (!quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ message: "quantity must be a positive number" });
    }

    const product = await Product.findOne({
      _id: productId,
      is_deleted: false,
    }).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.organization) {
      const access = await checkOrgAccess(
        userId,
        product.organization,
        "manage_products",
      );
      if (!access.hasAccess) {
        await session.abortTransaction();
        return res.status(403).json({ message: access.error });
      }
    } else if (product.admin.toString() !== userId) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Access denied" });
    }

    const delta = type === "adjustment_in" ? quantity : -quantity;

    if (product.track_inventory && product.current_stock + delta < 0) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Insufficient stock for this adjustment" });
    }

    product.current_stock += delta;
    product.updated_by = userId;
    await product.save({ session });

    await StockMovement.create(
      [
        {
          organization: product.organization,
          admin: userId,
          product: product._id,
          type,
          quantity: delta,
          unit_cost: unit_cost || 0,
          stock_after: product.current_stock,
          notes,
          date: date ? new Date(date) : new Date(),
          created_by: userId,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    res.json({ message: "Stock adjusted successfully", product });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * GET /products/:productId/stock-movements
 */
export const getStockMovements = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const product = await Product.findOne({
      _id: productId,
      is_deleted: false,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.organization) {
      const access = await checkOrgAccess(
        userId,
        product.organization,
        "view_products",
      );
      if (!access.hasAccess)
        return res.status(403).json({ message: access.error });
    } else if (product.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [movements, total] = await Promise.all([
      StockMovement.find({ product: productId })
        .populate("invoice", "invoice_number type")
        .populate("party", "name")
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockMovement.countDocuments({ product: productId }),
    ]);

    res.json({
      movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /products/:productId — soft delete
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const product = await Product.findOne({
      _id: productId,
      is_deleted: false,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.organization) {
      const access = await checkOrgAccess(
        userId,
        product.organization,
        "manage_products",
      );
      if (!access.hasAccess)
        return res.status(403).json({ message: access.error });
    } else if (product.admin.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    product.is_deleted = true;
    product.deleted_at = new Date();
    await product.save();

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /products/stats — low stock, total products, stock value
 */
export const getProductStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { organization } = req.query;

    const access = await checkOrgAccess(userId, organization, "view_products");
    if (!access.hasAccess)
      return res.status(403).json({ message: access.error });

    const scope = {
      ...buildScope(userId, organization),
      is_deleted: false,
      is_active: true,
    };

    const [totalCount, lowStockProducts, stockValue] = await Promise.all([
      Product.countDocuments(scope),
      Product.countDocuments({
        ...scope,
        track_inventory: true,
        low_stock_threshold: { $gt: 0 },
        $expr: { $lte: ["$current_stock", "$low_stock_threshold"] },
      }),
      Product.aggregate([
        { $match: scope },
        {
          $group: {
            _id: null,
            purchase_value: {
              $sum: { $multiply: ["$current_stock", "$purchase_price"] },
            },
            sale_value: {
              $sum: { $multiply: ["$current_stock", "$sale_price"] },
            },
            total_sold_qty: { $sum: "$total_sold" },
            total_purchased_qty: { $sum: "$total_purchased" },
          },
        },
      ]),
    ]);

    const sv = stockValue[0] || {
      purchase_value: 0,
      sale_value: 0,
      total_sold_qty: 0,
      total_purchased_qty: 0,
    };

    res.json({
      stats: {
        total_products: totalCount,
        low_stock_count: lowStockProducts,
        stock_purchase_value: sv.purchase_value,
        stock_sale_value: sv.sale_value,
        total_sold_qty: sv.total_sold_qty,
        total_purchased_qty: sv.total_purchased_qty,
        potential_profit: sv.sale_value - sv.purchase_value,
      },
    });
  } catch (error) {
    next(error);
  }
};
