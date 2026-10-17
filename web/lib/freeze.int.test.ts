/**
 * Freeze (#18) and the cash-then-gift-card sequence (#17) against the real
 * database, with an in-memory Nessie. `npm run test:db`.
 */
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { toCents } from '@/lib/money';
import { normalizeName } from '@/lib/names';
import { createNessieClient } from '@/lib/nessie/client';
import { createFreezeService } from '@/lib/freeze';
import { createPaymentService, type NewPayment } from '@/lib/payments';
import { createFakeNessie, type FakeNessie } from '@/test/fake-nessie';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const APPROVER = `test|freeze-approver-${crypto.randomUUID()}`;
const VIEWER = `test|freeze-viewer-${crypto.randomUUID()}`;
const circles: string[] = [];
let fake: FakeNessie;
let payments: ReturnType<typeof createPaymentService>;
let freezer: ReturnType<typeof createFreezeService>;

const key = () => `test-${crypto.randomUUID()}`;
const bill: NewPayment = {
  idempotencyKey: 'unused', amountCents: toCents(8_400), payeeName: 'City Power & Light', payeeKind: 'biller',
  category: 'utilities', onCall: false, guard: null, explanation: null,
};
const giftCard: NewPayment = {
  idempotencyKey: 'unused', amountCents: toCents(20_000), payeeName: 'QuickGift Cards', payeeKind: 'merchant',
  category: 'gift_cards', onCall: false, guard: null, explanation: null,
};

async function makeCircle(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
     values ('Rosa Freeze Test (synthetic)', 'test-customer', $1, 500000) returning id`,
    ['test-account-' + crypto.randomUUID()],
  );
  const id = rows[0]!.id;
  circles.push(id);
  await pool.query(
    `insert into circle_members (circle_id, auth0_sub, display_name, role)
     values ($1, $2, 'Maria', 'approver'), ($1, $3, 'Leo', 'viewer')`,
    [id, APPROVER, VIEWER],
  );
  await pool.query(
    `insert into payees (circle_id, name, normalized_name, kind, category)
     values ($1, 'City Power & Light', $2, 'biller', 'utilities')`,
    [id, normalizeName('City Power & Light')],
  );
  return id;
}

const transfers = () => fake.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/transfers'));

afterAll(async () => {
  await pool.query('delete from circles where id = any($1::uuid[])', [circles]);
  await pool.end();
});
beforeEach(() => {
  fake = createFakeNessie();
  const nessie = createNessieClient({ key: 'test-key', fetch: fake.fetch, sleep: async () => {} });
  payments = createPaymentService({ pool, nessie });
  freezer = createFreezeService({ pool, nessie });
});

describe('Freeze', () => {
  it('moves the whole spending balance to a new vault exactly once, even when tapped twice at once', async () => {
    const circleId = await makeCircle();
    const [first, second] = await Promise.all([freezer.freeze(APPROVER, circleId), freezer.freeze(APPROVER, circleId)]);
    expect(first).toEqual({ frozen: true, movedCents: 500_000 });
    expect(second).toEqual({ frozen: true, movedCents: 500_000 });
    // A retry after the response was lost: same answer, nothing sent.
    expect(await freezer.freeze(APPROVER, circleId)).toEqual({ frozen: true, movedCents: 500_000 });

    expect(fake.accounts).toHaveLength(1);
    expect(fake.accounts[0]).toMatchObject({ type: 'Savings', balance: 0 });
    expect(transfers()).toHaveLength(1);
    expect(transfers()[0]!.body).toMatchObject({ amount: 5000, status: 'completed' });
    const { rows } = await pool.query('select vault_account_id, frozen from circles where id = $1', [circleId]);
    expect(rows[0]).toEqual({ vault_account_id: fake.accounts[0]!._id, frozen: true });
  });

  it('holds every payment while frozen, even a known bill, with a plain reason', async () => {
    const circleId = await makeCircle();
    await freezer.freeze(APPROVER, circleId);
    const payment = await payments.createPayment(circleId, { ...bill, idempotencyKey: key() });
    expect(payment.status).toBe('held');
    expect(payment.holdReasons).toEqual(['frozen']);
    expect(fake.calls.filter((c) => c.path.endsWith('/bills'))).toHaveLength(0);
  });

  it('unfreeze moves the chosen amount back once, and payments flow again', async () => {
    const circleId = await makeCircle();
    await freezer.freeze(APPROVER, circleId);
    await expect(freezer.unfreeze(APPROVER, circleId, toCents(600_000))).rejects.toMatchObject({ status: 409 });
    await expect(freezer.unfreeze(APPROVER, circleId, toCents(10_050))).rejects.toMatchObject({ status: 422 });

    expect(await freezer.unfreeze(APPROVER, circleId, toCents(100_000))).toEqual({ frozen: false, movedCents: 100_000 });
    expect(await freezer.unfreeze(APPROVER, circleId, toCents(100_000))).toEqual({ frozen: false, movedCents: 100_000 });
    expect(transfers()).toHaveLength(2);
    expect(transfers()[1]!.path).toBe(`/accounts/${fake.accounts[0]!._id}/transfers`);
    expect(transfers()[1]!.body).toMatchObject({ amount: 1000 });

    const payment = await payments.createPayment(circleId, { ...bill, idempotencyKey: key() });
    expect(payment.status).toBe('paid');
    // Freezing again sweeps only what is back in spending, less the bill.
    expect(await freezer.freeze(APPROVER, circleId)).toEqual({ frozen: true, movedCents: 91_600 });
    expect(fake.accounts).toHaveLength(1);
  });

  it('a viewer cannot freeze or unfreeze (403), and nothing reaches Nessie', async () => {
    const circleId = await makeCircle();
    await expect(freezer.freeze(VIEWER, circleId)).rejects.toMatchObject({ status: 403 });
    await expect(freezer.unfreeze(VIEWER, circleId, toCents(0))).rejects.toMatchObject({ status: 403 });
    await expect(freezer.freeze('test|stranger', circleId)).rejects.toMatchObject({ status: 404 });
    expect(fake.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('stays frozen when the bank refuses the move, and a second tap retries it', async () => {
    const circleId = await makeCircle();
    fake.failNext('/customers/', 'lostThen500');
    // Account create is a write with an unknown outcome; Nessie lost it.
    await expect(freezer.freeze(APPROVER, circleId)).rejects.toMatchObject({ status: 502 });
    const held = await payments.createPayment(circleId, { ...bill, idempotencyKey: key() });
    expect(held.holdReasons).toEqual(['frozen']);
    expect(await freezer.freeze(APPROVER, circleId)).toEqual({ frozen: true, movedCents: 500_000 });
    expect(transfers()).toHaveLength(1);
  });
});

describe('cash at an ATM, then a gift card', () => {
  async function atmCash(circleId: string, minutesAgo: number) {
    await pool.query(
      `insert into spending (occurred_at, circle_id, amount_cents, category, payee_name, atm_id)
       values (now() - make_interval(mins => $2), $1, 20000, 'other', 'ATM cash: Test ATM', 'test-atm')`,
      [circleId, minutesAgo],
    );
  }

  it('holds a gift card bought within two hours of ATM cash, with the sequence reason', async () => {
    const circleId = await makeCircle();
    await atmCash(circleId, 30);
    const payment = await payments.createPayment(circleId, { ...giftCard, idempotencyKey: key() });
    expect(payment.status).toBe('held');
    expect(payment.holdReasons).toContain('cash_then_gift_card');
  });

  it('does not call it a sequence after two hours', async () => {
    const circleId = await makeCircle();
    await atmCash(circleId, 125);
    const payment = await payments.createPayment(circleId, { ...giftCard, idempotencyKey: key() });
    expect(payment.status).toBe('held');
    expect(payment.holdReasons).toContain('gift_card');
    expect(payment.holdReasons).not.toContain('cash_then_gift_card');
  });
});
