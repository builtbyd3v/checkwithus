/**
 * Family members sign in with Auth0. The family iPhone app sends its Auth0
 * access token as `Authorization: Bearer <jwt>`; this verifies it against the
 * tenant's published keys.
 *
 * Only RS256 is accepted: allowing the algorithm named in the token's own
 * header is the classic way a forged `none` or HS256 token gets through.
 */
import 'server-only';
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { auth0Env } from '@/lib/env';
import { AuthError, AuthUnavailableError, bearerToken } from './http-auth';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function keys() {
  // jose caches the key set and refetches on an unknown key id, so a key
  // rotation at Auth0 needs no deploy.
  return (jwks ??= createRemoteJWKSet(
    new URL(`https://${auth0Env().AUTH0_DOMAIN}/.well-known/jwks.json`),
  ));
}

export type FamilyUser = { sub: string; name: string | null; authTime?: number };

/** The signed-in family member, or AuthError (401). */
export async function requireFamilyUser(request: Request): Promise<FamilyUser> {
  const token = bearerToken(request);
  const { AUTH0_DOMAIN, AUTH0_AUDIENCE } = auth0Env();
  try {
    const { payload } = await jwtVerify(token, keys(), {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: AUTH0_AUDIENCE,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new AuthError('Token has no subject');
    const name = typeof payload.name === 'string' ? payload.name : null;
    return { sub: payload.sub, name, ...(typeof payload.auth_time === 'number' ? { authTime: payload.auth_time } : {}) };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (error instanceof errors.JWTExpired) throw new AuthError('Sign-in expired');
    if (error instanceof errors.JOSEError && TOKEN_REJECTED.has(error.code)) {
      // Never echo why verification failed beyond this; it helps an attacker.
      throw new AuthError('Invalid sign-in');
    }
    // Anything else means we could not check the token at all (Auth0's keys
    // unreachable, timed out, malformed). That is not the person's fault.
    console.error('[auth] could not verify family token:', error instanceof Error ? error.message : error);
    throw new AuthUnavailableError();
  }
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
