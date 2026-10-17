import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { learningLabels, type LabelCursor } from '@/lib/device-data';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
let circleId: string;
beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
     values ('Labels Test (synthetic)', 'test-customer', $1, 0) returning id`, [crypto.randomUUID()],
  );
  circleId = rows[0]!.id;
  await pool.query(
    `insert into payments (circle_id, idempotency_key, amount_cents, payee_name, payee_kind,
       category, on_call, payee_known, guard_score, status, decided_via, decided_at)
     select $1, 'test-label-' || n, 100, 'Synthetic shop', 'merchant', 'shopping', false, false,
       0.9, 'denied', 'app', '2099-01-01T00:00:00.123456Z'::timestamptz
         + case when n = 202 then interval '1 microsecond' else interval '0' end
     from generate_series(1, 202) n`, [circleId],
  );
});
afterAll(async () => {
  if (circleId) await pool.query('delete from circles where id = $1', [circleId]);
  await pool.end();
});

it('pages through equal timestamps without losing labels or rounding the cursor', async () => {
  const first = await learningLabels(pool, circleId, new Date('2099-01-01T00:00:00Z'));
  expect(first.labels).toHaveLength(200);
  expect(first.hasMore).toBe(true);
  const cursor: LabelCursor = JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString('utf8'));
  expect(cursor.decidedAt).toBe('2099-01-01T00:00:00.123456Z');
  const second = await learningLabels(pool, circleId, null, cursor);
  expect(second.labels).toHaveLength(2);
  expect(second.hasMore).toBe(false);
  expect(new Set([...first.labels, ...second.labels].map((label) => label.paymentId)).size).toBe(202);
  const checkpoint: LabelCursor = JSON.parse(Buffer.from(second.nextCursor!, 'base64url').toString('utf8'));
  expect(checkpoint.decidedAt).toBe('2099-01-01T00:00:00.123457Z');
  const empty = await learningLabels(pool, circleId, null, checkpoint);
  expect(empty).toEqual({ labels: [], nextCursor: null, hasMore: false });
});

it('keeps a cursor scoped to the authenticated device circle', async () => {
  const first = await learningLabels(pool, circleId, null);
  const cursor: LabelCursor = JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString('utf8'));
  expect((await learningLabels(pool, crypto.randomUUID(), null, cursor)).labels).toEqual([]);
});
