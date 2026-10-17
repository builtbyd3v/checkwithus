/**
 * What the two iPhone apps see of a payment. Amounts are integer cents,
 * times are ISO 8601 strings.
 *
 * The older adult's phone gets only what its screen needs, in outcome words
 * it can show directly. The family gets everything, including the on-device
 * model's explanation, because they are the ones deciding.
 */
import { CATEGORY_LABELS } from '@/lib/categories';
import type { Payment, PaymentStatus } from '@/lib/payments';
import { HOLD_REASON_LABELS } from '@/lib/rules';

/** The one word the older adult's screen needs. */
export type DeviceOutcome =
  | 'waiting' // "Waiting for family"
  | 'sending'
  | 'sent'
  | 'blocked_by_family'
  | 'blocked_no_answer'
  | 'failed';

const OUTCOMES: Record<PaymentStatus, DeviceOutcome> = {
  held: 'waiting',
  approved: 'sending',
  paying: 'sending',
  paid: 'sent',
  denied: 'blocked_by_family',
  expired: 'blocked_no_answer',
  failed: 'failed',
};

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function devicePaymentView(payment: Payment, decidedByName: string | null) {
  return {
    id: payment.id,
    outcome: OUTCOMES[payment.status],
    status: payment.status,
    amountCents: payment.amountCents,
    payee: { name: payment.payeeName, kind: payment.payeeKind },
    category: payment.category,
    holdReasons: payment.holdReasons,
    expiresAt: iso(payment.expiresAt),
    decidedAt: iso(payment.decidedAt),
    decidedByName,
  };
}

export function familyPaymentView(
  payment: Payment,
  context: { protectedName: string; decidedByName: string | null },
) {
  return {
    id: payment.id,
    circleId: payment.circleId,
    protectedName: context.protectedName,
    status: payment.status,
    amountCents: payment.amountCents,
    payee: { name: payment.payeeName, kind: payment.payeeKind, known: payment.payeeKnown },
    category: { code: payment.category, label: CATEGORY_LABELS[payment.category] },
    onCall: payment.onCall,
    holdReasons: payment.holdReasons.map((code) => ({ code, label: HOLD_REASON_LABELS[code] })),
    guard: payment.guardScore === null
      ? null
      : { score: payment.guardScore, modelVersion: payment.guardModelVersion },
    explanation: payment.explanation,
    createdAt: iso(payment.createdAt),
    expiresAt: iso(payment.expiresAt),
    decidedAt: iso(payment.decidedAt),
    decidedVia: payment.decidedVia,
    decidedByName: context.decidedByName,
    failure: payment.status === 'failed' ? payment.failure : null,
  };
}
