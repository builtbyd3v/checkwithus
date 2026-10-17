/**
 * Payment service against the real Tiger Data database, with an in-memory
 * Nessie. Run with `npm run test:db`. Each run builds a throwaway circle and
 * deletes it afterwards (the cascade removes its ledger rows too).
 *
 * These exist because the guarantees that matter most live in SQL: first
 * answer wins, deadlines on the database clock, exactly-once sending, at most
 * three family members, the real-time continuous aggregate baseline.
 */
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { toCents } from '@/lib/money';
import { normalizeName } from '@/lib/names';
import { createNessieClient } from '@/lib/nessie/client';
import { createPaymentService, PaymentError, type NewPayment } from '@/lib/payments';
import { createFakeNessie, type FakeNessie } from '@/test/fake-nessie';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const ACCOUNT = 'test-account-' + crypto.randomUUID();
let circleId: string;
let rosaDaughter: string; // circle member ids
let rosaSon: string;
let fake: FakeNessie;
let service: ReturnType<typeof createPaymentService>;

const scam: Omit<NewPayment, 'idempotencyKey'> = {
  amountCents: toCents(50_000),
  payeeName: 'QuickGift Cards',
  payeeKind: 'merchant',
  category: 'gift_cards',
  onCall: true,
  guard: { score: 0.97, modelVersion: 'guard-test' },
  explanation: 'Caller pressured her to buy gift cards to pay a fake IRS debt.',
};
const electricBill: Omit<NewPayment, 'idempotencyKey'> = {
  amountCents: toCents(8_412),
  payeeName: 'City Power & Light',
  payeeKind: 'biller',
  category: 'utilities',
  onCall: false,
  guard: { score: 0.03, modelVersion: 'guard-test' },
  explanation: null,
};
const key = () => `test-${crypto.randomUUID()}`;

beforeAll(async () => {
  const circle = await pool.query<{ id: string }>(
    `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
     values ('Rosa Test (synthetic)', 'test-customer', $1, 500000) returning id`,
    [ACCOUNT],
  );
  circleId = circle.rows[0]!.id;
  const members = await pool.query<{ id: string }>(
    `insert into circle_members (circle_id, auth0_sub, display_name)
     values ($1, 'test|daughter', 'Maria'), ($1, 'test|son', 'Leo') returning id`,
    [circleId],
  );
  [rosaDaughter, rosaSon] = members.rows.map((r) => r.id) as [string, string];
  await pool.query(
    `insert into payees (circle_id, name, normalized_name, kind, category)
     values ($1, 'City Power & Light', $2, 'biller', 'utilities'),
            ($1, 'Sunrise Grocery', $3, 'merchant', 'groceries')`,
    [circleId, normalizeName('City Power & Light'), normalizeName('Sunrise Grocery')],
  );
});

afterAll(async () => {
  await pool.query('delete from circles where id = $1', [circleId]);
  await pool.query(`delete from nessie_merchants where nessie_merchant_id like 'fake-%'`);
  await pool.end();
});

beforeEach(() => {
  fake = createFakeNessie();
  service = createPaymentService({
    pool,
    nessie: createNessieClient({ key: 'test-key', fetch: fake.fetch, sleep: async () => {} }),
  });
});

describe('the demo', () => {
  it('pays the real electricity bill straight through, cents intact', async () => {
    const payment = await service.createPayment(circleId, { ...electricBill, idempotencyKey: key() });

    expect(payment.status).toBe('paid');
    expect(payment.decidedVia).toBe('rules');
    expect(fake.paymentWrites()).toHaveLength(1);
    const sent = fake.paymentWrites()[0]!.body as Record<string, unknown>;
    expect(sent).toMatchObject({ payment_amount: 84.12, recurring_date: expect.any(Number) });
    expect(String(sent.nickname)).toContain(`[cw:${payment.id}]`);

    const ledger = await pool.query('select amount_cents from spending where payment_id = $1', [
      payment.id,
    ]);
    expect(ledger.rows).toEqual([{ amount_cents: 8_412 }]);
  });

  it('holds the gift-card payment during the scam call, and Nessie never hears of it', async () => {
    const payment = await service.createPayment(circleId, { ...scam, idempotencyKey: key() });

    expect(payment.status).toBe('held');
    expect(payment.holdReasons).toEqual([
      'gift_card',
      'new_payee',
      'over_limit',
      'during_call',
      'guard_flagged',
    ]);
    const secondsLeft = (payment.expiresAt!.getTime() - Date.now()) / 1000;
    expect(secondsLeft).toBeGreaterThan(280);
    expect(secondsLeft).toBeLessThanOrEqual(300);
    expect(fake.paymentWrites()).toHaveLength(0);
  });

  it('a family deny blocks it for good', async () => {
    const held = await service.createPayment(circleId, { ...scam, idempotencyKey: key() });
    const denied = await service.decidePayment({
      paymentId: held.id,
      member: { auth0Sub: 'test|daughter' },
      decision: 'deny',
      via: 'app',
    });
    expect(denied).toMatchObject({ status: 'denied', decidedBy: rosaDaughter, decidedVia: 'app' });
    expect(fake.paymentWrites()).toHaveLength(0);
  });
});

describe('the family circle', () => {
  it('first answer wins when two people answer at the same instant', async () => {
    const held = await service.createPayment(circleId, { ...scam, idempotencyKey: key() });

    const results = await Promise.allSettled([
      service.decidePayment({ paymentId: held.id, member: { memberId: rosaDaughter }, decision: 'approve', via: 'app' }),
      service.decidePayment({ paymentId: held.id, member: { memberId: rosaSon }, decision: 'deny', via: 'app' }),
    ]);

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect((lost[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'already_decided' });

    const final = await service.getPayment(held.id);
    // Whoever won, money moved exactly as often as the answer says.
    expect(fake.paymentWrites()).toHaveLength(final!.status === 'paid' ? 1 : 0);
  });

  it('an answer after the deadline cannot win: no answer means blocked', async () => {
    const held = await service.createPayment(circleId, { ...scam, idempotencyKey: key() });
    await pool.query(`update payments set expires_at = now() - interval '1 second' where id = $1`, [held.id]);

    await expect(
      service.decidePayment({ paymentId: held.id, member: { memberId: rosaDaughter }, decision: 'approve', via: 'app' }),
    ).rejects.toMatchObject({ code: 'expired' });

    const final = await service.getPayment(held.id);
    expect(final).toMatchObject({ status: 'expired', decidedVia: 'timeout' });
    expect(fake.paymentWrites()).toHaveLength(0);
  });

  it('someone outside the circle cannot decide, or even learn the payment exists', async () => {
    const held = await service.createPayment(circleId, { ...scam, idempotencyKey: key() });
    await expect(
      service.decidePayment({ paymentId: held.id, member: { auth0Sub: 'test|stranger' }, decision: 'approve', via: 'app' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('never lets a fourth person in, even when four join at once', async () => {
    const fresh = await pool.query<{ id: string }>(
      `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
       values ('Size Test (synthetic)', 'test', $1, 0) returning id`,
      ['test-account-' + crypto.randomUUID()],
    );
    const id = fresh.rows[0]!.id;
    try {
      const joins = await Promise.allSettled(
        [1, 2, 3, 4].map((n) =>
          pool.query(
            `insert into circle_members (circle_id, auth0_sub, display_name) values ($1, $2, $3)`,
            [id, `test|joiner${n}`, `Joiner ${n}`],
          ),
        ),
      );
      expect(joins.filter((j) => j.status === 'fulfilled')).toHaveLength(3);
      const count = await pool.query('select count(*)::int as n from circle_members where circle_id = $1', [id]);
      expect(count.rows[0].n).toBe(3);

      // The trigger itself lets an existing member's duplicate insert through
      // to ON CONFLICT, instead of calling a full circle full at them.
      const member = await pool.query<{ auth0_sub: string }>(
        'select auth0_sub from circle_members where circle_id = $1 limit 1',
        [id],
      );
      await expect(
        pool.query(
          `insert into circle_members (circle_id, auth0_sub, display_name) values ($1, $2, 'Again')
           on conflict (circle_id, auth0_sub) do nothing`,
          [id, member.rows[0]!.auth0_sub],
        ),
      ).resolves.toMatchObject({ rowCount: 0 });
    } finally {
      await pool.query('delete from circles where id = $1', [id]);
    }
  });
});

describe('money moves exactly once', () => {
  it('a retried request returns the same payment and pays once', async () => {
    const idempotencyKey = key();
    const first = await service.createPayment(circleId, { ...electricBill, idempotencyKey });
    const again = await service.createPayment(circleId, { ...electricBill, idempotencyKey });
    expect(again.id).toBe(first.id);
    expect(fake.paymentWrites()).toHaveLength(1);
  });

  it('refuses to reuse an idempotency key for a different payment', async () => {
    const idempotencyKey = key();
    await service.createPayment(circleId, { ...electricBill, idempotencyKey });
    await expect(
      service.createPayment(circleId, { ...electricBill, amountCents: toCents(9_999), idempotencyKey }),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('refuses a retry whose facts changed, e.g. a call began', async () => {
    const idempotencyKey = key();
    const allowed = await service.createPayment(circleId, { ...electricBill, idempotencyKey });
    expect(allowed.status).toBe('paid');
    await expect(
      service.createPayment(circleId, { ...electricBill, onCall: true, idempotencyKey }),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('accepts a genuine retry, score stored at full precision', async () => {
    const idempotencyKey = key();
    const input = { ...scam, guard: { score: 0.123456789, modelVersion: 'guard-test' }, idempotencyKey };
    const first = await service.createPayment(circleId, input);
    expect(first.guardScore).toBe(0.123456789);
    const again = await service.createPayment(circleId, input);
    expect(again.id).toBe(first.id);
  });

  it('refuses a retry whose score crossed the threshold, even by a hair', async () => {
    // As float4 these two were the same number; the rules treat them differently.
    const idempotencyKey = key();
    const justUnder = { ...electricBill, guard: { score: 0.49999999, modelVersion: 'guard-test' } };
    const allowed = await service.createPayment(circleId, { ...justUnder, idempotencyKey });
    expect(allowed.status).toBe('paid');
    await expect(
      service.createPayment(circleId, {
        ...justUnder,
        guard: { score: 0.5, modelVersion: 'guard-test' },
        idempotencyKey,
      }),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('two simultaneous sends of one approved payment reach Nessie once', async () => {
    const held = await service.createPayment(circleId, { ...scam, idempotencyKey: key() });
    await pool.query(`update payments set status = 'approved', expires_at = null where id = $1`, [held.id]);

    await Promise.all([service.executePayment(held.id), service.executePayment(held.id)]);

    expect(fake.paymentWrites()).toHaveLength(1);
    expect((await service.getPayment(held.id))!.status).toBe('paid');
  });

  it('refuses cents where Nessie would truncate them, before anything is saved', async () => {
    const idempotencyKey = key();
    await expect(
      service.createPayment(circleId, {
        ...scam,
        amountCents: toCents(49_999),
        idempotencyKey,
      }),
    ).rejects.toMatchObject({ code: 'whole_dollars_only' });
    const saved = await pool.query('select 1 from payments where idempotency_key = $1', [idempotencyKey]);
    expect(saved.rowCount).toBe(0);
  });

  it('a send that errors but did reach Nessie is found by its tag, not sent again', async () => {
    fake.failNext('/bills', 'recordedThen500');
    const payment = await service.createPayment(circleId, { ...electricBill, idempotencyKey: key() });

    expect(payment.status).toBe('paid');
    expect(fake.paymentWrites()).toHaveLength(1);
  });

  it('a send with an unknown outcome is not called failed until a slow write would have landed', async () => {
    fake.failNext('/bills', 'lostThen500');
    const payment = await service.createPayment(circleId, { ...electricBill, idempotencyKey: key() });

    // Right after the error: not found yet, but too soon to conclude anything.
    expect(payment.status).toBe('paying');

    // A minute after the send: still "sending". Saying "failed" now would
    // invite a second payment while the first might still land.
    await pool.query(
      `update payments set updated_at = now() - interval '31 seconds', sent_at = now() - interval '1 minute', next_lookup_at = now() where id = $1`,
      [payment.id],
    );
    expect((await service.paymentForCircle(circleId, payment.id)).status).toBe('paying');

    // Ten minutes after the send, still nothing at Nessie: now it is failed.
    await pool.query(
      `update payments set updated_at = now() - interval '31 seconds', sent_at = now() - interval '11 minutes', next_lookup_at = now() where id = $1`,
      [payment.id],
    );
    const settled = await service.paymentForCircle(circleId, payment.id);

    expect(settled.status).toBe('failed');
    expect(fake.paymentWrites()).toHaveLength(1); // looked, never sent again
    const ledger = await pool.query('select 1 from spending where payment_id = $1', [payment.id]);
    expect(ledger.rowCount).toBe(0);
  });

  it('a reconcile racing the original send backs off instead of declaring it failed', async () => {
    fake.failNext('/bills', 'lostThen500');
    const payment = await service.createPayment(circleId, { ...electricBill, idempotencyKey: key() });
    // Old enough on both clocks that only the race guard can stop a "failed".
    await pool.query(
      `update payments set updated_at = now() - interval '31 seconds', sent_at = now() - interval '11 minutes', next_lookup_at = now() where id = $1`,
      [payment.id],
    );

    // While the reconcile is looking at Nessie, the slow original request
    // restarts the clock right before it sends.
    fake.duringNextLookup(async () => {
      await pool.query(`update payments set updated_at = now() where id = $1`, [payment.id]);
    });
    const settled = await service.paymentForCircle(circleId, payment.id);

    // Not failed: that request is about to send, and its send must be recordable.
    expect(settled.status).toBe('paying');
  });

  it('a slow write that lands after the first look is found later, not declared failed', async () => {
    fake.failNext('/bills', 'lostThen500');
    const payment = await service.createPayment(circleId, { ...electricBill, idempotencyKey: key() });
    expect(payment.status).toBe('paying');

    // The write lands at Nessie after our first look.
    await service.getPayment(payment.id);
    fake.records.push({
      kind: 'bills',
      accountId: ACCOUNT,
      body: {
        _id: 'fake-late-arrival',
        payee: 'City Power & Light',
        nickname: `Utilities [cw:${payment.id}]`,
        payment_date: '2026-10-17',
        payment_amount: 84.12,
      },
    });
    await pool.query(`update payments set updated_at = now() - interval '31 seconds', next_lookup_at = now() where id = $1`, [payment.id]);

    const settled = await service.paymentForCircle(circleId, payment.id);
    expect(settled).toMatchObject({ status: 'paid', nessieId: 'fake-late-arrival' });
    expect(fake.paymentWrites()).toHaveLength(1);
  });

  it('finds a newly landed payment within 30 seconds, with one claimed lookup per interval', async () => {
    fake.failNext('/bills', 'lostThen500');
    const payment = await service.createPayment(circleId, { ...electricBill, idempotencyKey: key() });
    expect(payment.status).toBe('paying');
    const initialGets = fake.calls.filter((call) => call.method === 'GET').length;

    await Promise.all(Array.from({ length: 5 }, () => service.paymentForCircle(circleId, payment.id)));
    expect(fake.calls.filter((call) => call.method === 'GET')).toHaveLength(initialGets);

    fake.records.push({
      kind: 'bills', accountId: ACCOUNT,
      body: { _id: 'fake-quick-arrival', payee: 'City Power & Light',
        nickname: `Utilities [cw:${payment.id}]`, payment_date: '2026-10-17', payment_amount: 84.12 },
    });
    await pool.query(`update payments set next_lookup_at = now() where id = $1`, [payment.id]);
    const reads = await Promise.all(Array.from({ length: 5 }, () => service.paymentForCircle(circleId, payment.id)));
    expect(reads.some((read) => read.status === 'paid')).toBe(true);
    expect((await service.getPayment(payment.id))!.status).toBe('paid');
    expect(fake.calls.filter((call) => call.method === 'GET')).toHaveLength(initialGets + 4);
    expect(fake.paymentWrites()).toHaveLength(1);
  });
});

describe('unusual spending, from the continuous aggregate', () => {
  it('holds a grocery run far above her usual history', async () => {
    // Ten days of ~$40 grocery runs, straight into the hypertable.
    await pool.query(
      `insert into spending (occurred_at, circle_id, amount_cents, category, payee_name)
       select now() - make_interval(days => d), $1, 4000, 'groceries', 'Sunrise Grocery'
         from generate_series(1, 10) as d`,
      [circleId],
    );
    // Once historical buckets are materialized, a backdated insert needs a
    // refresh before the continuous aggregate includes it.
    await pool.query(
      `call refresh_continuous_aggregate('spending_daily',
         now() - interval '11 days', now() - interval '1 hour')`,
    );

    const usual = await service.createPayment(circleId, {
      ...electricBill,
      payeeName: 'Sunrise Grocery',
      payeeKind: 'merchant',
      category: 'groceries',
      amountCents: toCents(6_000),
      idempotencyKey: key(),
    });
    expect(usual.status).toBe('paid');

    const unusual = await service.createPayment(circleId, {
      ...electricBill,
      payeeName: 'Sunrise Grocery',
      payeeKind: 'merchant',
      category: 'groceries',
      amountCents: toCents(15_000),
      idempotencyKey: key(),
    });
    expect(unusual).toMatchObject({ status: 'held', holdReasons: ['unusual_spending'] });
  });
});

describe('errors carry a code', () => {
  it('uses PaymentError for refusals the phone should explain', async () => {
    const error = await service
      .decidePayment({ paymentId: crypto.randomUUID(), member: { memberId: rosaDaughter }, decision: 'deny', via: 'app' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaymentError);
  });
});

describe('the ledger balance', () => {
  it('refuses a payment bigger than the money available, and sends nothing', async () => {
    const fresh = await pool.query<{ id: string }>(
      `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
       values ('Empty Test (synthetic)', 'test', $1, 0) returning id`,
      ['test-account-' + crypto.randomUUID()],
    );
    const id = fresh.rows[0]!.id;
    const writesBefore = fake.paymentWrites().length;
    try {
      await expect(service.createPayment(id, { ...electricBill, idempotencyKey: key() })).rejects.toMatchObject({ code: 'insufficient_funds' });
      const saved = await pool.query('select 1 from payments where circle_id = $1', [id]);
      expect(saved.rowCount).toBe(0);
      expect(fake.paymentWrites()).toHaveLength(writesBefore);
    } finally {
      await pool.query('delete from circles where id = $1', [id]);
    }
  });
});
