import { Category } from "../models/Category.js";

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

    const categories = await Category.find(filter).sort({
      type: 1,
      name: 1,
    });

    res.json({ categories });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, type, color, description } = req.body;

    const category = await Category.create({
      admin: req.user.id,
      name,
      type,
      color,
      description,
    });

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
    const update = pickCategoryUpdate(req.body);

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
