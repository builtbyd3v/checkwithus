import { describe, expect, it } from 'vitest';
import { toCents } from './money';
import {
  approvalsRequired,
  decideHold,
  DEFAULT_HOLD_OVER_CENTS,
  DEFAULT_TWO_APPROVALS_OVER_CENTS,
  POLICY_OFF_CENTS,
  HOLD_REASONS,
  type Baseline,
  type GuardSuggestion,
  type PaymentFacts,
} from './rules';

const ordinary: PaymentFacts = {
  amountCents: toCents(8_412),
  category: 'utilities',
  payeeKind: 'biller',
  payeeKnown: true,
  onCall: false,
};

function decide(
  payment: Partial<PaymentFacts>,
  extra: { baseline?: Baseline; guard?: GuardSuggestion } = {},
) {
  return decideHold({
    payment: { ...ordinary, ...payment },
    holdOverCents: DEFAULT_HOLD_OVER_CENTS,
    baseline: extra.baseline ?? null,
    guard: extra.guard ?? null,
  });
}

describe('the two demo payments', () => {
  it('lets the real electricity bill through without a pause', () => {
    const result = decide(
      {},
      { baseline: { typicalDailyCents: toCents(8_000), activeDays: 6 }, guard: { score: 0.04 } },
    );
    expect(result).toEqual({ action: 'allow' });
  });

  it('holds the gift-card payment made during the scam call, with every reason', () => {
    const result = decide(
      {
        amountCents: toCents(50_000),
        category: 'gift_cards',
        payeeKind: 'merchant',
        payeeKnown: false,
        onCall: true,
      },
      { guard: { score: 0.97 } },
    );
    expect(result).toEqual({
      action: 'hold',
      reasons: ['gift_card', 'new_payee', 'over_limit', 'during_call', 'guard_flagged'],
    });
  });
});

describe('fixed rules', () => {
  it('reads "over $300" as strictly over', () => {
    expect(decide({ amountCents: toCents(30_000) })).toEqual({ action: 'allow' });
    expect(decide({ amountCents: toCents(30_001) })).toEqual({
      action: 'hold',
      reasons: ['over_limit'],
    });
  });

  it.each([
    ['gift_cards', 'gift_card'],
    ['crypto', 'crypto'],
    ['wire_transfer', 'wire_transfer'],
  ] as const)('always holds %s, even $1 to someone they know', (category, reason) => {
    expect(decide({ category, amountCents: toCents(100) })).toEqual({
      action: 'hold',
      reasons: [reason],
    });
  });

  it('holds anything paid during a call', () => {
    expect(decide({ onCall: true })).toEqual({ action: 'hold', reasons: ['during_call'] });
  });

  it('holds a payee the family has not approved', () => {
    expect(decide({ payeeKnown: false })).toEqual({ action: 'hold', reasons: ['new_payee'] });
  });

  it('respects a limit the family changed', () => {
    const result = decideHold({
      payment: { ...ordinary, amountCents: toCents(10_001) },
      holdOverCents: toCents(10_000),
      baseline: null,
      guard: null,
    });
    expect(result).toEqual({ action: 'hold', reasons: ['over_limit'] });
  });
});

describe('unusual spending (Tiger Data baseline)', () => {
  const groceries = (amount: number, baseline: Baseline) =>
    decide({ category: 'groceries', amountCents: toCents(amount) }, { baseline });

  it('holds more than 3x their typical day in the category', () => {
    const baseline = { typicalDailyCents: toCents(4_000), activeDays: 30 };
    expect(groceries(12_000, baseline)).toEqual({ action: 'allow' });
    expect(groceries(12_001, baseline)).toEqual({ action: 'hold', reasons: ['unusual_spending'] });
  });

  it('never calls anything under $50 unusual', () => {
    const baseline = { typicalDailyCents: toCents(500), activeDays: 30 };
    expect(groceries(5_000, baseline)).toEqual({ action: 'allow' });
    expect(groceries(5_001, baseline)).toEqual({ action: 'hold', reasons: ['unusual_spending'] });
  });

  it('does not judge from too little history', () => {
    const thin = { typicalDailyCents: toCents(500), activeDays: 4 };
    expect(groceries(20_000, thin)).toEqual({ action: 'allow' });
  });

  it('does not judge a category with no history at all', () => {
    expect(groceries(20_000, null)).toEqual({ action: 'allow' });
  });
});

describe('AI suggests, code decides (hard rule #1)', () => {
  const cases: Partial<PaymentFacts>[] = [
    {},
    { onCall: true },
    { payeeKnown: false },
    { amountCents: toCents(90_000) },
    { category: 'crypto' },
    { category: 'gift_cards', onCall: true, payeeKnown: false, amountCents: toCents(50_000) },
  ];
  const scores = [null, 0, 0.2, 0.49, 0.5, 0.9, 1];

  it('a model score can add a reason but never remove one', () => {
    for (const facts of cases) {
      const withoutModel = decide(facts, { guard: null });
      const fixedReasons = withoutModel.action === 'hold' ? withoutModel.reasons : [];
      for (const score of scores) {
        const withModel = decide(facts, { guard: score === null ? null : { score } });
        const reasons = withModel.action === 'hold' ? withModel.reasons : [];
        for (const reason of fixedReasons) expect(reasons).toContain(reason);
      }
    }
  });

  it('the lowest possible score cannot release a held payment', () => {
    expect(decide({ onCall: true }, { guard: { score: 0 } })).toEqual({
      action: 'hold',
      reasons: ['during_call'],
    });
  });

  it('flags at the threshold, not below it', () => {
    expect(decide({}, { guard: { score: 0.49 } })).toEqual({ action: 'allow' });
    expect(decide({}, { guard: { score: 0.5 } })).toEqual({
      action: 'hold',
      reasons: ['guard_flagged'],
    });
  });

  it('reports reasons in one stable order', () => {
    const result = decide(
      { category: 'crypto', onCall: true, payeeKnown: false, amountCents: toCents(99_900) },
      { guard: { score: 1 } },
    );
    expect(result.action).toBe('hold');
    if (result.action === 'hold') {
      expect(result.reasons).toEqual(HOLD_REASONS.filter((r) => result.reasons.includes(r)));
    }
  });
});

describe('freeze and the cash-then-gift-card sequence', () => {
  const run = (payment: Partial<PaymentFacts>, circle: { frozen: boolean; atmCashRecently: boolean }) =>
    decideHold({ payment: { ...ordinary, ...payment }, holdOverCents: DEFAULT_HOLD_OVER_CENTS, baseline: null, guard: null, circle });

  it('holds even the electricity bill while the family has frozen spending', () => {
    expect(run({}, { frozen: true, atmCashRecently: false })).toEqual({ action: 'hold', reasons: ['frozen'] });
  });

  it('adds the sequence reason to a gift card bought soon after ATM cash', () => {
    expect(run({ category: 'gift_cards', payeeKind: 'merchant' }, { frozen: false, atmCashRecently: true }))
      .toEqual({ action: 'hold', reasons: ['gift_card', 'cash_then_gift_card'] });
  });

  it('ATM cash alone does not hold anything else', () => {
    expect(run({}, { frozen: false, atmCashRecently: true })).toEqual({ action: 'allow' });
  });
});

describe('family settings', () => {
  const big = { ...ordinary, amountCents: toCents(500_000) };
  const withLimit = (payment: PaymentFacts, holdOverCents: number) =>
    decideHold({ payment, holdOverCents: toCents(holdOverCents), baseline: null, guard: null });

  it('hold limit off skips over_limit, and the payment goes through', () => {
    expect(withLimit(big, POLICY_OFF_CENTS)).toEqual({ action: 'allow' });
    expect(withLimit({ ...big, amountCents: toCents(200_000_000) }, POLICY_OFF_CENTS)).toEqual({ action: 'allow' });
  });

  it('hold limit off still holds a gift card and every other scam rule', () => {
    expect(withLimit({ ...big, category: 'gift_cards', payeeKnown: false, onCall: true }, POLICY_OFF_CENTS))
      .toEqual({ action: 'hold', reasons: ['gift_card', 'new_payee', 'during_call'] });
  });

  it('a changed hold limit takes effect', () => {
    expect(withLimit(big, 600_000)).toEqual({ action: 'allow' });
    expect(withLimit(big, 400_000)).toEqual({ action: 'hold', reasons: ['over_limit'] });
  });

  it('two approvers on keeps 2 over the amount, 1 at or under it', () => {
    expect(approvalsRequired(toCents(100_001), DEFAULT_TWO_APPROVALS_OVER_CENTS)).toBe(2);
    expect(approvalsRequired(toCents(100_000), DEFAULT_TWO_APPROVALS_OVER_CENTS)).toBe(1);
  });

  it('two approvers off gives 1 over the old amount, even for huge payments', () => {
    expect(approvalsRequired(toCents(100_001), POLICY_OFF_CENTS)).toBe(1);
    expect(approvalsRequired(toCents(200_000_000), POLICY_OFF_CENTS)).toBe(1);
  });

  it('a changed two-approver amount takes effect', () => {
    expect(approvalsRequired(toCents(60_000), toCents(50_000))).toBe(2);
    expect(approvalsRequired(toCents(150_000), toCents(200_000))).toBe(1);
  });
});
