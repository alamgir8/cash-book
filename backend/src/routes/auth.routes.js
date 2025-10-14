import { Router } from "express";
import { z } from "zod";
import {
  register,
  login,
  refreshSession,
  logout,
  getProfile,
  updateProfile,
} from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  ADMIN_CURRENCY_OPTIONS,
  ADMIN_LANGUAGE_OPTIONS,
  ADMIN_LOCALE_OPTIONS,
} from "../models/Admin.js";

const router = Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    email: z.string().email(),
    phone: z.string().trim().min(6).optional(),
    password: z.string().min(8),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const refreshSchema = z.object({
  body: z.object({
    refresh_token: z.string().min(10),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const logoutSchema = z.object({
  body: z
    .object({
      refresh_token: z.string().min(10).optional(),
    })
    .optional(),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const profileSettingsSchema = z.object({
  language: z.enum(ADMIN_LANGUAGE_OPTIONS).optional(),
  currency_code: z.enum(ADMIN_CURRENCY_OPTIONS).optional(),
  currency_symbol: z.string().trim().max(4).optional(),
  locale: z.enum(ADMIN_LOCALE_OPTIONS).optional(),
  date_format: z.string().trim().min(2).optional(),
  time_format: z.enum(["HH:mm", "hh:mm A"]).optional(),
  week_starts_on: z.number().int().min(0).max(6).optional(),
});

const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().trim().min(6).optional(),
      profile_settings: profileSettingsSchema.optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.name && !data.email && !data.phone && !data.profile_settings) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one field must be provided",
          path: ["body"],
        });
      }
    }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

router.post("/register", validate(registerSchema), register);
router.post("/signup", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshSchema), refreshSession);
router.post("/logout", authenticate, validate(logoutSchema), logout);
router.get("/me", authenticate, getProfile);
router.put("/me/profile", authenticate, validate(updateProfileSchema), updateProfile);

export default router;
