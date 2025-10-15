import { Category, CATEGORY_FLOW_MAP } from "../models/Category.js";
import { DEFAULT_CATEGORIES } from "../constants/defaultCategories.js";

const pickCategoryUpdate = (payload) => {
  const allowed = ["name", "description", "color", "type"];
  return allowed.reduce((acc, field) => {
    if (payload[field] !== undefined) {
      acc[field] = payload[field];
    }
    return acc;
  }, {});
};

export const listCategories = async (req, res, next) => {
  try {
    const includeArchived =
      req.query.include_archived === "true" ||
      req.query.includeArchived === "true";

    const filter = {
      admin: req.user.id,
      ...(includeArchived ? {} : { archived: false }),
    };

    let categories = await Category.find(filter).sort({
      type: 1,
      name: 1,
    });

    if (categories.length === 0 && DEFAULT_CATEGORIES.length > 0) {
      try {
        await Category.insertMany(
          DEFAULT_CATEGORIES.map((category) => ({
            admin: req.user.id,
            ...category,
          })),
          { ordered: false }
        );
        categories = await Category.find(filter).sort({
          type: 1,
          name: 1,
        });
      } catch (seedError) {
        if (seedError.code !== 11000) {
          console.warn("Failed to seed default categories", seedError);
        }
      }
    }

    const legacyUpdates = [];
    for (const category of categories) {
      const expectedFlow = CATEGORY_FLOW_MAP[category.type];
      if (!expectedFlow) {
        let nextType = category.type;
        if (category.type === "donation") {
          const lowerName = category.name?.toLowerCase() ?? "";
          nextType = lowerName.includes("out")
            ? "donation_out"
            : "donation_in";
        } else if (category.type === "other") {
          const lowerName = category.name?.toLowerCase() ?? "";
          nextType = lowerName.includes("credit")
            ? "other_income"
            : "other_expense";
        } else {
          continue;
        }

        const nextFlow = CATEGORY_FLOW_MAP[nextType];
        if (nextFlow) {
          legacyUpdates.push(
            Category.updateOne(
              { _id: category._id },
              { $set: { type: nextType, flow: nextFlow } }
            )
          );
          category.type = nextType;
          category.flow = nextFlow;
        }
      } else if (category.flow !== expectedFlow) {
        legacyUpdates.push(
          Category.updateOne(
            { _id: category._id },
            { $set: { flow: expectedFlow } }
          )
        );
        category.flow = expectedFlow;
      }
    }

    if (legacyUpdates.length > 0) {
      try {
        await Promise.allSettled(legacyUpdates);
      } catch (legacyError) {
        console.warn("Failed to update legacy categories", legacyError);
      }
      categories = await Category.find(filter).sort({ type: 1, name: 1 });
    }

    res.json({ categories });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, type, color, description, flow } = req.body;

    const categoryPayload = {
      admin: req.user.id,
      name,
      type,
      color,
      description,
    };

    if (flow) {
      categoryPayload.flow = flow;
    }

    const category = await Category.create(categoryPayload);

    res.status(201).json({ category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Category with this name and type already exists",
      });
    }
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const update = {
      ...pickCategoryUpdate(req.body),
    };

    if (req.body.flow) {
      update.flow = req.body.flow;
    }

    const category = await Category.findOneAndUpdate(
      { _id: categoryId, admin: req.user.id },
      update,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Category with this name and type already exists",
      });
    }
    next(error);
  }
};

export const archiveCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { archived } = req.body;

    const category = await Category.findOne({
      _id: categoryId,
      admin: req.user.id,
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const nextArchivedState = Boolean(archived);
    category.archived = nextArchivedState;
    category.archived_at = nextArchivedState ? new Date() : undefined;
    await category.save();

    res.json({ category });
  } catch (error) {
    next(error);
  }
};
