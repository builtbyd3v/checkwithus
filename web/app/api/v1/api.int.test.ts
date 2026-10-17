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
import { toCents } from '@/lib/money';

const bankDirectory = vi.hoisted(() => vi.fn(async () => ({ locations: [
  { id: 'synthetic-atm', kind: 'atm', name: 'Test ATM', coordinates: { latitude: 29.65, longitude: -82.32 }, address: null },
] })));
vi.mock('@/lib/bank-locations', () => ({ bankLocations: bankDirectory }));

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
      const authTime = request.headers.get('x-test-auth-time');
      return { sub, name: null, ...(authTime ? { authTime: Number(authTime) } : {}) };
    },
  };
});

const fake = createFakeNessie();
// Routes that read Nessie directly (balance) must hit the fake, never the real sandbox.
vi.mock('@/lib/nessie/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/nessie/client')>();
  const client = actual.createNessieClient({ key: 'test-key', fetch: fake.fetch, sleep: async () => {} });
  return { ...actual, nessie: () => client };
});
/** Flipped by the CIBA-mode test. CIBA itself is covered in lib/approvals.int.test.ts. */
const approvalMode = { ciba: false };
const pollPayment = vi.fn(async () => {});
vi.mock('@/lib/services', async () => {
  const { db } = await import('@/lib/db');
  const { createNessieClient } = await import('@/lib/nessie/client');
  const { createPaymentService } = await import('@/lib/payments');
  const { createFreezeService } = await import('@/lib/freeze');
  const nessie = createNessieClient({ key: 'test-key', fetch: fake.fetch, sleep: async () => {} });
  const service = createPaymentService({ pool: db(), nessie });
  const freezeService = createFreezeService({ pool: db(), nessie });
  const { createTopUpService } = await import('@/lib/top-up');
  const topUpService = createTopUpService({ pool: db(), nessie });
  return {
    payments: () => service,
    freeze: () => freezeService,
    topUp: () => topUpService,
    cibaApprovals: () => approvalMode.ciba ? { pollPayment, pollCircles: async () => {} } : null,
    approvalsUseCiba: () => approvalMode.ciba,
  };
});

const { db } = await import('@/lib/db');
const { normalizeName } = await import('@/lib/names');
const { issueInviteCode } = await import('@/lib/family');
const routes = {
  pairingCode: await import('./family/circles/[id]/pairing-code/route'),
  pair: await import('./device/pair/route'),
  config: await import('./device/config/route'),
  bankLocations: await import('./device/bank-locations/route'),
  alerts: await import('./device/alerts/route'),
  labels: await import('./device/labels/route'),
  payments: await import('./payments/route'),
  payment: await import('./payments/[id]/route'),
  familyPayments: await import('./family/payments/route'),
  familyPayment: await import('./family/payments/[id]/route'),
  decision: await import('./family/payments/[id]/decision/route'),
  familyAlerts: await import('./family/alerts/route'),
  join: await import('./family/join/route'),
  me: await import('./family/me/route'),
  freeze: await import('./family/circles/[id]/freeze/route'),
  unfreeze: await import('./family/circles/[id]/unfreeze/route'),
  balance: await import('./family/circles/[id]/balance/route'),
  topUp: await import('./family/circles/[id]/top-up/route'),
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
  it('serves the bank directory only to paired devices', async () => {
    bankDirectory.mockClear();
    const denied = await routes.bankLocations.GET(req('/device/bank-locations'), noParams);
    expect(denied.status).toBe(401);
    expect(bankDirectory).not.toHaveBeenCalled();
    const response = await read(await routes.bankLocations.GET(req('/device/bank-locations', { device: deviceToken }), noParams));
    expect(response).toMatchObject({ status: 200, body: { locations: [{ id: 'synthetic-atm', kind: 'atm' }] } });
    expect(bankDirectory).toHaveBeenCalledTimes(1);
  });

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
  let billId: string;

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
    billId = bill.body.id;
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

  it('in CIBA mode the app cannot approve, only deny', async () => {
    const held = await read(
      await routes.payments.POST(
        req('/payments', { device: deviceToken, body: { ...scamBody, idempotencyKey: 'api-test-ciba-mode-1' } }),
        noParams,
      ),
    );
    approvalMode.ciba = true;
    try {
      const approve = await read(
        await routes.decision.POST(
          req(`/family/payments/${held.body.id}/decision`, { sub: MARIA, body: { decision: 'approve' } }),
          params(held.body.id),
        ),
      );
      // A sign-in token alone must not move money: approvals come from Guardian.
      expect(approve).toMatchObject({ status: 403, body: { error: 'approve_in_guardian' } });

      const deny = await read(
        await routes.decision.POST(
          req(`/family/payments/${held.body.id}/decision`, { sub: MARIA, body: { decision: 'deny' } }),
          params(held.body.id),
        ),
      );
      expect(deny).toMatchObject({ status: 200, body: { status: 'denied' } });
    } finally {
      approvalMode.ciba = false;
    }
  });

  it('the older adult\'s phone learns the outcome in one word', async () => {
    const status = await read(await routes.payment.GET(req(`/payments/${scamId}`, { device: deviceToken }), params(scamId)));
    expect(status).toMatchObject({ status: 200, body: { outcome: 'blocked_by_family', decidedByName: 'Maria' } });
  });

  it('the decision becomes a training label for the Guard on the phone', async () => {
    const labels = await read(await routes.labels.GET(req('/device/labels', { device: deviceToken }), noParams));
    expect(labels.body.labels).toContainEqual(expect.objectContaining({ paymentId: scamId, label: 'scam' }));
    // The bill was allowed by the rules, not decided by the family: not a label.
    expect(labels.body.labels.map((l: { paymentId: string }) => l.paymentId)).not.toContain(billId);
  });

  it('no money reached Nessie except the bill', async () => {
    expect(fake.paymentWrites()).toHaveLength(1);
    expect(fake.paymentWrites()[0]!.path).toMatch(/\/bills$/);
  });
});

describe('family payment detail and recovery', () => {
  it('requires sign-in and hides unknown or unauthorized payments before polling', async () => {
    const { payments } = await import('@/lib/services');
    const held = await payments().createPayment(circleId, {
      idempotencyKey: 'api-detail-private', amountCents: toCents(50000),
      payeeName: 'Synthetic gift cards', payeeKind: 'merchant', category: 'gift_cards',
      onCall: true, guard: null, explanation: null,
    });
    approvalMode.ciba = true;
    pollPayment.mockClear();
    const writes = fake.paymentWrites().length;
    try {
      expect((await routes.familyPayment.GET(req(`/family/payments/${held.id}`), params(held.id))).status).toBe(401);
      for (const id of [held.id, crypto.randomUUID(), 'not-a-uuid']) {
        expect((await routes.familyPayment.GET(req(`/family/payments/${id}`, { sub: 'test|stranger' }), params(id))).status).toBe(404);
      }
      expect(pollPayment).not.toHaveBeenCalled();
      const response = await routes.familyPayment.GET(req(`/family/payments/${held.id}`, { sub: MARIA }), params(held.id));
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toMatchObject({ id: held.id, status: 'held', protectedName: 'Rosa Test (synthetic)' });
      expect(pollPayment).toHaveBeenCalledWith(held.id, circleId);
      expect(fake.paymentWrites()).toHaveLength(writes);
    } finally { approvalMode.ciba = false; }
  });

  it('expires an unanswered hold when only the family checks it', async () => {
    const { rows } = await db().query<{ id: string }>(
      `insert into payments (circle_id, idempotency_key, amount_cents, payee_name, payee_kind,
         category, on_call, payee_known, status, expires_at)
       values ($1, 'api-detail-expired', 50000, 'Synthetic shop', 'merchant', 'shopping',
         false, false, 'held', now() - interval '1 second') returning id`, [circleId],
    );
    const id = rows[0]!.id;
    const response = await read(await routes.familyPayment.GET(req(`/family/payments/${id}`, { sub: MARIA }), params(id)));
    expect(response).toMatchObject({ status: 200, body: { status: 'expired', decidedVia: 'timeout' } });
  });

  it('recovers a bank write without resending when only the family polls', async () => {
    const { payments } = await import('@/lib/services');
    fake.failNext('/bills', 'lostThen500');
    const payment = await payments().createPayment(circleId, {
      idempotencyKey: 'api-detail-recovery', amountCents: toCents(8412), payeeName: 'City Power & Light',
      payeeKind: 'biller', category: 'utilities', onCall: false, guard: null, explanation: null,
    });
    expect(payment.status).toBe('paying');
    const account = await db().query<{ nessie_account_id: string }>('select nessie_account_id from circles where id = $1', [circleId]);
    fake.records.push({ kind: 'bills', accountId: account.rows[0]!.nessie_account_id,
      body: { _id: 'fake-family-recovered', payee: 'City Power & Light', nickname: `Utilities [cw:${payment.id}]`,
        payment_date: '2026-10-17', payment_amount: 84.12 } });
    await db().query('update payments set next_lookup_at = now() where id = $1', [payment.id]);
    const writes = fake.paymentWrites().length;
    for (let i = 0; i < 2; i++) {
      const response = await read(await routes.familyPayment.GET(req(`/family/payments/${payment.id}`, { sub: MARIA }), params(payment.id)));
      expect(response).toMatchObject({ status: 200, body: { status: 'paid', amountCents: 8412 } });
    }
    expect(fake.paymentWrites()).toHaveLength(writes);
    const ledger = await db().query('select amount_cents from spending where payment_id = $1', [payment.id]);
    expect(ledger.rows).toEqual([{ amount_cents: 8412 }]);
  });
});

describe('strict input', () => {
  it('rejects malformed label cursors and ambiguous pagination', async () => {
    const malformed = Buffer.from(JSON.stringify({ decidedAt: 'not-a-date', paymentId: 'not-an-id' })).toString('base64url');
    for (const query of ['cursor=garbage', `cursor=${malformed}`, 'cursor=abc&after=2026-10-17T00:00:00Z']) {
      const response = await routes.labels.GET(req(`/device/labels?${query}`, { device: deviceToken }), noParams);
      expect(response.status).toBe(400);
    }
  });

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

describe('Freeze over HTTP (the family app contract)', () => {
  it('an approver freezes with {} and unfreezes an amount; a viewer gets 403', async () => {
    const path = `/family/circles/${circleId}`;
    expect((await routes.freeze.POST(req(`${path}/freeze`, { sub: MARIA, body: { extra: true } }), params(circleId))).status).toBe(400);
    // Leo joined by invite, so he is a viewer.
    expect(await read(await routes.freeze.POST(req(`${path}/freeze`, { sub: 'test|leo', body: {} }), params(circleId))))
      .toMatchObject({ status: 403, body: { error: 'permission_required' } });

    const frozen = await read(await routes.freeze.POST(req(`${path}/freeze`, { sub: MARIA, body: {} }), params(circleId)));
    expect(frozen).toEqual({ status: 200, body: { frozen: true, movedCents: expect.any(Number) } });
    expect(frozen.body.movedCents).toBeGreaterThan(0);

    expect((await routes.unfreeze.POST(req(`${path}/unfreeze`, { sub: MARIA, body: { amountCents: '100' } }), params(circleId))).status).toBe(400);
    // Unfreezing removes a protection: it needs a recent sign-in.
    expect(await read(await routes.unfreeze.POST(req(`${path}/unfreeze`, { sub: MARIA, body: { amountCents: 10_000 } }), params(circleId))))
      .toMatchObject({ status: 403, body: { error: 'step_up_required' } });
    const fresh = req(`${path}/unfreeze`, { sub: MARIA, body: { amountCents: 10_000 } });
    fresh.headers.set('x-test-auth-time', String(Math.floor(Date.now() / 1000)));
    expect(await read(await routes.unfreeze.POST(fresh, params(circleId))))
      .toEqual({ status: 200, body: { frozen: false, movedCents: 10_000 } });
  });

  it('the balance is integer cents from the ledger; Nessie\'s stored balance is informational', async () => {
    const balance = async () => read(await routes.balance.GET(req(`/family/circles/${circleId}/balance`, { sub: MARIA }), params(circleId)));
    // The circle's Nessie account is not in the fake: Nessie unreachable must not hide the balance.
    const offline = await balance();
    expect(offline).toMatchObject({ status: 200, body: { nessieReportedBalanceCents: null, balanceSource: 'ledger', frozen: false } });
    for (const key of ['ledgerBalanceCents', 'reservedCents', 'availableCents']) expect(Number.isInteger(offline.body[key])).toBe(true);
    expect(offline.body.availableCents).toBe(Math.max(0, offline.body.ledgerBalanceCents - offline.body.reservedCents));

    // A stored balance below the ledger is not a ceiling: Nessie never updates it.
    const { rows } = await db().query<{ nessie_account_id: string }>('select nessie_account_id from circles where id = $1', [circleId]);
    fake.accounts.push({ _id: rows[0]!.nessie_account_id, customer_id: 'test-customer', type: 'Checking', nickname: 'x', balance: 1 });
    const live = await balance();
    expect(live.body).toMatchObject({ nessieReportedBalanceCents: 100, availableCents: offline.body.availableCents });
  });

  it('an approver tops up spending with a fresh login and an idempotency key; the balance shows it', async () => {
    const path = `/family/circles/${circleId}/top-up`;
    const body = { amountCents: 2_500, idempotencyKey: 'api-test-topup-0001' };
    expect((await routes.topUp.POST(req(path, { sub: MARIA, body: { amountCents: 2_500 } }), params(circleId))).status).toBe(400);
    expect(await read(await routes.topUp.POST(req(path, { sub: MARIA, body }), params(circleId))))
      .toMatchObject({ status: 403, body: { error: 'step_up_required' } });
    const before = await read(await routes.balance.GET(req(`/family/circles/${circleId}/balance`, { sub: MARIA }), params(circleId)));
    const fresh = () => {
      const r = req(path, { sub: MARIA, body });
      r.headers.set('x-test-auth-time', String(Math.floor(Date.now() / 1000)));
      return r;
    };
    const first = await read(await routes.topUp.POST(fresh(), params(circleId)));
    expect(first).toEqual({ status: 200, body: { id: expect.any(String), movedCents: 2_500, status: 'sent' } });
    expect(await read(await routes.topUp.POST(fresh(), params(circleId)))).toEqual(first);
    const after = await read(await routes.balance.GET(req(`/family/circles/${circleId}/balance`, { sub: MARIA }), params(circleId)));
    expect(after.body.ledgerBalanceCents).toBe(before.body.ledgerBalanceCents + 2_500);
  });
});
