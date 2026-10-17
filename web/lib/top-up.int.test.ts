/**
 * Family top-up (#13) against the real database, with an in-memory Nessie. `npm run test:db`.
 */
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { toCents } from '@/lib/money';
import { createNessieClient } from '@/lib/nessie/client';
import { createFreezeService } from '@/lib/freeze';
import { createTopUpService } from '@/lib/top-up';
import { createFakeNessie, type FakeNessie } from '@/test/fake-nessie';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const APPROVER = `test|topup-approver-${crypto.randomUUID()}`;
const VIEWER = `test|topup-viewer-${crypto.randomUUID()}`;
const circles: string[] = [];
let fake: FakeNessie;
let service: ReturnType<typeof createTopUpService>;
let freezer: ReturnType<typeof createFreezeService>;

const fresh = () => Math.floor(Date.now() / 1000);
const key = () => `topup-${crypto.randomUUID()}`;
const transfers = () => fake.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/transfers'));

async function makeCircle(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
     values ('Rosa Top-up Test (synthetic)', 'test-customer', $1, 500000) returning id`,
    ['test-account-' + crypto.randomUUID()],
  );
  circles.push(rows[0]!.id);
  await pool.query(
    `insert into circle_members (circle_id, auth0_sub, display_name, role)
     values ($1, $2, 'Maria', 'approver'), ($1, $3, 'Leo', 'viewer')`,
    [rows[0]!.id, APPROVER, VIEWER],
  );
  return rows[0]!.id;
}

afterAll(async () => {
  await pool.query('delete from circles where id = any($1::uuid[])', [circles]);
  await pool.end();
});
beforeEach(() => {
  fake = createFakeNessie();
  const nessie = createNessieClient({ key: 'test-key', fetch: fake.fetch, sleep: async () => {} });
  service = createTopUpService({ pool, nessie });
  freezer = createFreezeService({ pool, nessie });
});

describe('Family top-up', () => {
  it('sends one transfer from the member\'s own Nessie account, exactly once, and the balance grows', async () => {
    const circleId = await makeCircle();
    const input = { amountCents: toCents(10_000), idempotencyKey: key() };
    const first = await service.topUp(APPROVER, fresh(), circleId, input);
    expect(first).toMatchObject({ movedCents: 10_000, status: 'sent' });
    // A retry after a lost response, and two more at once: same answer, nothing sent again.
    const again = await Promise.all([1, 2].map(() => service.topUp(APPROVER, fresh(), circleId, input)));
    expect(again).toEqual([first, first]);
    expect(transfers()).toHaveLength(1);

    // The family member's own customer and account, opened at $0, pay for it.
    const { rows } = await pool.query<{ nessie_account_id: string; spending: string }>(
      `select m.nessie_account_id, c.nessie_account_id as spending from circle_members m join circles c on c.id = m.circle_id
        where m.auth0_sub = $1 and m.circle_id = $2`, [APPROVER, circleId],
    );
    expect(fake.accounts.find((a) => a._id === rows[0]!.nessie_account_id)).toMatchObject({ type: 'Checking', balance: 0 });
    expect(transfers()[0]!.path).toBe(`/accounts/${rows[0]!.nessie_account_id}/transfers`);
    expect(transfers()[0]!.body).toMatchObject({ amount: 100, status: 'completed' });
    expect(String((transfers()[0]!.body as { description: string }).description)).toContain(rows[0]!.spending);

    // A second top-up reuses the member's account. Freeze then moves the topped-up money too.
    await service.topUp(APPROVER, fresh(), circleId, { amountCents: toCents(5_000), idempotencyKey: key() });
    expect(fake.accounts).toHaveLength(1);
    expect(await freezer.freeze(APPROVER, circleId)).toEqual({ frozen: true, movedCents: 515_000 });
  });

  it('needs an approver with a fresh login, whole dollars, an unfrozen circle and an unused key', async () => {
    const circleId = await makeCircle();
    const input = { amountCents: toCents(10_000), idempotencyKey: key() };
    await expect(service.topUp(VIEWER, fresh(), circleId, input)).rejects.toMatchObject({ status: 403, code: 'permission_required' });
    await expect(service.topUp(APPROVER, fresh() - 600, circleId, input)).rejects.toMatchObject({ status: 403, code: 'step_up_required' });
    await expect(service.topUp(APPROVER, fresh(), circleId, { ...input, amountCents: toCents(10_050) }))
      .rejects.toMatchObject({ status: 422, code: 'whole_dollars_only' });
    await service.topUp(APPROVER, fresh(), circleId, input);
    await expect(service.topUp(APPROVER, fresh(), circleId, { ...input, amountCents: toCents(20_000) }))
      .rejects.toMatchObject({ status: 409, code: 'idempotency_conflict' });
    await freezer.freeze(APPROVER, circleId);
    await expect(service.topUp(APPROVER, fresh(), circleId, { ...input, idempotencyKey: key() }))
      .rejects.toMatchObject({ status: 409, code: 'frozen' });
    expect(transfers().filter((t) => !String((t.body as { description: string }).description).startsWith('Freeze'))).toHaveLength(1);
  });

  it('a refused send does not count and may be retried; an unknown outcome neither counts nor is resent', async () => {
    const circleId = await makeCircle();
    const refused = { amountCents: toCents(10_000), idempotencyKey: key() };
    fake.failNext('/transfers', 'rejected400');
    await expect(service.topUp(APPROVER, fresh(), circleId, refused)).rejects.toMatchObject({ status: 502, code: 'bank_error' });
    expect(fake.records.filter((r) => r.kind === 'transfers')).toHaveLength(0);
    expect(await service.topUp(APPROVER, fresh(), circleId, refused)).toMatchObject({ status: 'sent', movedCents: 10_000 });

    const unknown = { amountCents: toCents(30_000), idempotencyKey: key() };
    fake.failNext('/transfers', 'timeout');
    expect(await service.topUp(APPROVER, fresh(), circleId, unknown)).toMatchObject({ status: 'sending', movedCents: 30_000 });
    expect(await service.topUp(APPROVER, fresh(), circleId, unknown)).toMatchObject({ status: 'sending' });
    expect(transfers()).toHaveLength(3);
    // 5,000 opening + 100. The unconfirmed 300 raises nothing and Freeze does not sweep it.
    expect(await freezer.freeze(APPROVER, circleId)).toEqual({ frozen: true, movedCents: 510_000 });
  });

  it('checks the key and the freeze before opening a Nessie account', async () => {
    const circleId = await makeCircle();
    await pool.query(
      `insert into ledger_credits (circle_id, kind, amount_cents, status, idempotency_key) values ($1, 'deposit', 10000, 'sent', 'seed:deposit:1')`,
      [circleId],
    );
    await expect(service.topUp(APPROVER, fresh(), circleId, { amountCents: toCents(10_000), idempotencyKey: 'seed:deposit:1' }))
      .rejects.toMatchObject({ status: 409, code: 'idempotency_conflict' });
    await pool.query('update circles set frozen = true where id = $1', [circleId]);
    await expect(service.topUp(APPROVER, fresh(), circleId, { amountCents: toCents(10_000), idempotencyKey: key() }))
      .rejects.toMatchObject({ status: 409, code: 'frozen' });
    expect(fake.calls.filter((c) => c.method === 'POST')).toEqual([]);
  });
});
