/**
 * The bill-pay agent as Auth0 sees it: its own M2M identity, a token with only
 * `pay:bills`, and family routes that refuse it. Real route handlers, real
 * token verification against a fake Auth0 tenant (test/fake-auth0.ts), real
 * database, fake Nessie. `npm run test:db`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeAuth0, FAKE_AUTH0 } from '@/test/fake-auth0';
import { createFakeNessie } from '@/test/fake-nessie';

const AUDIENCE = 'https://api.checkwith-test.us/';
vi.hoisted(() => {
  Object.assign(process.env, {
    AUTH0_DOMAIN: 'checkwith-test.us.auth0.com',
    AUTH0_AUDIENCE: 'https://api.checkwith-test.us/',
    AUTH0_CLIENT_ID: 'test-client-id',
    AUTH0_CLIENT_SECRET: 'test-client-secret',
    AUTH0_RBAC: 'false',
    AUTH0_AGENT_CLIENT_ID: 'test-agent-client-id',
  });
});

// The real code fetches Auth0's published keys; serve the fake tenant's instead.
const tenant = vi.hoisted(() => ({ keys: undefined as unknown as (...args: never[]) => unknown }));
vi.mock('jose', async (importOriginal) => ({
  ...(await importOriginal<typeof import('jose')>()),
  createRemoteJWKSet: () => (...args: never[]) => tenant.keys(...args),
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => {},
}));

const nessieFake = createFakeNessie();
/** Stands in for asking the family: CIBA push (APPROVAL_MODE=ciba) or the family app. */
const onHeld = vi.fn(async () => {});
vi.mock('@/lib/services', async () => {
  const { db } = await import('@/lib/db');
  const { createNessieClient } = await import('@/lib/nessie/client');
  const { createPaymentService } = await import('@/lib/payments');
  const { createFreezeService } = await import('@/lib/freeze');
  const nessie = createNessieClient({ key: 'test-key', fetch: nessieFake.fetch, sleep: async () => {} });
  const service = createPaymentService({ pool: db(), nessie, onHeld });
  const freezeService = createFreezeService({ pool: db(), nessie });
  return { payments: () => service, freeze: () => freezeService, cibaApprovals: () => null, approvalsUseCiba: () => false };
});

const auth0 = await createFakeAuth0();
tenant.keys = auth0.keys as unknown as typeof tenant.keys;
const { db } = await import('@/lib/db');
const { normalizeName } = await import('@/lib/names');
const { fetchAgentToken } = await import('@/lib/auth0/agent-token');
const routes = {
  run: await import('./bills/run/route'),
  decision: await import('../family/payments/[id]/decision/route'),
  freeze: await import('../family/circles/[id]/freeze/route'),
  unfreeze: await import('../family/circles/[id]/unfreeze/route'),
  allowances: await import('../family/circles/[id]/allowances/route'),
  allowance: await import('../family/circles/[id]/allowances/[allowanceId]/route'),
  policy: await import('../family/circles/[id]/policy/route'),
};

const BASE = 'https://checkwith.us/api/v1';
const MARIA = 'auth0|agent-test-maria';
const BILLER = 'City Power & Light';
const BILL_CENTS = 8412;
const circles: string[] = [];
let agentToken: string;
let mariaToken: string;

const req = (path: string, token: string | undefined, body: unknown = {}, method = 'POST') =>
  new Request(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: method === 'DELETE' ? undefined : JSON.stringify(body),
  });
const noParams = { params: Promise.resolve({}) };
const read = async (response: Response) => ({ status: response.status, body: await response.json() });
const run = async (token: string, circleId: string) =>
  read(await routes.run.POST(req('/agent/bills/run', token, { circleId, dueWithinDays: 31 }), noParams));

/**
 * A circle whose hold limit ($50) is below the utility bill, so only an
 * allowance lets the agent's payment through. Last bill paid 15 days ago.
 */
async function circleWithBill(allowanceCapCents: number | null) {
  const { rows } = await db().query<{ id: string }>(
    `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents, hold_over_cents)
     values ('Rosa Agent Test (synthetic)', 'test-customer', $1, 500000, 5000) returning id`,
    ['test-account-' + crypto.randomUUID()],
  );
  const circleId = rows[0]!.id;
  circles.push(circleId);
  const member = await db().query<{ id: string }>(
    `insert into circle_members (circle_id, auth0_sub, display_name, role) values ($1, $2, 'Maria', 'approver') returning id`,
    [circleId, MARIA],
  );
  await db().query(
    `insert into payees (circle_id, name, normalized_name, kind, category) values ($1, $2, $3, 'biller', 'utilities')`,
    [circleId, BILLER, normalizeName(BILLER)],
  );
  await db().query(
    `insert into spending (occurred_at, circle_id, amount_cents, category, payee_name)
     values (now() - interval '15 days', $1, $2, 'utilities', $3)`,
    [circleId, BILL_CENTS, BILLER],
  );
  let allowanceId: string | null = null;
  if (allowanceCapCents !== null) {
    const allowance = await db().query<{ id: string }>(
      `insert into allowances (circle_id, category, max_amount_cents, expires_at, granted_by)
       values ($1, 'utilities', $2, now() + interval '30 days', $3) returning id`,
      [circleId, allowanceCapCents, member.rows[0]!.id],
    );
    allowanceId = allowance.rows[0]!.id;
  }
  return { circleId, allowanceId };
}

beforeAll(async () => {
  // The agent signs in exactly as scripts/agent-bills.ts does.
  ({ accessToken: agentToken } = await fetchAgentToken({
    domain: FAKE_AUTH0.domain, clientId: FAKE_AUTH0.agentClientId, clientSecret: FAKE_AUTH0.agentClientSecret,
    audience: AUDIENCE, fetch: auth0.fetch,
  }));
  mariaToken = await auth0.mint({ sub: MARIA, audience: AUDIENCE, claims: { auth_time: Math.floor(Date.now() / 1000) } });
});
beforeEach(() => onHeld.mockClear());
afterAll(async () => {
  await db().query('delete from circles where id = any($1::uuid[])', [circles]);
  await db().end();
});

describe('the bill-pay agent pays inside its allowance and asks outside it', () => {
  it('pays a utility bill inside the allowance with no push, and records who and which allowance', async () => {
    const { circleId, allowanceId } = await circleWithBill(20_000);
    const { status, body } = await run(agentToken, circleId);
    expect(status).toBe(200);
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0]).toMatchObject({ payee: BILLER, amountCents: BILL_CENTS, status: 'paid', allowanceId, holdReasons: [] });
    expect(onHeld).not.toHaveBeenCalled();
    const { rows } = await db().query('select initiated_by, allowance_id, decided_via from payments where id = $1', [body.proposals[0].paymentId]);
    expect(rows[0]).toEqual({ initiated_by: 'agent', allowance_id: allowanceId, decided_via: 'rules' });

    // Run again: the bill is paid, so the next one is a month out. Nothing new.
    expect((await run(agentToken, circleId)).body.proposals).toEqual([]);
  });

  it('holds the same bill over the allowance and asks the family', async () => {
    const { circleId } = await circleWithBill(5_000);
    const { body } = await run(agentToken, circleId);
    expect(body.proposals[0]).toMatchObject({ status: 'held', allowanceId: null, holdReasons: ['over_limit'] });
    expect(onHeld).toHaveBeenCalledTimes(1);
    // A rerun replays the same held payment; the family is not asked twice.
    const again = await run(agentToken, circleId);
    expect(again.body.proposals[0].paymentId).toBe(body.proposals[0].paymentId);
    expect(onHeld).toHaveBeenCalledTimes(1);
  });

  it('stops auto-paying once the family revokes the allowance', async () => {
    const { circleId, allowanceId } = await circleWithBill(20_000);
    const revoked = await routes.allowance.DELETE(
      req(`/family/circles/${circleId}/allowances/${allowanceId}`, mariaToken, undefined, 'DELETE'),
      { params: Promise.resolve({ id: circleId, allowanceId: allowanceId! }) },
    );
    expect(revoked.status).toBe(200);
    const { body } = await run(agentToken, circleId);
    expect(body.proposals[0]).toMatchObject({ status: 'held', allowanceId: null });
    expect(onHeld).toHaveBeenCalledTimes(1);
  });
});

describe('the agent token is least privilege', () => {
  it('is refused on every family route that decides or moves money', async () => {
    const { circleId, allowanceId } = await circleWithBill(20_000);
    const id = { params: Promise.resolve({ id: circleId }) };
    const held = await db().query<{ id: string }>(
      `insert into payments (circle_id, idempotency_key, amount_cents, payee_name, payee_kind, category, on_call,
         payee_known, status, expires_at) values ($1, 'agent-test-held-1', 9900, 'Someone New', 'merchant', 'shopping',
         false, false, 'held', now() + interval '5 minutes') returning id`, [circleId],
    );
    const attempts = [
      routes.decision.POST(req(`/family/payments/${held.rows[0]!.id}/decision`, agentToken, { decision: 'approve' }), { params: Promise.resolve({ id: held.rows[0]!.id }) }),
      routes.decision.POST(req(`/family/payments/${held.rows[0]!.id}/decision`, agentToken, { decision: 'deny' }), { params: Promise.resolve({ id: held.rows[0]!.id }) }),
      routes.freeze.POST(req(`/family/circles/${circleId}/freeze`, agentToken), id),
      routes.unfreeze.POST(req(`/family/circles/${circleId}/unfreeze`, agentToken, { amountCents: 100 }), id),
      routes.allowances.POST(req(`/family/circles/${circleId}/allowances`, agentToken, {
        category: 'utilities', maxAmountCents: 100_000, expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      }), id),
      routes.allowance.DELETE(req(`/family/circles/${circleId}/allowances/${allowanceId}`, agentToken, undefined, 'DELETE'),
        { params: Promise.resolve({ id: circleId, allowanceId: allowanceId! }) }),
      routes.policy.POST(req(`/family/circles/${circleId}/policy`, agentToken, { action: 'threshold', twoApprovalsOverCents: 0 }), id),
    ];
    for (const response of await Promise.all(attempts)) {
      expect(await read(response)).toMatchObject({ status: 403, body: { error: 'agent_not_allowed' } });
    }
    const { rows } = await db().query(
      `select p.status, c.frozen, a.revoked_at from payments p join circles c on c.id = p.circle_id
       join allowances a on a.circle_id = c.id where p.id = $1`, [held.rows[0]!.id],
    );
    expect(rows[0]).toEqual({ status: 'held', frozen: false, revoked_at: null });
  });

  it('refuses an agent token without pay:bills', async () => {
    auth0.settings.agentScopes = ['read:bills'];
    try {
      const { accessToken } = await fetchAgentToken({
        domain: FAKE_AUTH0.domain, clientId: FAKE_AUTH0.agentClientId, clientSecret: FAKE_AUTH0.agentClientSecret,
        audience: AUDIENCE, fetch: auth0.fetch,
      });
      const { circleId } = await circleWithBill(20_000);
      expect(await run(accessToken, circleId)).toMatchObject({ status: 403, body: { error: 'insufficient_scope' } });
    } finally {
      auth0.settings.agentScopes = ['pay:bills'];
    }
  });

  it('refuses a family member\'s token, another M2M app, and a wrong audience', async () => {
    const { circleId } = await circleWithBill(20_000);
    expect(await run(mariaToken, circleId)).toMatchObject({ status: 403, body: { error: 'agent_only' } });
    const userWithScope = await auth0.mint({ sub: MARIA, audience: AUDIENCE, claims: { scope: 'pay:bills' } });
    expect(await run(userWithScope, circleId)).toMatchObject({ status: 403, body: { error: 'agent_only' } });
    const otherApp = await auth0.mint({
      sub: 'other-m2m@clients', audience: AUDIENCE, claims: { gty: 'client-credentials', azp: 'other-m2m', scope: 'pay:bills' },
    });
    expect(await run(otherApp, circleId)).toMatchObject({ status: 403, body: { error: 'agent_only' } });
    const wrongAudience = await auth0.mint({
      sub: `${FAKE_AUTH0.agentClientId}@clients`, audience: 'https://someone-else/',
      claims: { gty: 'client-credentials', azp: FAKE_AUTH0.agentClientId, scope: 'pay:bills' },
    });
    expect((await run(wrongAudience, circleId)).status).toBe(401);
    expect((await run('', circleId)).status).toBe(401);
    const { rowCount } = await db().query('select 1 from payments where circle_id = $1', [circleId]);
    expect(rowCount).toBe(0);
  });

  it('is off with a clear message when no agent client is configured', async () => {
    const saved = process.env.AUTH0_AGENT_CLIENT_ID;
    delete process.env.AUTH0_AGENT_CLIENT_ID;
    try {
      const { circleId } = await circleWithBill(20_000);
      expect(await run(agentToken, circleId)).toMatchObject({ status: 503, body: { error: 'agent_disabled' } });
    } finally {
      process.env.AUTH0_AGENT_CLIENT_ID = saved;
    }
  });
});
