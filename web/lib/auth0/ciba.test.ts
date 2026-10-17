import { beforeEach, describe, expect, it } from 'vitest';
import { toCents } from '@/lib/money';
import { createFakeAuth0, FAKE_AUTH0, type FakeAuth0 } from '@/test/fake-auth0';
import { bindingMessage, CibaError, createCibaClient, paymentAuthorizationDetails } from './ciba';

describe('bindingMessage', () => {
  it('says who, how much and to whom, in characters Auth0 accepts', () => {
    expect(
      bindingMessage({ protectedName: 'Rosa Diaz', amountCents: toCents(50_000), payeeName: 'QuickGift Cards' }),
    ).toBe('Rosa: 500.00 USD to QuickGift Cards');
  });

  it('drops characters Auth0 rejects ($, ?, &, quotes) and accents', () => {
    const message = bindingMessage({
      protectedName: 'José',
      amountCents: toCents(123_456),
      payeeName: 'Tom & Jerry\'s "Gift" Shop?',
    });
    expect(message).toBe('Jose: 1,234.56 USD to Tom Jerrys Gift Shop');
    expect(message).toMatch(/^[A-Za-z0-9\s+\-_.,:#]*$/);
  });

  it('never exceeds 64 characters, keeping who and how much', () => {
    const message = bindingMessage({
      protectedName: 'Rosa',
      amountCents: toCents(50_000),
      payeeName: 'A Payee With An Extraordinarily Long Name That Goes On And On',
    });
    expect(message.length).toBeLessThanOrEqual(64);
    expect(message.startsWith('Rosa: 500.00 USD to ')).toBe(true);
  });

  it('always shows the amount, however long the first name', () => {
    const message = bindingMessage({
      protectedName: 'A'.repeat(60),
      amountCents: toCents(100_000_000), // the largest amount the API accepts
      payeeName: 'QuickGift Cards',
    });
    expect(message.length).toBeLessThanOrEqual(64);
    expect(message).toContain('1,000,000.00 USD to Q');
  });

  it('still says something when the names are all rejected characters', () => {
    expect(bindingMessage({ protectedName: '???', amountCents: toCents(100), payeeName: '$$$' })).toBe(
      'Payment: 1.00 USD to unknown payee',
    );
  });
});

describe('createCibaClient', () => {
  let auth0: FakeAuth0;
  let client: ReturnType<typeof createCibaClient>;

  beforeEach(async () => {
    auth0 = await createFakeAuth0();
    client = createCibaClient({ ...FAKE_AUTH0, fetch: auth0.fetch, keys: auth0.keys });
  });

  const start = (sub = 'auth0|maria') =>
    client.start({ sub, bindingMessage: 'Rosa: 500.00 USD to QuickGift Cards', expirySeconds: 300 });

  it('starts a push with the CIBA fields Auth0 requires', async () => {
    const started = await start();
    expect(started).toMatchObject({ expiresInSeconds: 300, intervalSeconds: 5 });
    const sent = auth0.calls[0]!.fields;
    expect(sent).toMatchObject({ scope: 'openid', requested_expiry: '300' });
    expect(JSON.parse(sent.login_hint!)).toEqual({
      format: 'iss_sub',
      iss: `https://${FAKE_AUTH0.domain}/`,
      sub: 'auth0|maria',
    });
  });

  it('caps the expiry at 300s, which is what makes Auth0 use push rather than email', async () => {
    await client.start({ sub: 'auth0|maria', bindingMessage: 'x', expirySeconds: 9_999 });
    expect(auth0.calls[0]!.fields.requested_expiry).toBe('300');
  });

  const AUDIENCE = 'https://api.checkwith.us/';
  const payment = {
    amountCents: toCents(150_000),
    payee: 'QuickGift Cards',
    reasons: ['Gift card purchase', 'Paid while on a phone call'],
    approvalsRequired: 2,
  };

  it('sends the API audience and, with RAR on, one Guardian display object with the payment', async () => {
    const detailed = createCibaClient({
      ...FAKE_AUTH0, audience: AUDIENCE, richAuthorizationDetails: true, fetch: auth0.fetch, keys: auth0.keys,
    });
    await detailed.start({ sub: 'auth0|maria', bindingMessage: 'Rosa: 1,500.00 USD to QuickGift Cards', expirySeconds: 300, payment });
    const fields = auth0.calls[0]!.fields;
    expect(fields.audience).toBe(AUDIENCE);
    expect(fields.binding_message).toBe('Rosa: 1,500.00 USD to QuickGift Cards');
    expect(JSON.parse(fields.authorization_details!)).toEqual([{
      type: 'urn:auth0:schemas:authorization-details:v1:payment',
      instruction: 'Approve or deny this held payment.',
      properties: {
        amount: { display: true, name: 'Amount (USD)', display_order: 1, value: '$1,500.00' },
        payee: { display: true, name: 'Payee', display_order: 2, value: 'QuickGift Cards' },
        reason: { display: true, name: 'Why it paused', display_order: 3, value: 'Gift card purchase, Paid while on a phone call' },
        approvals: { display: true, name: 'Approvals needed', display_order: 4, value: '2 family approvers' },
        amount_cents: { display: false, value: 150_000 },
      },
    }]);
  });

  it('leaves out "Approvals needed" when one approval is enough', () => {
    const [details] = paymentAuthorizationDetails({ ...payment, approvalsRequired: 1 });
    expect(details!.properties).not.toHaveProperty('approvals');
  });

  it('with RAR off (the default), sends neither audience nor details, as the tenant accepts today', async () => {
    const plain = createCibaClient({ ...FAKE_AUTH0, audience: AUDIENCE, fetch: auth0.fetch, keys: auth0.keys });
    await plain.start({ sub: 'auth0|maria', bindingMessage: 'Payment', expirySeconds: 300, payment });
    expect(auth0.calls[0]!.fields).not.toHaveProperty('audience');
    expect(auth0.calls[0]!.fields).not.toHaveProperty('authorization_details');
  });

  it('falls back to the binding message alone when the tenant refuses the details', async () => {
    auth0.settings.rarRegistered = false;
    const detailed = createCibaClient({
      ...FAKE_AUTH0, audience: AUDIENCE, richAuthorizationDetails: true, fetch: auth0.fetch, keys: auth0.keys,
    });
    await expect(
      detailed.start({ sub: 'auth0|maria', bindingMessage: 'Payment', expirySeconds: 300, payment }),
    ).resolves.toMatchObject({ authReqId: expect.any(String) });
    expect(auth0.calls.map((c) => ['audience' in c.fields, 'authorization_details' in c.fields])).toEqual([
      [true, true],
      [false, false],
    ]);
    expect(auth0.pushes.size).toBe(1);
  });

  it('reads the RBAC permissions of the verified access token on approval', async () => {
    const withApi = createCibaClient({
      ...FAKE_AUTH0, audience: AUDIENCE, richAuthorizationDetails: true, fetch: auth0.fetch, keys: auth0.keys,
    });
    const { authReqId } = await withApi.start({ sub: 'auth0|maria', bindingMessage: 'x', expirySeconds: 300 });
    auth0.answer('auth0|maria', 'approve', { permissions: ['read:payments'] });
    await expect(withApi.poll(authReqId)).resolves.toEqual({
      kind: 'approved', sub: 'auth0|maria', permissions: ['read:payments'],
    });
  });

  describe('the API access token fails closed', () => {
    const approveWith = async (
      options: Parameters<FakeAuth0['answer']>[2],
      client = createCibaClient({
        ...FAKE_AUTH0, audience: AUDIENCE, richAuthorizationDetails: true, fetch: auth0.fetch, keys: auth0.keys,
      }),
    ) => {
      const { authReqId } = await client.start({ sub: 'auth0|maria', bindingMessage: 'x', expirySeconds: 300 });
      auth0.answer('auth0|maria', 'approve', options);
      return client.poll(authReqId);
    };

    it('a token for our API that does not verify grants nothing', async () => {
      await expect(approveWith({ permissions: ['approve:payments'], accessForged: true })).resolves.toMatchObject({ permissions: [] });
    });

    it('a token for our API naming someone else grants nothing', async () => {
      await expect(approveWith({ permissions: ['approve:payments'], accessSub: 'auth0|intruder' })).resolves.toMatchObject({ permissions: [] });
    });

    it('with AUTH0_RBAC, a token for our API without the claim grants nothing', async () => {
      const strict = createCibaClient({
        ...FAKE_AUTH0, audience: AUDIENCE, richAuthorizationDetails: true, requirePermissionsClaim: true,
        fetch: auth0.fetch, keys: auth0.keys,
      });
      await expect(approveWith({ apiToken: true }, strict)).resolves.toMatchObject({ permissions: [] });
    });

    it('without AUTH0_RBAC, a token without the claim leaves it to the circle role', async () => {
      await expect(approveWith({ apiToken: true })).resolves.toEqual({ kind: 'approved', sub: 'auth0|maria' });
    });
  });

  it('keeps payee and reasons in the binding message charset, and short', () => {
    const [details] = paymentAuthorizationDetails({
      ...payment, payee: `Tom & Jerry's "Gift" <Shop>? ${'x'.repeat(100)}`, reasons: ['Gift card; $$$', 'R'.repeat(300)],
    });
    const { payee, reason } = details!.properties;
    expect(payee.value).toMatch(/^Tom Jerrys Gift Shop x+$/);
    expect(String(payee.value).length).toBeLessThanOrEqual(64);
    expect(reason.value).toMatch(/^[A-Za-z0-9\s+\-_.,:#]*$/);
    expect(String(reason.value).length).toBeLessThanOrEqual(200);
  });

  it('reports no permissions when the access token is opaque (RBAC off)', async () => {
    const withApi = createCibaClient({
      ...FAKE_AUTH0, audience: AUDIENCE, richAuthorizationDetails: true, fetch: auth0.fetch, keys: auth0.keys,
    });
    const { authReqId } = await withApi.start({ sub: 'auth0|maria', bindingMessage: 'x', expirySeconds: 300 });
    auth0.answer('auth0|maria', 'approve');
    await expect(withApi.poll(authReqId)).resolves.toEqual({ kind: 'approved', sub: 'auth0|maria' });
  });

  it('reports a member who is not enrolled in Guardian', async () => {
    auth0.notEnrolled.add('auth0|leo');
    await expect(start('auth0|leo')).rejects.toBeInstanceOf(CibaError);
  });

  it.each([
    ['pending', { kind: 'pending' }],
    ['slow_down', { kind: 'slow_down', intervalSeconds: 15 }],
    ['deny', { kind: 'denied_or_expired' }],
    ['expire', { kind: 'expired' }],
  ] as const)('maps a %s answer', async (answer, expected) => {
    const { authReqId } = await start();
    auth0.answer('auth0|maria', answer);
    await expect(client.poll(authReqId)).resolves.toEqual(expected);
  });

  it('reports an approval with the subject from the verified ID token', async () => {
    const { authReqId } = await start();
    auth0.answer('auth0|maria', 'approve');
    await expect(client.poll(authReqId)).resolves.toEqual({ kind: 'approved', sub: 'auth0|maria' });
  });

  it('does not count an approval whose ID token was signed by someone else', async () => {
    const { authReqId } = await start();
    auth0.answer('auth0|maria', 'approve');
    const stranger = await createFakeAuth0();
    const fooled = createCibaClient({ ...FAKE_AUTH0, fetch: auth0.fetch, keys: stranger.keys });
    await expect(fooled.poll(authReqId)).resolves.toMatchObject({ kind: 'invalid' });
  });

  it('never reads our own bad credentials (401 access_denied) as a member saying no', async () => {
    const { authReqId } = await start();
    auth0.answer('auth0|maria', 'deny');
    const misconfigured = createCibaClient({
      ...FAKE_AUTH0,
      clientSecret: 'rotated-or-wrong',
      fetch: auth0.fetch,
      keys: auth0.keys,
    });
    await expect(misconfigured.poll(authReqId)).resolves.toMatchObject({ kind: 'unavailable' });
  });

  it('treats an unknown request id as permanently invalid', async () => {
    await expect(client.poll('no-such-request')).resolves.toMatchObject({ kind: 'invalid' });
  });

  it('treats network failure as "try again", never as an answer', async () => {
    const offline = createCibaClient({
      ...FAKE_AUTH0,
      fetch: async () => {
        throw new Error('fetch failed');
      },
      keys: auth0.keys,
    });
    await expect(offline.poll('anything')).resolves.toMatchObject({ kind: 'unavailable' });
  });
});
