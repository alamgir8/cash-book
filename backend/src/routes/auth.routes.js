import { Router } from "express";
import { z } from "zod";
import {
  signup,
  login,
  getProfile,
  updateProfile,
} from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const signupSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(6),
    password: z.string().min(8),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const loginSchema = z.object({
  body: z.object({
    identifier: z.string().min(2),
    password: z.string().min(8),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(6).optional(),
    settings: z
      .object({
        currency: z
          .enum([
            "USD",
            "EUR",
            "GBP",
            "JPY",
            "CAD",
            "AUD",
            "CHF",
            "CNY",
            "INR",
            "BDT",
            "SAR",
            "AED",
          ])
          .optional(),
        language: z
          .enum([
            "en",
            "es",
            "fr",
            "de",
            "it",
            "pt",
            "ru",
            "zh",
            "ja",
            "ar",
            "hi",
            "bn",
          ])
          .optional(),
        week_starts_on: z.number().min(0).max(6).optional(),
      })
      .optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

router.post("/signup", validate(signupSchema), signup);
router.post("/login", validate(loginSchema), login);
router.get("/me", authenticate, getProfile);
router.put("/me", authenticate, validate(updateProfileSchema), updateProfile);

export default router;
