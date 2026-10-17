import type { Queryable } from '@/lib/db';

/**
 * "About 6x Rosa's usual" for held payments, from the spending_payee_daily
 * continuous aggregate. Display only: the hold itself was already decided by
 * lib/rules.ts.
 *
 * times = amount / (history total / history count), rounded half up, all in
 * integer cents in SQL. Null when there is too little history to say.
 */
export const USUAL = {
  /** Fewer past payments to this payee than this: compare with daily spending instead. */
  minPayeePayments: 3,
  /** Fewer active days than this: say nothing (same bar as the unusual-spending rule). */
  minActiveDays: 5,
  /** Below this the payment is not much above usual, so the line would be noise. */
  showFromTimes: 2,
} as const;

export type UsualRow = { payment_id: string; payee_times: number | null; daily_times: number | null };

export async function herUsual(db: Queryable, circleId: string, paymentIds: string[]): Promise<UsualRow[]> {
  if (!paymentIds.length) return [];
  const { rows } = await db.query<UsualRow>(
    `with held as (
       select id, payee_name, amount_cents from payments where circle_id = $1 and id = any($2::uuid[])
     ), payee as (
       select payee_name, sum(total_cents)::bigint as total, sum(payments)::bigint as n
         from spending_payee_daily
        where circle_id = $1 and day >= now() - interval '1 year'
          and payee_name in (select payee_name from held)
        group by payee_name
     ), daily as (
       select sum(total_cents)::bigint as total, count(distinct day) as days
         from spending_payee_daily where circle_id = $1 and day >= now() - interval '90 days'
     )
     select h.id as payment_id,
            case when p.n >= $3 and p.total > 0
              then ((2 * h.amount_cents * p.n + p.total) / (2 * p.total))::int end as payee_times,
            case when d.days >= $4 and d.total > 0
              then ((2 * h.amount_cents * d.days + d.total) / (2 * d.total))::int end as daily_times
       from held h left join payee p using (payee_name) cross join daily d`,
    [circleId, paymentIds, USUAL.minPayeePayments, USUAL.minActiveDays],
  );
  return rows;
}

/** One plain line for the family, or null. A payee with history never falls back to the daily comparison. */
export function usualLabel(
  row: Pick<UsualRow, 'payee_times' | 'daily_times'> | undefined, payeeName: string, firstName: string,
): string | null {
  if (!row) return null;
  if (row.payee_times !== null) {
    return row.payee_times >= USUAL.showFromTimes ? `About ${row.payee_times}x ${firstName}’s usual at ${payeeName}` : null;
  }
  return row.daily_times !== null && row.daily_times >= USUAL.showFromTimes
    ? `About ${row.daily_times}x ${firstName}’s usual daily spending` : null;
}
