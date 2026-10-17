import type { Queryable } from '@/lib/db';

export type WeekRow = { weeks_ago: number; total_cents: string };

/** The dashboard's weekly chart query, exported so lib/speed.ts times the exact same SQL. */
export const WEEKLY_SQL = `select round(extract(epoch from time_bucket(interval '7 days', $2::timestamptz, 'America/New_York') - week) / 604800)::int as weeks_ago,
            sum(total_cents)::text as total_cents
       from spending_weekly where circle_id = $1 and week > $2::timestamptz - interval '13 weeks' and week <= $2::timestamptz
      group by week`;

/**
 * Spending per Monday week (America/New_York) over the 13 weeks up to `now`,
 * from the spending_weekly continuous aggregate. weeks_ago 0 is this week.
 * Callers check membership first.
 */
export async function weeklySpending(db: Queryable, circleId: string, now = new Date()) {
  const { rows } = await db.query<WeekRow>(WEEKLY_SQL, [circleId, now]);
  return rows;
}
