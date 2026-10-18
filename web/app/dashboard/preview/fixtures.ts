import { toCents } from '@/lib/money';
import type { Payment } from '@/lib/payments';
import { usualLabel } from '@/lib/usual';
import { familyPaymentView } from '@/lib/views';
import type { DashboardData } from '../view';

/** Synthetic family for the local preview only. Nothing here reaches a database or a bank. */
export const PROTECTED_NAME = 'Sam Alvarez';
const circleId = '00000000-0000-4000-8000-000000000001';
const minutes = (now: Date, count: number) => new Date(now.getTime() - count * 60_000);

function payment(id: number, fields: Partial<Payment> & Pick<Payment, 'payeeName' | 'amountCents' | 'status' | 'createdAt'>, decidedByName: string | null = null) {
  return familyPaymentView({
    id: `11111111-1111-4111-8111-${String(id).padStart(12, '0')}`, circleId, payeeKind: 'merchant', category: 'groceries', onCall: false, payeeKnown: true,
    guardScore: null, guardModelVersion: null, explanation: null, holdReasons: [], expiresAt: null, decidedBy: null, decidedVia: null, decidedAt: null,
    nessieKind: 'purchase', nessieId: null, failure: null, approvalsRequired: 1, initiatedBy: 'device', ...fields,
  }, { protectedName: PROTECTED_NAME, decidedByName });
}

export function heldFixture(now: Date, expiresAt: string) {
  return payment(1, {
    payeeName: 'Gift card store', amountCents: toCents(50000), status: 'held', createdAt: minutes(now, 2), category: 'shopping', onCall: true, payeeKnown: false,
    holdReasons: ['gift_card', 'cash_then_gift_card', 'new_payee', 'over_limit', 'during_call'], expiresAt: new Date(expiresAt),
    explanation: 'A gift card bought during a phone call, right after cash at an ATM. Call before deciding.',
  });
}

export function dashboardFixture(nowIso: string, expiresAt: string): Omit<DashboardData, 'decide'> {
  const now = new Date(nowIso);
  const held = heldFixture(now, expiresAt);
  const firstName = PROTECTED_NAME.split(' ')[0]!;
  const recent = [
    held,
    payment(2, { payeeName: 'Sunrise Grocery', amountCents: toCents(4618), status: 'paid', createdAt: minutes(now, 220) }),
    payment(3, { payeeName: 'City Power & Light', amountCents: toCents(12840), status: 'paid', createdAt: minutes(now, 360), category: 'utilities', payeeKind: 'biller', initiatedBy: 'agent', allowanceId: 'a1' }),
    payment(4, { payeeName: 'Neighborhood Pharmacy', amountCents: toCents(2375), status: 'paid', createdAt: minutes(now, 1500), category: 'pharmacy' }),
    payment(5, { payeeName: 'Medicare Refund Dept', amountCents: toCents(74000), status: 'denied', createdAt: minutes(now, 11600), decidedAt: minutes(now, 11590), holdReasons: ['wire_transfer', 'new_payee'], category: 'other' }, 'Jordan'),
  ];
  return {
    now, firstName, circles: [{ circleId, protectedName: PROTECTED_NAME }], activeCircleId: circleId,
    role: 'approver', canApproveHere: true, frozen: false, vaultCents: 0, holdDollars: '300.00',
    held: [held], recent,
    alerts: [{ id: 'alert-1', kind: 'bank_during_call', detail: 'At a bank (Main St ATM) while on a phone call.', createdAt: minutes(now, 6).toISOString() }],
    weeks: [19335, 3890, 5210, 4460, 19470, 4730, 3695, 4940, 19375, 4070, 5125, 3860, 19833],
    categories: [{ label: 'Groceries', cents: 57008 }, { label: 'Utilities', cents: 51485 }, { label: 'Pharmacy', cents: 9500 }],
    usual: new Map([[held.id, { line: usualLabel({ payee_times: null, daily_times: 9 }, held.payee.name, firstName)!, times: 9, kind: 'daily' as const }]]),
    sequences: new Map([[held.id, { cashAt: minutes(now, 23).toISOString(), paymentAt: minutes(now, 2).toISOString(), cashCents: toCents(20000), atmName: 'Main St ATM (synthetic)' }]]),
    speed: { aggregateMs: 0.84, rawMs: 37.9, compression: { beforeBytes: 9_200_000, afterBytes: 1_000_000 }, measuredAt: minutes(now, 1) },
    benchmarkLine: 'Benchmark numbers come from the recorded report on the live dashboard.',
    members: [{ id: 'm1', display_name: 'Jordan' }, { id: 'm2', display_name: 'Lee' }],
    payees: [
      { id: 'p1', name: 'City Power & Light', categoryLabel: 'Utilities' },
      { id: 'p2', name: 'Neighborhood Pharmacy', categoryLabel: 'Pharmacy' },
      { id: 'p3', name: 'Sunrise Grocery', categoryLabel: 'Groceries' },
    ],
  };
}
