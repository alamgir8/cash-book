import { Router } from "express";
import { z } from "zod";
import {
  listCategories,
  createCategory,
  updateCategory,
  archiveCategory,
} from "../controllers/category.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { CATEGORY_TYPE_OPTIONS } from "../models/Category.js";

const router = Router();

const listSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    include_archived: z.string().optional(),
    includeArchived: z.string().optional(),
  }),
});

const createSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    type: z.enum(CATEGORY_TYPE_OPTIONS),
    description: z.string().trim().max(512).optional(),
    color: z.string().trim().max(32).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updateSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      type: z.enum(CATEGORY_TYPE_OPTIONS).optional(),
      description: z.string().trim().max(512).optional(),
      color: z.string().trim().max(32).optional(),
    })
    .superRefine((data, ctx) => {
      if (
        data.name === undefined &&
        data.type === undefined &&
        data.description === undefined &&
        data.color === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one field must be provided",
          path: ["body"],
        });
      }
    }),
  params: z.object({
    categoryId: z.string(),
  }),
  query: z.object({}).optional(),
});

const archiveSchema = z.object({
  body: z.object({
    archived: z.boolean(),
  }),
  params: z.object({
    categoryId: z.string(),
  }),
  query: z.object({}).optional(),
});

router.use(authenticate);

router.get("/", validate(listSchema), listCategories);
router.post("/", validate(createSchema), createCategory);
router.put("/:categoryId", validate(updateSchema), updateCategory);
router.patch("/:categoryId/archive", validate(archiveSchema), archiveCategory);

export default router;
