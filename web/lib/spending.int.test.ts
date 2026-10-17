import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { weeklySpending } from '@/lib/spending';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
let circleId = '';

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
     values ('Weeks Test (synthetic)', 'test-customer', $1, 0) returning id`,
    [crypto.randomUUID()],
  );
  circleId = rows[0]!.id;
  // New York clocks fall back at 2026-11-01 06:00Z (02:00 EDT becomes 01:00 EST).
  await pool.query(
    `insert into spending (occurred_at, circle_id, amount_cents, category, payee_name)
     select at, $1, cents, 'groceries', 'Sunrise Grocery'
       from (values
         ('2026-10-26T03:30Z'::timestamptz, 50),  -- Sun Oct 25 23:30 EDT
         ('2026-11-01T05:30Z', 400),              -- Sun Nov 1 01:30 EDT, before the change
         ('2026-11-02T04:30Z', 1000),             -- Sun Nov 1 23:30 EST, after it
         ('2026-11-02T05:30Z', 2000)              -- Mon Nov 2 00:30 EST
       ) as v (at, cents)`,
    [circleId],
  );
});

afterAll(async () => {
  await pool.query('delete from circles where id = $1', [circleId]);
  await pool.end();
});

it('buckets Monday weeks in New York time across the DST change', async () => {
  const rows = await weeklySpending(pool, circleId, new Date('2026-11-04T17:00Z'));
  expect(rows.sort((a, b) => a.weeks_ago - b.weeks_ago)).toEqual([
    { weeks_ago: 0, total_cents: '2000' },
    { weeks_ago: 1, total_cents: '1400' },
    { weeks_ago: 2, total_cents: '50' },
  ]);
});
