import { Router } from 'express';
import { z } from 'zod';
import {
  listAccounts,
  createAccount,
  updateAccount,
  getAccountSummary
} from '../controllers/account.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    type: z.enum(['debit', 'credit']),
    description: z.string().optional(),
    createdViaVoice: z.boolean().optional()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).optional(),
      type: z.enum(['debit', 'credit']).optional(),
      description: z.string().optional(),
      balance: z.number().optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided'
    }),
  params: z.object({
    accountId: z.string()
  }),
  query: z.object({}).optional()
});

router.use(authenticate);

router.get('/', listAccounts);
router.post('/', validate(createSchema), createAccount);
router.patch('/:accountId', validate(updateSchema), updateAccount);
router.get('/:accountId/summary', getAccountSummary);

export default router;
