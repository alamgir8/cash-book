import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import {
  handshake,
  push,
  pull,
  ack,
} from "../controllers/sync.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sync requests. Try again later." },
});

const changeSchema = z.object({
  entity: z.enum(["account", "category", "party", "transaction", "transfer"]),
  id: z.string().trim().min(1),
  server_id: z.string().trim().nullable().optional(),
  op: z.enum(["upsert", "delete"]),
  updated_at: z.string().trim().min(1),
  deleted_at: z.string().trim().nullable().optional(),
  device_id: z.string().trim().optional(),
  client_request_id: z.string().trim().nullable().optional(),
  payload: z.record(z.any()).optional().default({}),
});

const handshakeSchema = z.object({
  body: z.object({
    device_id: z.string().trim().min(1),
    schemaVersion: z.coerce.number().int().min(1).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const pushSchema = z.object({
  body: z.object({
    device_id: z.string().trim().min(1),
    changes: z.array(changeSchema).max(500),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const pullSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    since: z.string().trim().min(1),
    scope: z.enum(["personal", "all"]).optional().default("personal"),
  }),
});

const ackSchema = z.object({
  body: z.object({
    cursor: z.string().trim().min(1),
    run_id: z.string().trim().min(1),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

router.use(authenticate);

router.post("/handshake", syncLimiter, validate(handshakeSchema), handshake);
router.post("/push", syncLimiter, validate(pushSchema), push);
router.get("/pull", syncLimiter, validate(pullSchema), pull);
router.post("/ack", syncLimiter, validate(ackSchema), ack);

export default router;
