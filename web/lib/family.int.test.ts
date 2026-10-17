import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { familyPayments } from '@/lib/family';
import { createPaymentService } from '@/lib/payments';
import { createNessieClient } from '@/lib/nessie/client';
import { createFakeNessie } from '@/test/fake-nessie';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const sub = `test|dashboard-${crypto.randomUUID()}`;
const circleIds: string[] = [];
const fake = createFakeNessie();
const service = createPaymentService({
  pool, nessie: createNessieClient({ key: 'test-key', fetch: fake.fetch, sleep: async () => {} }),
});

beforeAll(async () => {
  for (const name of ['Rosa', 'Leo']) {
    const { rows } = await pool.query<{ id: string }>(
      `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
       values ($1, 'test-customer', $2, 500000) returning id`,
      [`${name} Test (synthetic)`, crypto.randomUUID()],
    );
    const id = rows[0]!.id;
    circleIds.push(id);
    await pool.query(`insert into circle_members (circle_id, auth0_sub, display_name) values ($1, $2, 'Maria Test')`, [id, sub]);
    // Both circles have more recent terminal payments than the dashboard's limit.
    await pool.query(
      `insert into payments (circle_id, idempotency_key, amount_cents, payee_name, payee_kind,
         category, on_call, payee_known, status, created_at)
       select $1, 'test-recent-' || n, 100, 'Synthetic shop', 'merchant', 'shopping', false, true,
         'denied', now() from generate_series(1, 51) n`, [id],
    );
  }
  await pool.query(
    `insert into payments (circle_id, idempotency_key, amount_cents, payee_name, payee_kind,
       category, on_call, payee_known, status, created_at, expires_at)
     values ($1, 'test-older-hold', 50000, 'Synthetic gift cards', 'merchant', 'gift_cards',
       true, false, 'held', now() - interval '1 minute', now() + interval '4 minutes')`, [circleIds[0]],
  );
});

afterAll(async () => {
  await pool.query('delete from circles where id = any($1::uuid[])', [circleIds]);
  await pool.end();
});

it('finds an older hold independently of the 50 recent payments and other circles', async () => {
  const circleId = circleIds[0]!;
  const recent = await familyPayments(pool, service, sub, { heldOnly: false, circleId });
  expect(recent).toHaveLength(50);
  expect(recent.every((payment) => payment.circleId === circleId && payment.status === 'denied')).toBe(true);
  const held = await familyPayments(pool, service, sub, { heldOnly: true, circleId });
  expect(held).toHaveLength(1);
  expect(held[0]).toMatchObject({ circleId, status: 'held', payee: { name: 'Synthetic gift cards' } });
});

it('does not expose payments for a circle the signed-in user does not belong to', async () => {
  await expect(familyPayments(pool, service, 'test|stranger', { heldOnly: true, circleId: circleIds[0]! }))
    .rejects.toMatchObject({ status: 404 });
});
