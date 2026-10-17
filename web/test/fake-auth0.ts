/**
 * An in-memory Auth0 tenant for CIBA tests, behind a fake `fetch`. It signs
 * real RS256 ID tokens with a local key, so the code's token verification
 * runs for real. Each family member's Guardian answer is set with `answer`.
 */
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';

export const FAKE_AUTH0 = {
  domain: 'checkwith-test.us.auth0.com',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
};
const ISSUER = `https://${FAKE_AUTH0.domain}/`;

type Answer = 'pending' | 'approve' | 'deny' | 'expire' | 'slow_down';
type PushRequest = {
  sub: string;
  message: string;
  expiry: number;
  answer: Answer;
  tokenSub?: string;
  audience?: string;
  /** The parsed authorization_details, when sent. */
  details?: unknown;
  /** RBAC claim for the access token; without it the access token is opaque. */
  permissions?: string[];
};

export type FakeAuth0 = Awaited<ReturnType<typeof createFakeAuth0>>;

export async function createFakeAuth0() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }],
  });
  const pushes = new Map<string, PushRequest>();
  const notEnrolled = new Set<string>();
  const calls: Array<{ path: string; fields: Record<string, string> }> = [];
  /** Off: like a tenant whose API has not registered the details type. */
  const settings = { rarRegistered: true };
  let next = 1;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  async function fetch(url: string, init: RequestInit): Promise<Response> {
    const path = new URL(url).pathname;
    const fields = Object.fromEntries(new URLSearchParams(String(init.body)));
    calls.push({ path, fields });
    if (fields.client_id !== FAKE_AUTH0.clientId || fields.client_secret !== FAKE_AUTH0.clientSecret) {
      return json(401, { error: 'access_denied', error_description: 'Unauthorized' });
    }

    if (path === '/bc-authorize') {
      const message = fields.binding_message ?? '';
      // The two rules verified against the real tenant.
      if (!/^[A-Za-z0-9\s+\-_.,:#]*$/.test(message)) {
        return json(400, {
          error: 'invalid_request',
          error_description: 'binding_message can contain only alphanumerics, whitespace and `+-_.,:#` characters',
        });
      }
      if (message.length > 64) {
        return json(400, { error: 'invalid_request', error_description: 'binding_message should not exceed 64 characters' });
      }
      if (fields.authorization_details && !settings.rarRegistered) {
        return json(400, { error: 'invalid_request', error_description: 'authorization_details type is not allowed' });
      }
      const sub = (JSON.parse(fields.login_hint ?? '{}') as { sub?: string }).sub ?? '';
      if (notEnrolled.has(sub)) {
        return json(400, { error: 'invalid_request', error_description: 'User has no enrolled push notification device' });
      }
      // Unique across fake instances, like Auth0's: the column is unique, so ids
      // restarting at 1 in each test would collide with earlier tests' rows.
      const id = `fake-auth-req-${next++}-${crypto.randomUUID()}`;
      pushes.set(id, {
        sub, message, expiry: Number(fields.requested_expiry), answer: 'pending', audience: fields.audience,
        details: fields.authorization_details ? JSON.parse(fields.authorization_details) : undefined,
      });
      return json(200, { auth_req_id: id, expires_in: Number(fields.requested_expiry), interval: 5 });
    }

    if (path === '/oauth/token' && fields.grant_type === 'urn:openid:params:grant-type:ciba') {
      const push = pushes.get(fields.auth_req_id ?? '');
      if (!push) return json(400, { error: 'invalid_grant', error_description: 'Invalid auth_req_id' });
      switch (push.answer) {
        case 'pending':
          return json(400, { error: 'authorization_pending', error_description: 'The end-user authorization is pending.' });
        case 'slow_down':
          return json(400, { error: 'slow_down', error_description: 'You are polling faster than allowed.', interval: 15 });
        case 'expire':
          return json(400, { error: 'expired_token', error_description: 'The auth_req_id has expired.' });
        case 'deny':
          return json(400, {
            error: 'access_denied',
            error_description: 'The end-user denied the authorization request or it has been expired.',
          });
        case 'approve': {
          const idToken = await new SignJWT({})
            .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
            .setSubject(push.tokenSub ?? push.sub)
            .setIssuer(ISSUER)
            .setAudience(FAKE_AUTH0.clientId)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);
          const accessToken = push.permissions && push.audience
            ? await new SignJWT({ permissions: push.permissions })
                .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
                .setSubject(push.tokenSub ?? push.sub)
                .setIssuer(ISSUER)
                .setAudience(push.audience)
                .setIssuedAt()
                .setExpirationTime('5m')
                .sign(privateKey)
            : 'opaque';
          return json(200, { access_token: accessToken, id_token: idToken, token_type: 'Bearer', expires_in: 86400 });
        }
      }
    }
    return json(404, { error: 'not_found' });
  }

  return {
    fetch,
    keys,
    calls,
    pushes,
    notEnrolled,
    settings,
    /** What the member taps in Guardian, on their most recent push. */
    answer(sub: string, answer: Answer, options: { tokenSub?: string; permissions?: string[] } = {}) {
      const entry = [...pushes.values()].reverse().find((p) => p.sub === sub);
      if (!entry) throw new Error(`no push was sent to ${sub}`);
      entry.answer = answer;
      entry.tokenSub = options.tokenSub;
      entry.permissions = options.permissions;
    },
    tokenPolls: () => calls.filter((c) => c.path === '/oauth/token'),
  };
}
