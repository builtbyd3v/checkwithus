// The family dashboard's reads: alerts, "her usual", and the speed card.
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { familyAlerts } from '@/lib/family';
import { WEEKLY_SQL } from '@/lib/spending';
import { measureSpeed, WEEKLY_RAW_SQL } from '@/lib/speed';
import { herUsual } from '@/lib/usual';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const sub = `test|dash-${crypto.randomUUID()}`;
const circleIds: string[] = [];
const held: Record<string, string> = {};

beforeAll(async () => {
  for (const name of ['Rosa', 'Leo']) {
    const { rows } = await pool.query<{ id: string }>(
      `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
       values ($1, 'test-customer', $2, 0) returning id`,
      [`${name} Test (synthetic)`, crypto.randomUUID()],
    );
    circleIds.push(rows[0]!.id);
    await pool.query(`insert into circle_members (circle_id, auth0_sub, display_name) values ($1, $2, 'Maria Test')`, [rows[0]!.id, sub]);
  }
  const [rosa, leo] = circleIds as [string, string];
  await pool.query(
    `insert into alerts (circle_id, kind, detail, created_at) values
       ($1, 'ask_family', null, now() - interval '1 hour'),
       ($1, 'bank_during_call', 'At a bank (Seven Corners 1 ATM) while on a phone call.', now()),
       ($2, 'ask_family', null, now() - interval '5 minutes')`, [rosa, leo],
  );
  // Rosa: $20 at Target on 4 days, $40 at Sunrise Grocery on a 5th. 5 active days, $120 total.
  await pool.query(
    `insert into spending (occurred_at, circle_id, amount_cents, category, payee_name)
     select now() - make_interval(days => d), $1, case when d = 5 then 4000 else 2000 end, 'groceries',
            case when d = 5 then 'Sunrise Grocery' else 'Target' end
       from generate_series(1, 5) d`, [rosa],
  );
  // Backdated rows land in already-materialized buckets, which real-time
  // aggregation skips until a refresh (as seed-demo does).
  for (const view of ['spending_daily', 'spending_weekly', 'spending_payee_daily']) {
    await pool.query(`call refresh_continuous_aggregate('${view}', now() - interval '30 days', now() + interval '1 day')`);
  }
  for (const [key, circle, payee, cents] of [
    ['target', rosa, 'Target', 12000], ['newShop', rosa, 'Gift Shop', 30000],
    ['grocery', rosa, 'Sunrise Grocery', 5000], ['leo', leo, 'Target', 12000],
  ] as const) {
    const { rows } = await pool.query<{ id: string }>(
      `insert into payments (circle_id, idempotency_key, amount_cents, payee_name, payee_kind,
         category, on_call, payee_known, status, expires_at)
       values ($1, $2, $3, $4, 'merchant', 'shopping', false, false, 'held', now() + interval '5 minutes') returning id`,
      [circle, `test-usual-${key}`, cents, payee],
    );
    held[key] = rows[0]!.id;
  }
});

afterAll(async () => {
  await pool.query('delete from circles where id = any($1::uuid[])', [circleIds]);
  await pool.end();
});

it('lists one circle\'s alerts newest first, and only for members', async () => {
  const alerts = await familyAlerts(pool, sub, circleIds[0]);
  expect(alerts.map((a) => a.kind)).toEqual(['bank_during_call', 'ask_family']);
  expect(alerts[0]!.detail).toContain('Seven Corners 1 ATM');
  expect(await familyAlerts(pool, sub)).toHaveLength(3);
  expect(await familyAlerts(pool, 'test|stranger', circleIds[0])).toEqual([]);
});

it('computes "her usual" with integer math from the per-payee aggregate', async () => {
  const rows = await herUsual(pool, circleIds[0]!, [held.target!, held.newShop!, held.grocery!, held.leo!]);
  const by = new Map(rows.map((r) => [r.payment_id, r]));
  // Target: $120 vs $20 a visit = 6x. Daily: 5 days, $120, so $24 a day.
  expect(by.get(held.target!)).toMatchObject({ payee_times: 6, daily_times: 5 });
  // No history at this payee: $300 vs $24 a day = 12.5, rounded half up.
  expect(by.get(held.newShop!)).toMatchObject({ payee_times: null, daily_times: 13 });
  // One past visit is too few for a payee baseline: $50 vs $24 a day = 2.08.
  expect(by.get(held.grocery!)).toMatchObject({ payee_times: null, daily_times: 2 });
  // Another circle's payment is never read through this one.
  expect(by.has(held.leo!)).toBe(false);
  // Leo has no history at all: nothing to say.
  expect(await herUsual(pool, circleIds[1]!, [held.leo!])).toEqual([{ payment_id: held.leo, payee_times: null, daily_times: null }]);
});

it('times the weekly query on the aggregate and on raw rows, which give the same answer', async () => {
  const now = new Date();
  const sorted = (rows: { weeks_ago: number }[]) => rows.sort((a, b) => a.weeks_ago - b.weeks_ago);
  const agg = await pool.query<{ weeks_ago: number; total_cents: string }>(WEEKLY_SQL, [circleIds[0], now]);
  const raw = await pool.query<{ weeks_ago: number; total_cents: string }>(WEEKLY_RAW_SQL, [circleIds[0], now]);
  expect(sorted(raw.rows)).toEqual(sorted(agg.rows));
  expect(agg.rows.reduce((sum, r) => sum + Number(r.total_cents), 0)).toBe(12000);

  const speed = await measureSpeed(pool, circleIds[0]!, now);
  expect(speed.aggregateMs).toBeGreaterThan(0);
  expect(speed.rawMs).toBeGreaterThan(0);
  if (speed.compression) expect(speed.compression.afterBytes).toBeGreaterThan(0);
});
