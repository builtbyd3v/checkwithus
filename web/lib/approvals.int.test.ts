/**
 * Family approval through Auth0 CIBA: real database, in-memory Nessie and an
 * in-memory Auth0 that signs real ID tokens. `npm run test:db`.
 */
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCibaApprovals, type CibaApprovals } from '@/lib/approvals';
import { createCibaClient } from '@/lib/auth0/ciba';
import { toCents } from '@/lib/money';
import { createNessieClient } from '@/lib/nessie/client';
import { createPaymentService, type NewPayment, type PaymentService } from '@/lib/payments';
import { createFakeAuth0, FAKE_AUTH0, type FakeAuth0 } from '@/test/fake-auth0';
import { createFakeNessie, type FakeNessie } from '@/test/fake-nessie';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
let circleId: string;
const MARIA = 'test|ciba-maria';
const LEO = 'test|ciba-leo';
const ANA = 'test|ciba-ana';

let auth0: FakeAuth0;
let nessieFake: FakeNessie;
let service: PaymentService;
let approvals: CibaApprovals;

const scam: Omit<NewPayment, 'idempotencyKey'> = {
  amountCents: toCents(50_000),
  payeeName: 'QuickGift Cards',
  payeeKind: 'merchant',
  category: 'gift_cards',
  onCall: true,
  guard: { score: 0.97, modelVersion: 'guard-test' },
  explanation: 'Caller pressured her to buy gift cards.',
};
const hold = () => service.createPayment(circleId, { ...scam, idempotencyKey: `ciba-${crypto.randomUUID()}` });

/** Lets the next poll happen now instead of waiting Auth0's interval. */
const makeDue = (paymentId: string) =>
  pool.query(`update ciba_requests set poll_after = now() where payment_id = $1`, [paymentId]);

const requestsFor = async (paymentId: string) =>
  (
    await pool.query<{ sub: string; state: string; last_error: string | null }>(
      `select m.auth0_sub as sub, r.state, r.last_error
         from ciba_requests r join circle_members m on m.id = r.member_id
        where r.payment_id = $1 order by m.auth0_sub`,
      [paymentId],
    )
  ).rows;

beforeAll(async () => {
  const circle = await pool.query<{ id: string }>(
    `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
     values ('Rosa Test (synthetic)', 'test-customer', $1, 500000) returning id`,
    ['test-account-' + crypto.randomUUID()],
  );
  circleId = circle.rows[0]!.id;
  await pool.query(
    `insert into circle_members (circle_id, auth0_sub, display_name)
     values ($1, $2, 'Maria'), ($1, $3, 'Leo'), ($1, $4, 'Ana')`,
    [circleId, MARIA, LEO, ANA],
  );
});

afterAll(async () => {
  await pool.query('delete from circles where id = $1', [circleId]);
  await pool.query(`delete from nessie_merchants where nessie_merchant_id like 'fake-%'`);
  await pool.end();
});

beforeEach(async () => {
  auth0 = await createFakeAuth0();
  auth0.notEnrolled.add(ANA); // Ana never set up Guardian.
  nessieFake = createFakeNessie();
  service = createPaymentService({
    pool,
    nessie: createNessieClient({ key: 'test-key', fetch: nessieFake.fetch, sleep: async () => {} }),
    onHeld: (payment) => approvals.onHeld(payment),
  });
  approvals = createCibaApprovals({
    pool,
    ciba: createCibaClient({ ...FAKE_AUTH0, fetch: auth0.fetch, keys: auth0.keys }),
    payments: () => service,
  });
});

describe('a held payment', () => {
  it('pushes to every family member, and records who could not be reached', async () => {
    const payment = await hold();

    expect([...auth0.pushes.values()].map((p) => p.sub).sort()).toEqual([LEO, MARIA].sort());
    for (const push of auth0.pushes.values()) {
      expect(push.message).toBe('Rosa: 500.00 USD to QuickGift Cards');
      expect(push.expiry).toBeGreaterThan(280);
      expect(push.expiry).toBeLessThanOrEqual(300);
    }
    const states = await requestsFor(payment.id);
    expect(states.find((s) => s.sub === ANA)).toMatchObject({ state: 'failed', last_error: expect.stringMatching(/enrolled/) });
    expect(states.filter((s) => s.state === 'pending')).toHaveLength(2);
  });
});

describe('answers from Guardian', () => {
  it('an approval in Guardian sends the payment, once', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'approve');
    await makeDue(payment.id);

    await approvals.pollPayment(payment.id, circleId);

    const final = await service.getPayment(payment.id);
    expect(final).toMatchObject({ status: 'paid', decidedVia: 'ciba' });
    expect(nessieFake.paymentWrites()).toHaveLength(1);
    // Leo's push is moot now.
    expect((await requestsFor(payment.id)).find((s) => s.sub === LEO)?.state).toBe('superseded');
  });

  it('an approval is never lost when applying it fails once', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'approve');
    await makeDue(payment.id);

    // The first attempt to apply the decision hits a transient error.
    let failOnce = true;
    const flaky = createCibaApprovals({
      pool,
      ciba: createCibaClient({ ...FAKE_AUTH0, fetch: auth0.fetch, keys: auth0.keys }),
      payments: () => ({
        ...service,
        decidePayment: async (input) => {
          if (failOnce) {
            failOnce = false;
            throw new Error('connection terminated unexpectedly');
          }
          return service.decidePayment(input);
        },
      }),
    });

    await expect(flaky.pollPayment(payment.id, circleId)).rejects.toThrow('connection terminated');
    expect((await service.getPayment(payment.id))!.status).toBe('held');
    const pollsSoFar = auth0.tokenPolls().length;

    // The next poll applies the recorded answer, without asking Auth0 again.
    await flaky.pollPayment(payment.id, circleId);

    expect((await service.getPayment(payment.id))!.status).toBe('paid');
    expect(nessieFake.paymentWrites()).toHaveLength(1);
    expect(auth0.tokenPolls().length).toBe(pollsSoFar);
  });

  it('a deny in Guardian blocks it, recorded as the family\'s answer', async () => {
    const payment = await hold();
    auth0.answer(LEO, 'deny');
    await makeDue(payment.id);

    await approvals.pollPayment(payment.id, circleId);

    expect(await service.getPayment(payment.id)).toMatchObject({ status: 'denied', decidedVia: 'ciba' });
    expect(nessieFake.paymentWrites()).toHaveLength(0);
  });

  it('when both answer, the first one applied wins and money moves at most once', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'approve');
    auth0.answer(LEO, 'deny');
    await makeDue(payment.id);

    await approvals.pollPayment(payment.id, circleId);

    const final = await service.getPayment(payment.id);
    expect(['paid', 'denied']).toContain(final!.status);
    expect(nessieFake.paymentWrites()).toHaveLength(final!.status === 'paid' ? 1 : 0);
  });

  it('a deny at the very edge of expiry is recorded as no answer, not as a "no"', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'deny');
    await pool.query(
      `update ciba_requests set poll_after = now(), expires_at = now() + interval '2 seconds' where payment_id = $1`,
      [payment.id],
    );

    await approvals.pollPayment(payment.id, circleId);

    // Not a family decision (so no "scam" training label); still held, and
    // its own deadline will block it.
    expect((await requestsFor(payment.id)).find((s) => s.sub === MARIA)?.state).toBe('expired');
    expect((await service.getPayment(payment.id))!.status).toBe('held');
  });

  it('an approval whose verified token names someone else does not count', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'approve', { tokenSub: 'auth0|intruder' });
    await makeDue(payment.id);

    await approvals.pollPayment(payment.id, circleId);

    expect((await service.getPayment(payment.id))!.status).toBe('held');
    expect((await requestsFor(payment.id)).find((s) => s.sub === MARIA)).toMatchObject({ state: 'failed' });
    expect(nessieFake.paymentWrites()).toHaveLength(0);
  });

  it('a rotated client secret fails closed, without inventing a family "no"', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'deny');
    await makeDue(payment.id);

    const misconfigured = createCibaApprovals({
      pool,
      ciba: createCibaClient({ ...FAKE_AUTH0, clientSecret: 'rotated', fetch: auth0.fetch, keys: auth0.keys }),
      payments: () => service,
    });
    await misconfigured.pollPayment(payment.id, circleId);

    expect((await service.getPayment(payment.id))!.status).toBe('held');
    const maria = (await requestsFor(payment.id)).find((s) => s.sub === MARIA);
    expect(maria).toMatchObject({ state: 'pending', last_error: expect.stringMatching(/credentials/) });
  });

  it('an explicit expiry from Auth0 is no answer, not a "no"', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'expire');
    await makeDue(payment.id);

    await approvals.pollPayment(payment.id, circleId);

    expect((await requestsFor(payment.id)).find((s) => s.sub === MARIA)?.state).toBe('expired');
    expect((await service.getPayment(payment.id))!.status).toBe('held');
  });

  it('slow_down from Auth0 lengthens the interval', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'slow_down');
    await makeDue(payment.id);

    await approvals.pollPayment(payment.id, circleId);

    const { rows } = await pool.query<{ interval_seconds: number }>(
      `select r.interval_seconds from ciba_requests r join circle_members m on m.id = r.member_id
        where r.payment_id = $1 and m.auth0_sub = $2`,
      [payment.id, MARIA],
    );
    expect(rows[0]!.interval_seconds).toBe(15);
  });
});

describe('asking Auth0 politely (rule 8)', () => {
  it('does not poll before the interval Auth0 asked for', async () => {
    const payment = await hold();
    await approvals.pollPayment(payment.id, circleId);
    expect(auth0.tokenPolls()).toHaveLength(0);
  });

  it('many simultaneous pollers ask Auth0 once per request', async () => {
    const payment = await hold();
    await makeDue(payment.id);

    await Promise.all(Array.from({ length: 6 }, () => approvals.pollPayment(payment.id, circleId)));

    // Two pending requests (Maria, Leo): exactly two polls, however many callers.
    expect(auth0.tokenPolls()).toHaveLength(2);
  });

  it('a caller from another circle cannot trigger polling of this one', async () => {
    const payment = await hold();
    await makeDue(payment.id);
    await approvals.pollPayment(payment.id, crypto.randomUUID());
    expect(auth0.tokenPolls()).toHaveLength(0);
  });

  it('stops asking once the payment is decided', async () => {
    const payment = await hold();
    await service.decidePayment({ paymentId: payment.id, member: { auth0Sub: MARIA }, decision: 'deny', via: 'app' });
    await makeDue(payment.id);

    await approvals.pollPayment(payment.id, circleId);

    expect(auth0.tokenPolls()).toHaveLength(0);
    expect((await requestsFor(payment.id)).filter((s) => s.state === 'pending')).toHaveLength(0);
  });
});
