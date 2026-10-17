import type { Queryable } from '@/lib/db';
import { toCents, type Cents } from '@/lib/money';
import { CASH_THEN_GIFT_CARD_WINDOW_SECONDS } from '@/lib/rules';

/** Supporting history for an already-held payment; never changes a decision. */
export const SCAM_SEQUENCE_SQL = `select p.id as payment_id, p.created_at as payment_at,
       cash.occurred_at as cash_at, cash.amount_cents::text as cash_cents,
       cash.payee_name as atm_name
  from payments p
  join lateral (
    select occurred_at, amount_cents, payee_name from spending
     where circle_id = p.circle_id and atm_id is not null
       and occurred_at >= p.created_at - make_interval(secs => $3)
       and occurred_at <= p.created_at
     order by occurred_at desc, nessie_id nulls last, payee_name limit 1
  ) cash on true
 where p.circle_id = $1 and p.id = any($2::uuid[])
   and p.category = 'gift_cards' and 'cash_then_gift_card' = any(p.hold_reasons)`;

export type SequenceRow = {
  payment_id: string; payment_at: Date; cash_at: Date; cash_cents: string; atm_name: string;
};
export type SequenceEvidence = {
  cashAt: string; paymentAt: string; cashCents: Cents; atmName: string;
};

export async function scamSequences(q: Queryable, circleId: string, paymentIds: string[]) {
  if (!paymentIds.length) return new Map<string, SequenceEvidence>();
  const { rows } = await q.query<SequenceRow>(SCAM_SEQUENCE_SQL,
    [circleId, paymentIds, CASH_THEN_GIFT_CARD_WINDOW_SECONDS]);
  return new Map(rows.map((row) => [row.payment_id, {
    cashAt: row.cash_at.toISOString(), paymentAt: row.payment_at.toISOString(),
    cashCents: toCents(Number(row.cash_cents)), atmName: row.atm_name.replace(/^ATM cash:\s*/i, ''),
  }]));
}
