/**
 * The dashboard's "How fast this page is" card (#6): the weekly chart query
 * timed against the spending_weekly continuous aggregate and against raw
 * `spending` rows, on this circle's real data. Server time only (planning +
 * execution from `explain analyze`), one run each, cached 60 s per circle so
 * reloads do not hammer the database. Measured, never made up.
 */
import type pg from 'pg';
import { transaction, type Queryable } from '@/lib/db';
import { WEEKLY_SQL } from '@/lib/spending';

/** The same answer as WEEKLY_SQL, bucketed from raw payments. The inner bound only lets Postgres skip old chunks. */
export const WEEKLY_RAW_SQL = `select round(extract(epoch from time_bucket(interval '7 days', $2::timestamptz, 'America/New_York') - week) / 604800)::int as weeks_ago,
            sum(amount_cents)::text as total_cents
       from (select time_bucket(interval '7 days', occurred_at, 'America/New_York') as week, amount_cents
               from spending where circle_id = $1 and occurred_at > $2::timestamptz - interval '15 weeks') s
      where week > $2::timestamptz - interval '13 weeks' and week <= $2::timestamptz
      group by week`;

export type Speed = {
  aggregateMs: number;
  rawMs: number;
  /** For the whole `spending` hypertable (every family), not this circle. Null when no chunk is compressed yet. */
  compression: { beforeBytes: number; afterBytes: number } | null;
  measuredAt: Date;
};

type Plan = { 'Planning Time': number; 'Execution Time': number };

async function serverMs(db: Queryable, sql: string, params: unknown[]): Promise<number> {
  const { rows } = await db.query<{ 'QUERY PLAN': Plan[] }>(`explain (analyze, timing off, format json) ${sql}`, params);
  const plan = rows[0]!['QUERY PLAN'][0]!;
  return plan['Planning Time'] + plan['Execution Time'];
}

export async function measureSpeed(db: Queryable, circleId: string, now = new Date()): Promise<Speed> {
  const params = [circleId, now];
  const aggregateMs = await serverMs(db, WEEKLY_SQL, params);
  const rawMs = await serverMs(db, WEEKLY_RAW_SQL, params);
  const { rows } = await db.query<{ before: number | null; after: number | null }>(
    `select sum(before_compression_total_bytes)::float8 as before, sum(after_compression_total_bytes)::float8 as after
       from hypertable_compression_stats('spending')`,
  );
  const { before, after } = rows[0] ?? { before: null, after: null };
  return { aggregateMs, rawMs, compression: before && after ? { beforeBytes: before, afterBytes: after } : null, measuredAt: now };
}

const TTL_MS = 60_000;
/** The card is a bonus: past this, the page renders without it. */
const BUDGET_MS = 500;
// ponytail: per-instance cache; each serverless instance measures on its own.
const cache = new Map<string, { at: number; pending: Promise<Speed | null>; last: Speed | null }>();

/**
 * At most one measurement per circle per minute. A page waits up to BUDGET_MS
 * for it, then shows the previous measurement (labelled with its own time), or
 * nothing on the very first load. A slow one finishes in the background, with
 * statement_timeout capping each query.
 */
export async function cachedSpeed(pool: pg.Pool, circleId: string): Promise<Speed | null> {
  let entry = cache.get(circleId);
  if (!entry || Date.now() - entry.at >= TTL_MS) {
    const pending = transaction(pool, async (client) => {
      await client.query(`set local statement_timeout = ${BUDGET_MS}`);
      return measureSpeed(client, circleId);
    }).catch(() => null);
    const next = { at: Date.now(), pending, last: entry?.last ?? null };
    void pending.then((speed) => { if (speed) next.last = speed; });
    cache.set(circleId, next);
    entry = next;
  }
  let timer: NodeJS.Timeout | undefined;
  const speed = await Promise.race([entry.pending, new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), BUDGET_MS); })]);
  clearTimeout(timer);
  return speed ?? entry.last;
}
