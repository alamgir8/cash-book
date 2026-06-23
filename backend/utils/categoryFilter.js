import mongoose from "mongoose";
import { Category } from "../models/Category.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const looseCategoryNameKey = (name = "") =>
  String(name)
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ");

export const buildCategoryScope = ({ adminId, organizationId }) => {
  const base = { admin: new mongoose.Types.ObjectId(adminId) };
  if (organizationId) {
    return {
      ...base,
      organization: new mongoose.Types.ObjectId(organizationId),
    };
  }
  return base;
};

export const resolveCategoryIdsByName = async ({
  name,
  categoryId,
  adminId,
  organizationId,
}) => {
  const scope = buildCategoryScope({ adminId, organizationId });
  let searchName = name?.trim();

  if (
    !searchName &&
    categoryId &&
    mongoose.isValidObjectId(String(categoryId))
  ) {
    const doc = await Category.findOne({
      _id: new mongoose.Types.ObjectId(String(categoryId)),
      ...scope,
    })
      .select("name")
      .lean();
    searchName = doc?.name?.trim();
  }

  if (!searchName) {
    if (categoryId && mongoose.isValidObjectId(String(categoryId))) {
      return [new mongoose.Types.ObjectId(String(categoryId))];
    }
    return [];
  }

  const targetKey = looseCategoryNameKey(searchName);
  const categories = await Category.find({
    ...scope,
    name: { $regex: `^${escapeRegex(searchName)}$`, $options: "i" },
  })
    .select("_id name")
    .lean();

  let matched = categories.filter(
    (cat) => looseCategoryNameKey(cat.name) === targetKey,
  );

  if (matched.length === 0) {
    const firstToken = searchName.split(/\s+/)[0];
    const candidates = await Category.find({
      ...scope,
      name: { $regex: escapeRegex(firstToken), $options: "i" },
    })
      .select("_id name")
      .lean();
    matched = candidates.filter(
      (cat) => looseCategoryNameKey(cat.name) === targetKey,
    );
  }

  if (matched.length > 0) {
    return matched.map((cat) => cat._id);
  }

  if (categoryId && mongoose.isValidObjectId(String(categoryId))) {
    return [new mongoose.Types.ObjectId(String(categoryId))];
  }

  return [];
};
