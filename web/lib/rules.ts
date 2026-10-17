/**
 * Which payments pause for the family. Hard rule #1: AI suggests, code decides
 * money.
 *
 * This is a pure function of facts the server gathered itself, plus one
 * suggestion from the phone's on-device Guard model. The Guard's score can add
 * a hold reason and can never remove one: there is no input from any model
 * that lets a payment through that these fixed rules would have held. So a
 * fooled, broken or tampered model can make us more careful, never less.
 *
 * Every rule here is something the family can read in plain words on their
 * phone (`HOLD_REASON_LABELS`), because "the AI said so" is not a reason a
 * family member can check.
 */
import type { Category, PayeeKind } from '@/lib/categories';
import type { Cents } from '@/lib/money';

/** In the order the family sees them: what it is, who it is to, how much, when. */
export const HOLD_REASONS = [
  'frozen',
  'gift_card',
  'cash_then_gift_card',
  'crypto',
  'wire_transfer',
  'new_payee',
  'over_limit',
  'unusual_spending',
  'during_call',
  'guard_flagged',
] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  frozen: 'Your family froze spending',
  gift_card: 'Gift card purchase',
  cash_then_gift_card: 'Cash at an ATM, then a gift card. Scammers often ask for this.',
  crypto: 'Crypto purchase',
  wire_transfer: 'Wire transfer',
  new_payee: 'Someone they have not paid before',
  over_limit: 'Over the limit you set',
  unusual_spending: 'Much more than they usually spend on this',
  during_call: 'Paid while on a phone call',
  guard_flagged: 'Our scam check flagged it',
};

/** The default "hold anything over" limit: over $300, as in the pitch. Families can change it. */
export const DEFAULT_HOLD_OVER_CENTS = 30_000 as Cents;

/**
 * The unusual-spending rule reads the Tiger Data baseline: a payment is
 * unusual if it is more than `multiplier` times what they typically spend in
 * that category on a day they spend in it at all.
 */
export const UNUSUAL_SPENDING = {
  multiplier: 3,
  /** Never call anything under $50 unusual: a $9 lunch on a $3-coffee budget is not a scam. */
  floorCents: 5_000 as Cents,
  /** Fewer active days of history than this is too little to call anything unusual. */
  minActiveDays: 5,
} as const;

/** Guard scores at or above this add `guard_flagged`. */
export const GUARD_HOLD_SCORE = 0.5;

/**
 * The scam sequence: ATM cash, then a gift card within this window. Each step
 * looks normal alone; together they are how scammers coach a victim.
 */
export const CASH_THEN_GIFT_CARD_WINDOW_SECONDS = 2 * 60 * 60;

/** Categories that always pause, whoever is paid and however little. */
const ALWAYS_HOLD: Partial<Record<Category, HoldReason>> = {
  gift_cards: 'gift_card',
  crypto: 'crypto',
  wire_transfer: 'wire_transfer',
};

export type PaymentFacts = {
  amountCents: Cents;
  category: Category;
  payeeKind: PayeeKind;
  /** On the family's approved payee list. Looked up by the server, never taken from the phone. */
  payeeKnown: boolean;
  /** The phone reports an active call. */
  onCall: boolean;
};

/** Facts about the circle, looked up by the server under the circle's row lock. */
export type CircleFacts = {
  /** The family tapped Freeze. */
  frozen: boolean;
  /** ATM cash in the ledger within `CASH_THEN_GIFT_CARD_WINDOW_SECONDS`, boundary included. */
  atmCashRecently: boolean;
};

/** Spending history for the payment's category, from the Tiger Data continuous aggregate. */
export type Baseline = {
  typicalDailyCents: Cents;
  activeDays: number;
} | null;

/** What the on-device Guard model thinks, 0 (fine) to 1 (scam). Advisory only. */
export type GuardSuggestion = { score: number } | null;

export type HoldDecision =
  | { action: 'allow' }
  | { action: 'hold'; reasons: HoldReason[] };

export function decideHold(input: {
  payment: PaymentFacts;
  holdOverCents: Cents;
  baseline: Baseline;
  guard: GuardSuggestion;
  circle?: CircleFacts;
}): HoldDecision {
  const { payment, holdOverCents, baseline, guard, circle } = input;
  const reasons = new Set<HoldReason>();

  if (circle?.frozen) reasons.add('frozen');

  const categoryReason = ALWAYS_HOLD[payment.category];
  if (categoryReason) reasons.add(categoryReason);

  if (payment.category === 'gift_cards' && circle?.atmCashRecently) reasons.add('cash_then_gift_card');

  if (!payment.payeeKnown) reasons.add('new_payee');

  // "Over $300" means strictly over: exactly $300.00 does not pause.
  if (payment.amountCents > holdOverCents) reasons.add('over_limit');

  if (isUnusual(payment.amountCents, baseline)) reasons.add('unusual_spending');

  if (payment.onCall) reasons.add('during_call');

  // The model's only power: adding a reason. Note there is no branch anywhere
  // in this function where it can remove one.
  if (guard && guard.score >= GUARD_HOLD_SCORE) reasons.add('guard_flagged');

  if (reasons.size === 0) return { action: 'allow' };
  return { action: 'hold', reasons: HOLD_REASONS.filter((r) => reasons.has(r)) };
}

function isUnusual(amountCents: Cents, baseline: Baseline): boolean {
  if (!baseline || baseline.activeDays < UNUSUAL_SPENDING.minActiveDays) return false;
  const threshold = Math.max(
    UNUSUAL_SPENDING.floorCents,
    UNUSUAL_SPENDING.multiplier * baseline.typicalDailyCents,
  );
  return amountCents > threshold;
}
