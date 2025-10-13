import { Router } from 'express';
import { z } from 'zod';
import {
  listAccounts,
  createAccount,
  updateAccount,
  getAccountSummary,
  listAccountsWithSummary,
  getAccountDetail,
  getAccountTransactions
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

const historyQuerySchema = z.object({
  range: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(['debit', 'credit']).optional(),
  search: z.string().optional(),
  minAmount: z.string().optional(),
  maxAmount: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

const accountTransactionsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    accountId: z.string()
  }),
  query: historyQuerySchema.default({})
});

router.use(authenticate);

router.get('/', listAccounts);
router.get('/overview', listAccountsWithSummary);
router.post('/', validate(createSchema), createAccount);
router.patch('/:accountId', validate(updateSchema), updateAccount);
router.get('/:accountId/summary', getAccountSummary);
router.get('/:accountId/detail', getAccountDetail);
router.get('/:accountId/transactions', validate(accountTransactionsSchema), getAccountTransactions);

export default router;
