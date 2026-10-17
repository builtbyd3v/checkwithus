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

/** Makes one member's push due (and the others not), to stage answer order. */
const makeDueFor = async (paymentId: string, sub: string) => {
  await pool.query(`update ciba_requests set poll_after = now() + interval '1 hour' where payment_id = $1`, [paymentId]);
  await pool.query(
    `update ciba_requests r set poll_after = now()
       from circle_members m
      where r.payment_id = $1 and m.id = r.member_id and m.auth0_sub = $2`,
    [paymentId, sub],
  );
};

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
    await makeDueFor(payment.id, LEO);
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
    await makeDueFor(payment.id, MARIA);

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

    await flaky.pollPayment(payment.id, circleId);
    await makeDueFor(payment.id, LEO);
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

  it('when both answer in the same round, the Deny wins', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'approve');
    auth0.answer(LEO, 'deny');
    await makeDue(payment.id);

    await approvals.pollPayment(payment.id, circleId);

    expect(await service.getPayment(payment.id)).toMatchObject({ status: 'denied', decidedVia: 'ciba' });
    expect(nessieFake.paymentWrites()).toHaveLength(0);
  });

  it('does not count a pending check made before another member approves', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'approve');
    await makeDue(payment.id);
    const ciba = createCibaClient({ ...FAKE_AUTH0, fetch: auth0.fetch, keys: auth0.keys });
    const mariaRequest = [...auth0.pushes.entries()].find(([, push]) => push.sub === MARIA)![0];
    const timed = createCibaApprovals({
      pool,
      ciba: {
        ...ciba,
        poll: async (id) => {
          // Leo was pending when checked. He denies before Maria's approval
          // reaches this server, so that earlier check cannot clear her approval.
          if (id === mariaRequest) auth0.answer(LEO, 'deny');
          return ciba.poll(id);
        },
      },
      payments: () => service,
    });

    await timed.pollPayment(payment.id, circleId);
    expect((await service.getPayment(payment.id))!.status).toBe('held');
    expect(nessieFake.paymentWrites()).toHaveLength(0);

    await makeDueFor(payment.id, LEO);
    await timed.pollPayment(payment.id, circleId);
    expect((await service.getPayment(payment.id))!.status).toBe('denied');
  });

  it('requires the other pending check to be strictly after the approval', async () => {
    const payment = await hold();
    await pool.query(
      `update ciba_requests r
          set state = case when m.auth0_sub = $2 then 'approved' else r.state end,
              answered_at = case when m.auth0_sub = $2 then now() else r.answered_at end,
              last_polled_at = now(), poll_after = now() + interval '1 hour'
         from circle_members m
        where r.payment_id = $1 and m.id = r.member_id and m.auth0_sub in ($2, $3)`,
      [payment.id, MARIA, LEO],
    );

    await approvals.pollPayment(payment.id, circleId);
    expect((await service.getPayment(payment.id))!.status).toBe('held');
    expect(nessieFake.paymentWrites()).toHaveLength(0);
  });

  it('keeps an earlier Auth0 answer when recording a later poll fails', async () => {
    const payment = await hold();
    auth0.answer(LEO, 'approve');
    await makeDue(payment.id);
    const mariaId = (
      await pool.query<{ id: string }>(
        `select r.id from ciba_requests r join circle_members m on m.id = r.member_id
          where r.payment_id = $1 and m.auth0_sub = $2`,
        [payment.id, MARIA],
      )
    ).rows[0]!.id;
    const brokenPool = new Proxy(pool, {
      get(target, property) {
        if (property === 'query') return (sql: string, values?: unknown[]) => {
          if (sql.includes('update ciba_requests set last_polled_at') && values?.[0] === mariaId) {
            throw new Error('record write failed');
          }
          return target.query(sql, values);
        };
        return Reflect.get(target, property);
      },
    });
    const interrupted = createCibaApprovals({
      pool: brokenPool,
      ciba: createCibaClient({ ...FAKE_AUTH0, fetch: auth0.fetch, keys: auth0.keys }),
      payments: () => service,
    });

    await expect(interrupted.pollPayment(payment.id, circleId)).rejects.toThrow('record write failed');
    expect((await requestsFor(payment.id)).find((r) => r.sub === LEO)?.state).toBe('approved');

    await makeDueFor(payment.id, MARIA);
    await approvals.pollPayment(payment.id, circleId);
    expect((await service.getPayment(payment.id))!.status).toBe('paid');
  });

  it('an approval waits for the other open push to be checked, and an earlier Deny wins', async () => {
    const payment = await hold();
    // Leo tapped Deny first, but his push is not due for polling yet; Maria's is.
    auth0.answer(LEO, 'deny');
    auth0.answer(MARIA, 'approve');
    await makeDueFor(payment.id, MARIA);

    await approvals.pollPayment(payment.id, circleId);
    // Maria's approval is recorded but not applied: Leo has not been checked since.
    expect((await service.getPayment(payment.id))!.status).toBe('held');
    expect(nessieFake.paymentWrites()).toHaveLength(0);

    await makeDueFor(payment.id, LEO);
    await approvals.pollPayment(payment.id, circleId);

    expect(await service.getPayment(payment.id)).toMatchObject({ status: 'denied', decidedVia: 'ciba' });
    expect(nessieFake.paymentWrites()).toHaveLength(0);
  });

  it('an approval goes through once the other open push is checked and still has no answer', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'approve');
    await makeDueFor(payment.id, MARIA);
    await approvals.pollPayment(payment.id, circleId);
    expect((await service.getPayment(payment.id))!.status).toBe('held');

    await makeDueFor(payment.id, LEO); // Leo has not answered
    await approvals.pollPayment(payment.id, circleId);

    expect((await service.getPayment(payment.id))!.status).toBe('paid');
    expect(nessieFake.paymentWrites()).toHaveLength(1);
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

describe('over the two-approval limit, through Guardian', () => {
  const AUDIENCE = 'https://api.checkwith.us/';
  /** $1,500: over the default $1,000 limit, so two approvers must say yes. */
  const holdLarge = () =>
    service.createPayment(circleId, { ...scam, amountCents: toCents(150_000), idempotencyKey: `ciba2-${crypto.randomUUID()}` });

  beforeEach(() => {
    // The production wiring: API audience and payment details in the push.
    approvals = createCibaApprovals({
      pool,
      ciba: createCibaClient({
        ...FAKE_AUTH0, audience: AUDIENCE, richAuthorizationDetails: true, fetch: auth0.fetch, keys: auth0.keys,
      }),
      payments: () => service,
    });
  });

  const votes = async (paymentId: string) =>
    (await pool.query('select 1 from payment_votes where payment_id = $1', [paymentId])).rowCount;

  /** Maria approves in Guardian; once Leo's open push is checked, her vote counts, and it is still held. */
  const firstApprovalCounted = async (paymentId: string) => {
    auth0.answer(MARIA, 'approve');
    await makeDue(paymentId);
    await approvals.pollPayment(paymentId, circleId);
    await makeDueFor(paymentId, LEO);
    await approvals.pollPayment(paymentId, circleId);
    expect(await votes(paymentId)).toBe(1);
    expect((await service.getPayment(paymentId))!.status).toBe('held');
    expect(nessieFake.paymentWrites()).toHaveLength(0);
  };

  it('the push shows the amount, payee, plain-words reasons and that two approvals are needed', async () => {
    const payment = await holdLarge();
    expect(payment.approvalsRequired).toBe(2);
    const push = [...auth0.pushes.values()].find((p) => p.sub === MARIA)!;
    expect(push.audience).toBe(AUDIENCE);
    expect(push.message).toBe('Rosa: 1,500.00 USD to QuickGift Cards');
    expect(push.details).toMatchObject([{
      properties: {
        amount: { value: '$1,500.00' },
        payee: { value: 'QuickGift Cards' },
        reason: { value: expect.stringContaining('Gift card purchase') },
        approvals: { value: '2 family approvers' },
        amount_cents: { display: false, value: 150_000 },
      },
    }]);
  });

  it('one Guardian approval is not enough; the second approver releases it, once', async () => {
    const payment = await holdLarge();
    await firstApprovalCounted(payment.id);

    auth0.answer(LEO, 'approve');
    await makeDue(payment.id);
    await approvals.pollPayment(payment.id, circleId);

    expect(await service.getPayment(payment.id)).toMatchObject({ status: 'paid', decidedVia: 'ciba' });
    expect(nessieFake.paymentWrites()).toHaveLength(1);
    expect(await votes(payment.id)).toBe(2);
  });

  it('one approval, then one Deny: the Deny stops it', async () => {
    const payment = await holdLarge();
    await firstApprovalCounted(payment.id);

    auth0.answer(LEO, 'deny');
    await makeDue(payment.id);
    await approvals.pollPayment(payment.id, circleId);

    expect(await service.getPayment(payment.id)).toMatchObject({ status: 'denied', decidedVia: 'ciba' });
    expect(nessieFake.paymentWrites()).toHaveLength(0);
  });

  it('an approval mixing Guardian and the app counts both, from distinct approvers', async () => {
    const payment = await holdLarge();
    await service.decidePayment({ paymentId: payment.id, member: { auth0Sub: LEO }, decision: 'approve', via: 'app' });
    expect((await service.getPayment(payment.id))!.status).toBe('held');

    auth0.answer(MARIA, 'approve');
    await makeDue(payment.id);
    await approvals.pollPayment(payment.id, circleId);
    await makeDueFor(payment.id, LEO);
    await approvals.pollPayment(payment.id, circleId);

    expect((await service.getPayment(payment.id))!.status).toBe('paid');
    expect(nessieFake.paymentWrites()).toHaveLength(1);
  });

  it('a Guardian approval whose Auth0 token lacks approve:payments does not count', async () => {
    const payment = await holdLarge();
    auth0.answer(MARIA, 'approve', { permissions: ['read:payments'] });
    auth0.answer(LEO, 'approve', { permissions: ['approve:payments'] });
    await makeDue(payment.id);
    await approvals.pollPayment(payment.id, circleId);

    expect((await service.getPayment(payment.id))!.status).toBe('held');
    expect((await requestsFor(payment.id)).find((s) => s.sub === MARIA)).toMatchObject({
      state: 'failed', last_error: expect.stringMatching(/approve:payments/),
    });
    expect(nessieFake.paymentWrites()).toHaveLength(0);
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

describe('a member demoted after their push went out', () => {
  it('cannot decide, and does not jam the payment for the rest of the family', async () => {
    const payment = await hold();
    auth0.answer(MARIA, 'deny');
    auth0.answer(LEO, 'approve');
    // Maria is made a viewer after the push reached her phone.
    await pool.query(`update circle_members set role = 'viewer' where circle_id = $1 and auth0_sub = $2`, [circleId, MARIA]);
    try {
      await makeDue(payment.id);

      // Polling must keep working: it is the older adult's "Waiting for family" screen.
      await approvals.pollPayment(payment.id, circleId);

      // Her recorded answer no longer counts: it is superseded, never retried...
      expect((await requestsFor(payment.id)).find((s) => s.sub === MARIA)).toMatchObject({ state: 'superseded' });
      // ...and Leo, still an approver, decides.
      expect((await service.getPayment(payment.id))!.status).toBe('paid');
      expect(nessieFake.paymentWrites()).toHaveLength(1);
    } finally {
      await pool.query(`update circle_members set role = 'approver' where circle_id = $1 and auth0_sub = $2`, [circleId, MARIA]);
    }
  });
});
