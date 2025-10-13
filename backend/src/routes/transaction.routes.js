import { Router } from 'express';
import { z } from 'zod';
import {
  listTransactions,
  createTransaction,
  updateTransaction
} from '../controllers/transaction.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createSchema = z.object({
  body: z.object({
    accountId: z.string(),
    type: z.enum(['debit', 'credit']),
    amount: z.number().positive(),
    date: z.string().datetime().optional(),
    description: z.string().optional(),
    comment: z.string().optional(),
    createdViaVoice: z.boolean().optional()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateSchema = z.object({
  body: z
    .object({
      accountId: z.string().optional(),
      type: z.enum(['debit', 'credit']).optional(),
      amount: z.number().positive().optional(),
      date: z.string().datetime().optional(),
      description: z.string().optional(),
      comment: z.string().optional()
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'No update fields provided' }),
  params: z.object({
    transactionId: z.string()
  }),
  query: z.object({}).optional()
});

router.use(authenticate);

router.get('/', listTransactions);
router.post('/', validate(createSchema), createTransaction);
router.patch('/:transactionId', validate(updateSchema), updateTransaction);

export default router;
