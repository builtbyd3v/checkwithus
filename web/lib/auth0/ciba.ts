/**
 * Auth0 CIBA (Client-Initiated Backchannel Authentication): we ask Auth0 to
 * push "approve this payment?" to a family member's Auth0 Guardian app, they
 * answer there (with Face ID), and we learn the answer by polling Auth0.
 *
 * An approval only counts if Auth0 itself reports it, and the ID token Auth0
 * returns is verified to belong to the member we asked. So unlike an app
 * calling our API, a stolen sign-in cannot approve: it takes the member's
 * enrolled phone.
 *
 * Verified against our tenant on 2026-10-17: bc-authorize reaches user
 * lookup (CIBA enabled); binding_message allows letters, digits, whitespace
 * and +-_.,:# only, at most 64 characters ($ and ? are rejected).
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { formatCents, type Cents } from '@/lib/money';

const TIMEOUT_MS = 10_000;
const MAX_BINDING_MESSAGE = 64;

/**
 * The line shown on the family member's phone, e.g.
 * "Rosa: 500.00 USD to QuickGift Cards". Reduced to the characters Auth0
 * accepts, and cut to fit, keeping who and how much intact.
 */
export function bindingMessage(input: {
  protectedName: string;
  amountCents: Cents;
  payeeName: string;
}): string {
  const clean = (text: string) =>
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9\s+\-_.,:#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const who = clean(input.protectedName.split(/\s+/)[0] ?? '') || 'Payment';
  const amount = formatCents(input.amountCents).replace('$', '');
  const head = `${who}: ${amount} USD to `;
  const payee = clean(input.payeeName) || 'unknown payee';
  return (head + payee).slice(0, MAX_BINDING_MESSAGE).trimEnd();
}

export class CibaError extends Error {
  constructor(
    message: string,
    /** Auth0's error code, e.g. unknown_user_id. Null for network failures. */
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'CibaError';
  }
}

export type CibaPoll =
  /** Approved in Guardian; `sub` is from the verified ID token. */
  | { kind: 'approved'; sub: string }
  | { kind: 'pending' }
  /** Auth0 asks us to poll less often. */
  | { kind: 'slow_down'; intervalSeconds: number }
  /** Auth0 uses one code for "denied" and "expired"; the caller tells them apart by time. */
  | { kind: 'denied_or_expired' }
  /** Definitely expired: nobody answered this push. */
  | { kind: 'expired' }
  /** The request can never succeed (unknown or used auth_req_id, bad token). */
  | { kind: 'invalid'; message: string }
  /** Could not ask right now (network, 5xx). Try again at the next poll. */
  | { kind: 'unavailable'; message: string };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type CibaClientOptions = {
  domain: string;
  clientId: string;
  clientSecret: string;
  fetch?: FetchLike;
  /** Key set for verifying ID tokens. Defaults to the tenant's published keys. */
  keys?: JWTVerifyGetKey;
};

export function createCibaClient(options: CibaClientOptions) {
  const issuer = `https://${options.domain}/`;
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const keys = options.keys ?? createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`));

  async function post(path: string, fields: Record<string, string>) {
    const response = await doFetch(`${issuer}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        ...fields,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: response.status, body };
  }

  /** Sends the push. Throws CibaError if Auth0 will not (e.g. member not enrolled). */
  async function start(input: { sub: string; bindingMessage: string; expirySeconds: number }) {
    let result;
    try {
      result = await post('bc-authorize', {
        scope: 'openid',
        binding_message: input.bindingMessage,
        // 300 or less is what makes Auth0 use mobile push rather than email.
        requested_expiry: String(Math.max(1, Math.min(300, Math.floor(input.expirySeconds)))),
        login_hint: JSON.stringify({ format: 'iss_sub', iss: issuer, sub: input.sub }),
      });
    } catch {
      throw new CibaError('Could not reach Auth0', null);
    }
    const { status, body } = result;
    if (status !== 200 || typeof body.auth_req_id !== 'string') {
      throw new CibaError(
        String(body.error_description ?? `Auth0 answered ${status}`).slice(0, 300),
        typeof body.error === 'string' ? body.error : null,
      );
    }
    return {
      authReqId: body.auth_req_id,
      expiresInSeconds: Number(body.expires_in ?? input.expirySeconds),
      intervalSeconds: Number(body.interval ?? 5),
    };
  }

  /** One poll for the member's answer. Never throws. */
  async function poll(authReqId: string): Promise<CibaPoll> {
    let result;
    try {
      result = await post('oauth/token', {
        grant_type: 'urn:openid:params:grant-type:ciba',
        auth_req_id: authReqId,
      });
    } catch {
      return { kind: 'unavailable', message: 'Could not reach Auth0' };
    }
    const { status, body } = result;

    if (status === 200) {
      if (typeof body.id_token !== 'string') {
        return { kind: 'invalid', message: 'Auth0 approved but sent no ID token' };
      }
      try {
        const { payload } = await jwtVerify(body.id_token, keys, {
          issuer,
          audience: options.clientId,
          algorithms: ['RS256'],
        });
        if (!payload.sub) return { kind: 'invalid', message: 'ID token has no subject' };
        return { kind: 'approved', sub: payload.sub };
      } catch {
        return { kind: 'invalid', message: 'ID token did not verify' };
      }
    }

    // 401 means Auth0 rejected OUR client credentials. It arrives with the
    // same `access_denied` code a member's Deny uses, so classify it first:
    // a misconfigured secret must never be recorded as the family saying no.
    if (status === 401) {
      return { kind: 'unavailable', message: 'Auth0 rejected the client credentials (check AUTH0_CLIENT_SECRET)' };
    }

    switch (body.error) {
      case 'authorization_pending':
        return { kind: 'pending' };
      case 'slow_down':
        return { kind: 'slow_down', intervalSeconds: Number(body.interval ?? 10) };
      case 'access_denied':
        return { kind: 'denied_or_expired' };
      case 'expired_token':
        return { kind: 'expired' };
      default:
        if (status >= 500 || status === 429) {
          return { kind: 'unavailable', message: `Auth0 answered ${status}` };
        }
        return {
          kind: 'invalid',
          message: String(body.error_description ?? body.error ?? `Auth0 answered ${status}`).slice(0, 300),
        };
    }
  }

  return { start, poll };
}

export type CibaClient = ReturnType<typeof createCibaClient>;
