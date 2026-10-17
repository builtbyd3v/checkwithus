/**
 * The bill-pay agent (#19). It finds the circle's known billers whose next bill
 * is due soon and ASKS to pay each one. It decides nothing about money: every
 * proposal goes through the same createPayment rules as the phone. Inside a
 * family allowance it pays with no push; outside, the payment is held and the
 * family is asked (CIBA or the family app).
 *
 * No AI model. "Due soon" is a fixed rule: a biller's next bill is due one month
 * after the latest bill we paid (its due date, or the day it was paid), for the
 * last amount. A biller paid in the last 20 days, by the phone or the agent, is
 * skipped. Bill data never leaves our server; Nessie is the bank.
 */
import 'server-only';
import type pg from 'pg';
import { CATEGORIES, type Category } from '@/lib/categories';
import { toCents } from '@/lib/money';
import { normalizeName } from '@/lib/names';
import { PaymentError, type Payment, type PaymentErrorCode, type PaymentService, type PaymentStatus } from '@/lib/payments';

/** Last bill's YYYY-MM-DD plus one month, clamped to the month's end (Jan 31 -> Feb 28). */
export function nextDueDate(lastDue: string): string {
  const [y, m, d] = lastDue.split('-').map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/** YYYY-MM-DD in the circle's time zone. */
function localDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Skip a biller paid this recently, by anyone: never two payments in one cycle. */
const PAID_RECENTLY_DAYS = 20;

/** Why the agent did not ask again for a bill it already asked about. */
const SKIPPED = { denied: 'family_said_no', expired: 'expired', failed: 'failed' } as const;
export type SkipReason = (typeof SKIPPED)[keyof typeof SKIPPED];

export type AgentProposal = {
  payeeName: string;
  amountCents: number;
  dueDate: string;
  /** The payment, or null when skipped or refused. */
  payment: Payment | null;
  skipped: SkipReason | null;
  /** A PaymentError for this bill; the run goes on with the next one. */
  error: PaymentErrorCode | null;
};

export async function runBillAgent(
  deps: { pool: pg.Pool; payments: PaymentService },
  input: { circleId: string; dueWithinDays: number },
): Promise<AgentProposal[]> {
  const { pool } = deps;
  const circle = await pool.query<{ time_zone: string }>('select time_zone from circles where id = $1', [input.circleId]);
  if (!circle.rows[0]) return [];
  const timeZone = circle.rows[0].time_zone;
  const horizon = addDays(localDate(new Date(), timeZone), input.dueWithinDays);

  const billers = await pool.query<{ id: string; name: string; category: string }>(
    `select id, name, category from payees where circle_id = $1 and kind = 'biller' order by name`, [input.circleId],
  );
  const categories = billers.rows.map(b => b.category).filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
  if (!categories.length) return [];
  const history = await pool.query<{ payee_name: string; category: string; amount_cents: number; occurred_at: Date; due: string | null; recent: boolean }>(
    `select s.payee_name, s.category, s.amount_cents, s.occurred_at, p.bill_due_date::text as due,
            s.occurred_at > now() - make_interval(days => $3) as recent
       from spending s left join payments p on p.id = s.payment_id
      where s.circle_id = $1 and s.category = any($2::text[]) and s.occurred_at > now() - interval '120 days'
      order by s.occurred_at desc`,
    [input.circleId, categories, PAID_RECENTLY_DAYS],
  );

  const proposals: AgentProposal[] = [];
  for (const biller of billers.rows) {
    const category = biller.category as Category;
    if (!categories.includes(category)) continue;
    // Spending has no payee id, so match the biller by name and category.
    const bills = history.rows.filter(r => r.category === category && normalizeName(r.payee_name) === normalizeName(biller.name));
    if (!bills.length || bills.some(r => r.recent)) continue;
    // The cycle is the latest due date covered (a prepaid bill counts as its due date).
    const lastDue = bills.map(r => r.due ?? localDate(r.occurred_at, timeZone)).sort().at(-1)!;
    const dueDate = nextDueDate(lastDue);
    if (dueDate > horizon) continue;
    const amountCents = toCents(bills[0]!.amount_cents);
    const proposal = { payeeName: biller.name, amountCents, dueDate, payment: null, skipped: null, error: null };
    // One proposal per biller per due date. A rerun replays a held or paid one;
    // a no from the family (or a lapsed or failed one) is not asked again.
    const idempotencyKey = `agent-bill:${biller.id}:${dueDate}`;
    const before = await pool.query<{ status: PaymentStatus }>(
      'select status from payments where circle_id = $1 and idempotency_key = $2', [input.circleId, idempotencyKey],
    );
    const status = before.rows[0]?.status;
    if (status === 'denied' || status === 'expired' || status === 'failed') {
      proposals.push({ ...proposal, skipped: SKIPPED[status] });
      continue;
    }
    try {
      const payment = await deps.payments.createPayment(input.circleId, {
        idempotencyKey,
        amountCents,
        payeeName: biller.name,
        payeeKind: 'biller',
        category,
        onCall: false,
        guard: null,
        explanation: `The bill-pay agent asked to pay ${biller.name}, due ${dueDate}. Same amount as the last bill.`,
        billDueDate: dueDate,
        initiatedBy: 'agent',
      });
      proposals.push({ ...proposal, payment });
    } catch (error) {
      if (!(error instanceof PaymentError)) throw error;
      proposals.push({ ...proposal, error: error.code });
    }
  }
  return proposals;
}

/** Circles whose family granted at least one live allowance: the agent's default reach. */
export async function circlesWithAllowances(pool: pg.Pool): Promise<string[]> {
  const { rows } = await pool.query<{ circle_id: string }>(
    `select distinct circle_id from allowances where revoked_at is null and expires_at > now()`,
  );
  return rows.map(r => r.circle_id);
}
