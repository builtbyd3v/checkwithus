/**
 * Family members sign in with Auth0. The family iPhone app sends its Auth0
 * access token as `Authorization: Bearer <jwt>`; this verifies it against the
 * tenant's published keys.
 *
 * Only RS256 is accepted: allowing the algorithm named in the token's own
 * header is the classic way a forged `none` or HS256 token gets through.
 */
import 'server-only';
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload } from 'jose';
import { auth0Env } from '@/lib/env';
import { HttpError } from '@/lib/http';
import { AuthError, AuthUnavailableError, bearerToken } from './http-auth';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function keys() {
  // jose caches the key set and refetches on an unknown key id, so a key
  // rotation at Auth0 needs no deploy.
  return (jwks ??= createRemoteJWKSet(
    new URL(`https://${auth0Env().AUTH0_DOMAIN}/.well-known/jwks.json`),
  ));
}

export type FamilyUser = {
  sub: string;
  name: string | null;
  authTime?: number;
  /** Auth0 RBAC `permissions` claim; [] when AUTH0_RBAC=true and the token has none. */
  permissions?: string[];
};

/**
 * Verifies an Auth0 access token for our API (RS256, issuer, audience) and
 * returns its claims. AuthError (401) for a bad token, AuthUnavailableError
 * (503) when Auth0's keys cannot be fetched. Shared with lib/auth/agent.ts.
 */
export async function verifyApiToken(token: string): Promise<JWTPayload> {
  const { AUTH0_DOMAIN, AUTH0_AUDIENCE } = auth0Env();
  try {
    const { payload } = await jwtVerify(token, keys(), {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: AUTH0_AUDIENCE,
      algorithms: ['RS256'],
    });
    return payload;
  } catch (error) {
    if (error instanceof errors.JWTExpired) throw new AuthError('Sign-in expired');
    if (error instanceof errors.JOSEError && TOKEN_REJECTED.has(error.code)) {
      // Never echo why verification failed beyond this; it helps an attacker.
      throw new AuthError('Invalid sign-in');
    }
    // Anything else means we could not check the token at all (Auth0's keys
    // unreachable, timed out, malformed). That is not the person's fault.
    console.error('[auth] could not verify Auth0 token:', error instanceof Error ? error.message : error);
    throw new AuthUnavailableError();
  }
}

/** A Machine-to-Machine (client credentials) token: the bill-pay agent, never a person. */
export function isMachineToken(payload: JWTPayload): boolean {
  return payload.gty === 'client-credentials' || (payload.sub?.endsWith('@clients') ?? false);
}

/** The Auth0 Native app the family iPhone signs in with (public, also in ios/.../FamilyAuth.swift). */
const IOS_CLIENT_ID = 'GTknuXEohQaPK6TzgzEdJoWozbxgQUDh';

/**
 * Auth0 access tokens carry no auth_time, so the iPhone app also sends its ID token in `X-Id-Token`.
 * Its auth_time counts only when Auth0 signed it for our iPhone app and the same person. Anything
 * else is ignored rather than rejected: the person then gets the normal "sign in again" step-up.
 */
async function idTokenAuthTime(request: Request, sub: string): Promise<number | undefined> {
  const idToken = request.headers.get('x-id-token');
  if (!idToken) return undefined;
  try {
    const { payload } = await jwtVerify(idToken, keys(), {
      issuer: `https://${auth0Env().AUTH0_DOMAIN}/`,
      audience: IOS_CLIENT_ID,
      algorithms: ['RS256'],
      subject: sub,
    });
    return typeof payload.auth_time === 'number' ? payload.auth_time : undefined;
  } catch {
    return undefined;
  }
}

/** The signed-in family member, or AuthError (401). */
export async function requireFamilyUser(request: Request): Promise<FamilyUser> {
  const payload = await verifyApiToken(bearerToken(request));
  // The agent has its own identity and only the agent route accepts it. It can
  // never approve, deny, freeze, unfreeze, grant allowances or change policy.
  if (isMachineToken(payload)) {
    throw new HttpError(403, 'agent_not_allowed', 'Only a family member can do this, not the bill-pay agent.');
  }
  if (!payload.sub) throw new AuthError('Token has no subject');
  const name = typeof payload.name === 'string' ? payload.name : null;
  const { permissions } = payload;
  const authTime = typeof payload.auth_time === 'number' ? payload.auth_time : await idTokenAuthTime(request, payload.sub);
  return {
    sub: payload.sub,
    name,
    ...(authTime !== undefined ? { authTime } : {}),
    // A malformed claim must not read as "no claim": it yields no permissions.
    ...(permissions !== undefined
      ? { permissions: Array.isArray(permissions) ? permissions.filter((p): p is string => typeof p === 'string') : [] }
      : auth0Env().AUTH0_RBAC === 'true' ? { permissions: [] } : {}),
  };
}

/** jose error codes that mean "this token is bad", as opposed to "we could not check it". */
const TOKEN_REJECTED = new Set([
  'ERR_JWT_EXPIRED',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_INVALID',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JOSE_NOT_SUPPORTED',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
]);
