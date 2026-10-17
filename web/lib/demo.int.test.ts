/**
 * Demo smoke test: PLAN.md demo steps 3 to 6 through the real route handlers,
 * on the state `demo:reset` builds, with the fake Auth0 (Guardian push) and
 * fake Nessie. Prints one PASS/FAIL line per step. `npm run smoke:demo`.
 * Refuses to run unless the tables resolve to a throwaway wt_* schema.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createFakeAuth0 } from '@/test/fake-auth0';
import { createFakeNessie } from '@/test/fake-nessie';

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => {},
}));

// Family sign-in: the Auth0 token check is replaced by an x-test-sub header, as in api.int.test.ts.
vi.mock('@/lib/auth/family', async () => {
  const { AuthError } = await import('@/lib/auth/http-auth');
  return {
    requireFamilyUser: async (request: Request) => {
      const sub = request.headers.get('x-test-sub');
      if (!sub) throw new AuthError('Missing bearer token');
      const authTime = request.headers.get('x-test-auth-time');
      return { sub, name: null, ...(authTime ? { authTime: Number(authTime) } : {}) };
    },
  };
});

const fakeNessie = createFakeNessie();
const fakeAuth0 = await createFakeAuth0();
// APPROVAL_MODE=ciba, as in the demo: a hold pushes to Guardian, and the phone's poll reads the answer.
vi.mock('@/lib/services', async () => {
  const { db } = await import('@/lib/db');
  const { createNessieClient } = await import('@/lib/nessie/client');
  const { createPaymentService } = await import('@/lib/payments');
  const { createFreezeService } = await import('@/lib/freeze');
  const { createCibaApprovals } = await import('@/lib/approvals');
  const { createCibaClient } = await import('@/lib/auth0/ciba');
  const { FAKE_AUTH0 } = await import('@/test/fake-auth0');
  const nessie = createNessieClient({ key: 'test-key', fetch: fakeNessie.fetch, sleep: async () => {} });
  const service = createPaymentService({ pool: db(), nessie, onHeld: (payment) => approvals.onHeld(payment) });
  const approvals = createCibaApprovals({
    pool: db(),
    ciba: createCibaClient({ ...FAKE_AUTH0, fetch: fakeAuth0.fetch, keys: fakeAuth0.keys }),
    payments: () => service,
  });
  const freezeService = createFreezeService({ pool: db(), nessie });
  return { payments: () => service, freeze: () => freezeService, cibaApprovals: () => approvals, approvalsUseCiba: () => true };
});

const { db } = await import('@/lib/db');
const { createNessieClient } = await import('@/lib/nessie/client');
const { demoTarget, resetDemo, DEMO_ALLOWANCE } = await import('@/scripts/demo-reset');
const routes = {
  pairingCode: await import('@/app/api/v1/family/circles/[id]/pairing-code/route'),
  pair: await import('@/app/api/v1/device/pair/route'),
  payments: await import('@/app/api/v1/payments/route'),
  payment: await import('@/app/api/v1/payments/[id]/route'),
  freeze: await import('@/app/api/v1/family/circles/[id]/freeze/route'),
  unfreeze: await import('@/app/api/v1/family/circles/[id]/unfreeze/route'),
};

const BASE = 'https://checkwith.us/api/v1';
const MARIA = 'test|demo-maria';
let circleId: string;
let deviceToken: string;

type Body = {
  id: string; outcome: string; status: string; holdReasons: string[];
  code: string; deviceToken: string; frozen: boolean; movedCents: number;
};
function req(path: string, init: { body?: unknown; sub?: string; device?: string; fresh?: boolean } = {}) {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.sub) headers['x-test-sub'] = init.sub;
  if (init.fresh) headers['x-test-auth-time'] = String(Math.floor(Date.now() / 1000));
  if (init.device) headers.authorization = `Bearer ${init.device}`;
  return new Request(`${BASE}${path}`, {
    method: init.body === undefined ? 'GET' : 'POST', headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const noParams = { params: Promise.resolve({}) };
const read = async (response: Response) => ({ status: response.status, body: (await response.json()) as Body });
const pay = async (key: string, body: Record<string, unknown>) =>
  read(await routes.payments.POST(req('/payments', { device: deviceToken, body: { idempotencyKey: `smoke-${key}-${crypto.randomUUID()}`, ...body } }), noParams));

/** Runs one demo step and prints its PASS/FAIL line. */
async function step(name: string, body: () => Promise<void>) {
  try {
    await body();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stdout.write(`FAIL ${name}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}\n`);
    throw error;
  }
}

beforeAll(async () => {
  await demoTarget(db(), false);
  const nessie = createNessieClient({ key: 'test-key', fetch: fakeNessie.fetch, sleep: async () => {} });
  // Own synthetic customer, so this circle never shares the demo:reset circle's accounts.
  const reset = () => resetDemo({ pool: db(), nessie, customerLastName: 'CheckWithSmoke' });
  circleId = (await reset()).circleId;
  await db().query(
    `insert into circle_members (circle_id, auth0_sub, display_name, role) values ($1, $2, 'Maria', 'approver')`,
    [circleId, MARIA],
  );
  // Second run: idempotent, and now grants the allowance through Maria.
  expect((await reset()).circleId).toBe(circleId);
  const code = await read(await routes.pairingCode.POST(req(`/family/circles/${circleId}/pairing-code`, { sub: MARIA, body: {} }), params(circleId)));
  deviceToken = (await read(await routes.pair.POST(req('/device/pair', { body: { code: code.body.code } }), noParams))).body.deviceToken;
}, 60_000);

afterAll(async () => {
  if (circleId) await db().query('delete from circles where id = $1', [circleId]);
  await db().query(`delete from nessie_merchants where nessie_merchant_id like 'fake-%'`);
  await db().end();
});

describe('the demo, steps 3 to 6', () => {
  it('step 3', () => step('step 3: gift card during a call is held; family denies in Guardian; phone sees denied', async () => {
    const held = await pay('giftcard', {
      amountCents: 50_000, payee: { name: 'QuickGift Cards', kind: 'merchant' }, category: 'gift_cards',
      onCall: true, guard: { score: 0.97, modelVersion: 'guard-smoke' },
      explanation: 'The caller said she owes the IRS and must pay in gift cards today.',
    });
    expect(held).toMatchObject({ status: 201, body: { outcome: 'waiting' } });
    expect(held.body.holdReasons).toEqual(expect.arrayContaining(['gift_card', 'during_call']));
    expect([...fakeAuth0.pushes.values()].some((push) => push.sub === MARIA)).toBe(true);

    fakeAuth0.answer(MARIA, 'deny');
    await db().query(`update ciba_requests set poll_after = now() where payment_id = $1`, [held.body.id]);
    const polled = await read(await routes.payment.GET(req(`/payments/${held.body.id}`, { device: deviceToken }), params(held.body.id)));
    expect(polled.body).toMatchObject({ status: 'denied', outcome: 'blocked_by_family' });
  }));

  it('step 4', () => step('step 4: ATM cash then a gift card is held as a scam sequence', async () => {
    // ponytail: the ledger row demo:atm writes; demo:atm itself needs real Nessie's ATM list.
    const nessieId = `smoke-atm-${crypto.randomUUID()}`;
    await db().query('insert into spending_nessie_records (nessie_id, circle_id) values ($1, $2)', [nessieId, circleId]);
    await db().query(
      `insert into spending (occurred_at, circle_id, amount_cents, category, payee_name, nessie_id, atm_id)
       values (now(), $1, 20000, 'other', 'ATM cash: Smoke ATM', $2, 'smoke-atm')`,
      [circleId, nessieId],
    );
    const held = await pay('sequence', {
      amountCents: 10_000, payee: { name: 'QuickGift Cards', kind: 'merchant' }, category: 'gift_cards', onCall: false,
    });
    expect(held).toMatchObject({ status: 201, body: { outcome: 'waiting' } });
    expect(held.body.holdReasons).toContain('cash_then_gift_card');
  }));

  it('step 5', () => step('step 5: Freeze moves the balance to the vault; a payment while frozen is held', async () => {
    const frozen = await read(await routes.freeze.POST(req(`/family/circles/${circleId}/freeze`, { sub: MARIA, body: {} }), params(circleId)));
    expect(frozen).toMatchObject({ status: 200, body: { frozen: true } });
    expect(frozen.body.movedCents).toBeGreaterThan(0);
    const { rows } = await db().query<{ nessie_account_id: string; vault_account_id: string }>(
      'select nessie_account_id, vault_account_id from circles where id = $1', [circleId],
    );
    const transfer = fakeNessie.records.find((r) => r.kind === 'transfers' && r.accountId === rows[0]!.nessie_account_id);
    expect(transfer?.body).toMatchObject({ amount: frozen.body.movedCents / 100 });
    expect(String(transfer?.body.description)).toContain(rows[0]!.vault_account_id);

    const groceries = await pay('frozen', {
      amountCents: 4_200, payee: { name: 'Sunrise Grocery', kind: 'merchant' }, category: 'groceries', onCall: false,
    });
    expect(groceries).toMatchObject({ status: 201, body: { outcome: 'waiting', holdReasons: ['frozen'] } });

    // Unfreeze for step 6, as the family would after the call.
    const back = await read(await routes.unfreeze.POST(
      req(`/family/circles/${circleId}/unfreeze`, { sub: MARIA, fresh: true, body: { amountCents: frozen.body.movedCents } }), params(circleId),
    ));
    expect(back).toMatchObject({ status: 200, body: { frozen: false } });
  }));

  it('step 6', () => step('step 6: a known $350 utility bill pays with no push under the allowance, and is held without it', async () => {
    const bill = { amountCents: 35_000, payee: { name: 'City Power & Light', kind: 'biller' }, category: 'utilities', onCall: false };
    const pushes = fakeAuth0.pushes.size;
    const paid = await pay('bill', bill);
    expect(paid).toMatchObject({ status: 201, body: { outcome: 'sent' } });
    expect(fakeAuth0.pushes.size).toBe(pushes);
    const { rows } = await db().query<{ category: string; max_amount_cents: string }>(
      `select a.category, a.max_amount_cents::text from payments p join allowances a on a.id = p.allowance_id where p.id = $1`,
      [paid.body.id],
    );
    expect(rows).toEqual([{ category: DEMO_ALLOWANCE.category, max_amount_cents: String(DEMO_ALLOWANCE.maxAmountCents) }]);

    // Without the allowance the same bill is over the $300 limit and waits for the family.
    await db().query('update allowances set revoked_at = now() where circle_id = $1 and revoked_at is null', [circleId]);
    const held = await pay('bill-revoked', bill);
    expect(held).toMatchObject({ status: 201, body: { outcome: 'waiting', holdReasons: ['over_limit'] } });
  }));
});
