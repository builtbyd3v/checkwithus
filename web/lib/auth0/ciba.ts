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
 *
 * Payment details ride along as a Rich Authorization Request
 * (`authorization_details`, with the API `audience` Auth0 requires for it)
 * only when `richAuthorizationDetails` is on. Probed on our tenant on
 * 2026-10-17 with a user that does not exist (so no push): with `audience`,
 * Auth0 answers "Client ... is not authorized to access resource server"
 * until the app has user-delegated access to the API; details without
 * `audience` answer "Audience must be explicitly specified". So the default
 * sends neither, which is the setup verified to reach user lookup. Docs:
 * https://auth0.com/docs/get-started/apis/configure-rich-authorization-requests
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
  // Capped so the amount always fits: 20 + ": 1,000,000.00 USD to " (the
  // largest amount the API accepts) leaves room for the payee within 64.
  const who = (clean(input.protectedName.split(/\s+/)[0] ?? '') || 'Payment').slice(0, 20).trimEnd();
  const amount = formatCents(input.amountCents).replace('$', '');
  const head = `${who}: ${amount} USD to `;
  const payee = clean(input.payeeName) || 'unknown payee';
  return (head + payee).slice(0, MAX_BINDING_MESSAGE).trimEnd();
}

/** Register this on the Auth0 API before turning on AUTH0_CIBA_RAR. */
export const PAYMENT_DETAILS_TYPE = 'urn:auth0:schemas:authorization-details:v1:payment';

export type PaymentDetails = {
  amountCents: Cents;
  payee: string;
  /** Plain-words hold reasons, as the family sees them. */
  reasons: string[];
  /** 2 when the amount is over the circle's two-approval threshold. */
  approvalsRequired?: number;
};

/**
 * Guardian shows exactly one object in Auth0's documented display schema
 * (`urn:auth0:schemas:authorization-details:v1:<name>`, with `instruction` and
 * `properties`). Money is shown, never sent as a float: the hidden
 * `amount_cents` keeps the integer for anything that reads it back.
 */
export function paymentAuthorizationDetails(payment: PaymentDetails) {
  const shown = (order: number, name: string, value: string | number) =>
    ({ display: true, name, display_order: order, value });
  return [{
    type: PAYMENT_DETAILS_TYPE,
    instruction: 'Approve or deny this held payment.',
    properties: {
      amount: shown(1, 'Amount (USD)', formatCents(payment.amountCents)),
      payee: shown(2, 'Payee', payment.payee),
      reason: shown(3, 'Why it paused', payment.reasons.join('; ').slice(0, 255)),
      ...((payment.approvalsRequired ?? 1) > 1
        ? { approvals: shown(4, 'Approvals needed', `${payment.approvalsRequired} family approvers`) }
        : {}),
      amount_cents: { display: false, value: payment.amountCents },
    },
  }];
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
  /**
   * Approved in Guardian; `sub` is from the verified ID token. `permissions`
   * is the RBAC claim of the verified API access token, when Auth0 sent one.
   */
  | { kind: 'approved'; sub: string; permissions?: string[] }
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
  audience?: string;
  /**
   * Send `audience` and `authorization_details`. Needs the app granted
   * user-delegated access to the API and the details type registered there.
   */
  richAuthorizationDetails?: boolean;
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
  async function start(input: { sub: string; bindingMessage: string; expirySeconds: number; payment?: PaymentDetails }) {
    const send = (rich: boolean) => post('bc-authorize', {
      scope: 'openid',
      ...(rich && options.audience ? { audience: options.audience } : {}),
      ...(rich && input.payment
        ? { authorization_details: JSON.stringify(paymentAuthorizationDetails(input.payment)) }
        : {}),
      binding_message: input.bindingMessage,
      // 300 or less is what makes Auth0 use mobile push rather than email.
      requested_expiry: String(Math.max(1, Math.min(300, Math.floor(input.expirySeconds)))),
      login_hint: JSON.stringify({ format: 'iss_sub', iss: issuer, sub: input.sub }),
    });
    const rich = Boolean(options.richAuthorizationDetails && options.audience);
    let result;
    try {
      result = await send(rich);
      // A 400 sends no push. If the tenant refused the audience or details
      // (app not granted, type not registered), the binding message alone
      // still works. ponytail: retries on any 400; Auth0 does not document these texts.
      if (rich && result.status === 400) result = await send(false);
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
        const permissions = await accessTokenPermissions(body.access_token, payload.sub);
        return { kind: 'approved', sub: payload.sub, ...(permissions ? { permissions } : {}) };
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

  /**
   * The `permissions` claim of a verified access token for our API, or
   * undefined when there is none to read (no audience, opaque token, RBAC
   * off). Undefined means "not checked here"; the circle role still applies.
   */
  async function accessTokenPermissions(token: unknown, sub: string): Promise<string[] | undefined> {
    if (!options.audience || typeof token !== 'string') return undefined;
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience: options.audience, algorithms: ['RS256'] });
      const claim = payload.permissions;
      if (payload.sub !== sub || claim === undefined) return undefined;
      // A malformed claim must not read as "no claim": it yields no permissions.
      return Array.isArray(claim) ? claim.filter((p): p is string => typeof p === 'string') : [];
    } catch {
      return undefined;
    }
  }

  return { start, poll };
}

export type CibaClient = ReturnType<typeof createCibaClient>;
