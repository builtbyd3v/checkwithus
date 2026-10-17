/**
 * The HTTP API as the two iPhone apps use it: real route handlers, real
 * database, in-memory Nessie. `npm run test:db`.
 *
 * Two things are stubbed: Nessie (lib/payments.int.test.ts explains the fake)
 * and the Auth0 signature check, replaced by an `x-test-sub` header. Token
 * verification has its own adversarial tests in lib/auth/family.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createFakeNessie } from '@/test/fake-nessie';

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  // Outside Next's request scope there is nothing to wait for.
  connection: async () => {},
}));

vi.mock('@/lib/auth/family', async () => {
  const { AuthError } = await import('@/lib/auth/http-auth');
  return {
    requireFamilyUser: async (request: Request) => {
      const sub = request.headers.get('x-test-sub');
      if (!sub) throw new AuthError('Missing bearer token');
      return { sub, name: null };
    },
  };
});

const fake = createFakeNessie();
vi.mock('@/lib/services', async () => {
  const { db } = await import('@/lib/db');
  const { createNessieClient } = await import('@/lib/nessie/client');
  const { createPaymentService } = await import('@/lib/payments');
  const service = createPaymentService({
    pool: db(),
    nessie: createNessieClient({ key: 'test-key', fetch: fake.fetch, sleep: async () => {} }),
  });
  return { payments: () => service };
});

const { db } = await import('@/lib/db');
const { normalizeName } = await import('@/lib/names');
const { issueInviteCode } = await import('@/lib/family');
const routes = {
  pairingCode: await import('./family/circles/[id]/pairing-code/route'),
  pair: await import('./device/pair/route'),
  config: await import('./device/config/route'),
  alerts: await import('./device/alerts/route'),
  labels: await import('./device/labels/route'),
  payments: await import('./payments/route'),
  payment: await import('./payments/[id]/route'),
  familyPayments: await import('./family/payments/route'),
  decision: await import('./family/payments/[id]/decision/route'),
  familyAlerts: await import('./family/alerts/route'),
  join: await import('./family/join/route'),
  me: await import('./family/me/route'),
};

const BASE = 'https://checkwith.us/api/v1';
const MARIA = 'test|maria';
let circleId: string;
let inviteCode: string;
let deviceToken: string;

type Init = { body?: unknown; sub?: string; device?: string; method?: string };
function req(path: string, init: Init = {}) {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.sub) headers['x-test-sub'] = init.sub;
  if (init.device) headers.authorization = `Bearer ${init.device}`;
  return new Request(`${BASE}${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers,
    body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const noParams = { params: Promise.resolve({}) };
const read = async (response: Response) => ({ status: response.status, body: await response.json() });

const scamBody = {
  idempotencyKey: 'api-test-scam-0001',
  amountCents: 50_000,
  payee: { name: 'QuickGift Cards', kind: 'merchant' },
  category: 'gift_cards',
  onCall: true,
  guard: { score: 0.97, modelVersion: 'guard-test' },
  explanation: 'The caller said she owes the IRS and must pay in gift cards today.',
};

beforeAll(async () => {
  const { rows } = await db().query<{ id: string }>(
    `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
     values ('Rosa Test (synthetic)', 'test-customer', $1, 500000) returning id`,
    ['test-account-' + crypto.randomUUID()],
  );
  circleId = rows[0]!.id;
  inviteCode = (await issueInviteCode(db(), circleId)).code;
  await db().query(
    `insert into circle_members (circle_id, auth0_sub, display_name) values ($1, $2, 'Maria')`,
    [circleId, MARIA],
  );
  await db().query(
    `insert into payees (circle_id, name, normalized_name, kind, category)
     values ($1, 'City Power & Light', $2, 'biller', 'utilities')`,
    [circleId, normalizeName('City Power & Light')],
  );
});

afterAll(async () => {
  await db().query('delete from circles where id = $1', [circleId]);
  await db().query(`delete from nessie_merchants where nessie_merchant_id like 'fake-%'`);
  await db().end();
});

describe('pairing the older adult\'s phone', () => {
  it('a family member gets a one-time code; the phone trades it for a token', async () => {
    const code = await read(await routes.pairingCode.POST(req(`/family/circles/${circleId}/pairing-code`, { sub: MARIA, method: 'POST' }), params(circleId)));
    expect(code.status).toBe(201);
    expect(code.body.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);

    // Typed sloppily, as people do.
    const sloppy = code.body.code.toLowerCase().replace('-', ' ');
    const paired = await read(await routes.pair.POST(req('/device/pair', { body: { code: sloppy } }), noParams));
    expect(paired.status).toBe(201);
    expect(paired.body.deviceToken).toMatch(/^cwd_/);
    deviceToken = paired.body.deviceToken;

    const reused = await read(await routes.pair.POST(req('/device/pair', { body: { code: code.body.code } }), noParams));
    expect(reused).toMatchObject({ status: 400, body: { error: 'invalid_code' } });
  });

  it('someone outside the circle cannot make a pairing code for it', async () => {
    const response = await routes.pairingCode.POST(
      req(`/family/circles/${circleId}/pairing-code`, { sub: 'test|stranger', method: 'POST' }),
      params(circleId),
    );
    expect(response.status).toBe(404);
  });
});

describe('device authentication', () => {
  it('rejects a missing, malformed or unknown token with 401', async () => {
    for (const device of [undefined, 'not-a-token', 'cwd_' + 'A'.repeat(43)]) {
      const response = await routes.config.GET(req('/device/config', { device }), noParams);
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
    }
  });

  it('gives a paired phone its configuration', async () => {
    const config = await read(await routes.config.GET(req('/device/config', { device: deviceToken }), noParams));
    expect(config).toMatchObject({
      status: 200,
      body: { protectedName: 'Rosa Test (synthetic)', family: [{ displayName: 'Maria' }], approvalTimeoutSeconds: 300 },
    });
  });
});

describe('the demo, over HTTP', () => {
  let scamId: string;

  it('the electricity bill goes straight through', async () => {
    const bill = await read(
      await routes.payments.POST(
        req('/payments', {
          device: deviceToken,
          body: {
            idempotencyKey: 'api-test-bill-0001',
            amountCents: 8_412,
            payee: { name: 'City Power & Light', kind: 'biller' },
            category: 'utilities',
            onCall: false,
          },
        }),
        noParams,
      ),
    );
    expect(bill).toMatchObject({ status: 201, body: { outcome: 'sent', amountCents: 8_412 } });
  });

  it('the gift cards during the call wait for the family', async () => {
    const held = await read(await routes.payments.POST(req('/payments', { device: deviceToken, body: scamBody }), noParams));
    expect(held).toMatchObject({
      status: 201,
      body: { outcome: 'waiting', holdReasons: ['gift_card', 'new_payee', 'over_limit', 'during_call', 'guard_flagged'] },
    });
    scamId = held.body.id;
  });

  it('the family sees it with the AI\'s explanation and plain-words reasons', async () => {
    const list = await read(await routes.familyPayments.GET(req('/family/payments?status=held', { sub: MARIA }), noParams));
    const payment = list.body.payments.find((p: { id: string }) => p.id === scamId);
    expect(payment).toMatchObject({
      protectedName: 'Rosa Test (synthetic)',
      explanation: scamBody.explanation,
      guard: { score: 0.97 },
      holdReasons: expect.arrayContaining([{ code: 'during_call', label: 'Paid while on a phone call' }]),
    });
  });

  it('a stranger sees none of it', async () => {
    const list = await read(await routes.familyPayments.GET(req('/family/payments', { sub: 'test|stranger' }), noParams));
    expect(list.body.payments).toEqual([]);
  });

  it('Maria says no; a second answer is told who already decided', async () => {
    const denied = await read(
      await routes.decision.POST(req(`/family/payments/${scamId}/decision`, { sub: MARIA, body: { decision: 'deny' } }), params(scamId)),
    );
    expect(denied).toMatchObject({ status: 200, body: { status: 'denied', decidedByName: 'Maria', decidedVia: 'app' } });

    const late = await read(
      await routes.decision.POST(req(`/family/payments/${scamId}/decision`, { sub: MARIA, body: { decision: 'approve' } }), params(scamId)),
    );
    expect(late).toMatchObject({
      status: 409,
      body: { error: 'already_decided', payment: { status: 'denied', decidedByName: 'Maria' } },
    });
  });

  it('the older adult\'s phone learns the outcome in one word', async () => {
    const status = await read(await routes.payment.GET(req(`/payments/${scamId}`, { device: deviceToken }), params(scamId)));
    expect(status).toMatchObject({ status: 200, body: { outcome: 'blocked_by_family', decidedByName: 'Maria' } });
  });

  it('the decision becomes a training label for the Guard on the phone', async () => {
    const labels = await read(await routes.labels.GET(req('/device/labels', { device: deviceToken }), noParams));
    expect(labels.body.labels).toContainEqual(expect.objectContaining({ paymentId: scamId, label: 'scam' }));
    // The bill was allowed by the rules, not decided by the family: not a label.
    expect(labels.body.labels).toHaveLength(1);
  });

  it('no money reached Nessie except the bill', async () => {
    expect(fake.paymentWrites()).toHaveLength(1);
    expect(fake.paymentWrites()[0]!.path).toMatch(/\/bills$/);
  });
});

describe('strict input', () => {
  it('rejects dollars sent where cents are expected, naming the field', async () => {
    const response = await read(
      await routes.payments.POST(req('/payments', { device: deviceToken, body: { ...scamBody, idempotencyKey: 'api-test-dollars-01', amountCents: 499.5 } }), noParams),
    );
    expect(response.status).toBe(400);
    expect(response.body.details).toContainEqual(expect.objectContaining({ path: 'amountCents' }));
  });

  it('rejects an unknown field instead of ignoring it', async () => {
    const { amountCents: _omit, ...rest } = scamBody;
    const response = await read(
      await routes.payments.POST(req('/payments', { device: deviceToken, body: { ...rest, idempotencyKey: 'api-test-unknown-1', amount: 500 } }), noParams),
    );
    expect(response.status).toBe(400);
  });

  it('refuses cents where Nessie would truncate them', async () => {
    const response = await read(
      await routes.payments.POST(req('/payments', { device: deviceToken, body: { ...scamBody, idempotencyKey: 'api-test-cents-001', amountCents: 49_999 } }), noParams),
    );
    expect(response).toMatchObject({ status: 422, body: { error: 'whole_dollars_only' } });
  });

  it('rejects malformed JSON and oversized bodies', async () => {
    expect((await routes.payments.POST(req('/payments', { device: deviceToken, body: '{not json' }), noParams)).status).toBe(400);
    const huge = { ...scamBody, explanation: 'x'.repeat(20_000) };
    expect((await routes.payments.POST(req('/payments', { device: deviceToken, body: huge }), noParams)).status).toBe(413);
  });

  it('answers a non-UUID id with 404, before it reaches SQL', async () => {
    const response = await routes.payment.GET(req('/payments/1%20or%201=1', { device: deviceToken }), params('1 or 1=1'));
    expect(response.status).toBe(404);
  });
});

describe('alerts and the family circle', () => {
  it('"Ask my family" reaches the family', async () => {
    const sent = await routes.alerts.POST(req('/device/alerts', { device: deviceToken, body: { kind: 'ask_family' } }), noParams);
    expect(sent.status).toBe(201);
    const alerts = await read(await routes.familyAlerts.GET(req('/family/alerts', { sub: MARIA }), noParams));
    expect(alerts.body.alerts[0]).toMatchObject({ kind: 'ask_family', protectedName: 'Rosa Test (synthetic)' });
  });

  it('joins with the invite code, up to three people, and not a fourth', async () => {
    for (const [sub, name] of [['test|leo', 'Leo'], ['test|ana', 'Ana']]) {
      const joined = await routes.join.POST(req('/family/join', { sub, body: { inviteCode, displayName: name } }), noParams);
      expect(joined.status).toBe(200);
    }
    const me = await read(await routes.me.GET(req('/family/me', { sub: 'test|leo' }), noParams));
    expect(me.body.circles).toEqual([{ circleId, protectedName: 'Rosa Test (synthetic)', yourName: 'Leo' }]);

    const fourth = await read(
      await routes.join.POST(req('/family/join', { sub: 'test|fourth', body: { inviteCode, displayName: 'Four' } }), noParams),
    );
    expect(fourth).toMatchObject({ status: 409, body: { error: 'circle_full' } });

    // Someone already in the full circle using the invite again is a no-op, not "full".
    const again = await routes.join.POST(
      req('/family/join', { sub: 'test|leo', body: { inviteCode, displayName: 'Leo' } }),
      noParams,
    );
    expect(again.status).toBe(200);
  });

  it('an expired invite gets the same answer as a wrong one', async () => {
    await db().query(`update circles set invite_expires_at = now() - interval '1 second' where id = $1`, [circleId]);
    const response = await read(
      await routes.join.POST(req('/family/join', { sub: 'test|late', body: { inviteCode, displayName: 'Late' } }), noParams),
    );
    expect(response).toMatchObject({ status: 404, body: { error: 'invalid_invite' } });
  });

  it('a wrong invite code is just "not valid"', async () => {
    const response = await read(
      await routes.join.POST(req('/family/join', { sub: 'test|x', body: { inviteCode: 'ZZZZ-ZZZZ', displayName: 'X' } }), noParams),
    );
    expect(response).toMatchObject({ status: 404, body: { error: 'invalid_invite' } });
  });

  it('a revoked phone is locked out', async () => {
    await db().query(`update devices set revoked_at = now() where circle_id = $1`, [circleId]);
    const response = await routes.config.GET(req('/device/config', { device: deviceToken }), noParams);
    expect(response.status).toBe(401);
  });
});
