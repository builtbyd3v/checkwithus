/**
 * Request bodies the API accepts. Strict: unknown fields are rejected, so a
 * misspelled field is an error the iOS developer sees, not a value the server
 * silently never reads.
 */
import { z } from 'zod';
import { CATEGORIES, PAYEE_KINDS } from '@/lib/categories';

const text = (max: number) => z.string().trim().min(1).max(max);

export const createPaymentBody = z.strictObject({
  /** Any unique string per payment attempt; reuse it when retrying the same attempt. */
  idempotencyKey: z.string().min(8).max(100),
  /** Integer cents. $500.00 is 50000. */
  amountCents: z.number().int().positive().max(100_000_000),
  payee: z.strictObject({ name: text(80), kind: z.enum(PAYEE_KINDS) }),
  category: z.enum(CATEGORIES),
  /** The phone is on a call right now. */
  onCall: z.boolean(),
  /** The on-device Guard's score, if it ran. Advisory: it can add a hold, never remove one. */
  guard: z
    .strictObject({
      score: z.number().min(0).max(1),
      modelVersion: z.string().max(64).nullable().default(null),
    })
    .nullable()
    .default(null),
  /** checkwith-1's explanation for the family, written on the phone. */
  explanation: z.string().trim().max(2000).nullable().default(null),
  billDueDate: z.iso.date().nullable().default(null),
}).refine(v => v.billDueDate === null || v.payee.kind === 'biller', 'Only bills have a due date');

export const pairBody = z.strictObject({
  code: z.string().min(8).max(20),
  label: text(40).default('iPhone'),
});

export const alertBody = z.strictObject({
  kind: z.enum(['bank_during_call', 'ask_family']),
  detail: z.string().trim().max(500).nullable().default(null),
});

export const decisionBody = z.strictObject({
  decision: z.enum(['approve', 'deny']),
});

export const joinBody = z.strictObject({
  inviteCode: z.string().min(8).max(20),
  displayName: text(80),
});
