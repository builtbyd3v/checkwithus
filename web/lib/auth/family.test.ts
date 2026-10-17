/**
 * Family sign-in is the door to approving money, so these try to get through
 * it with forged tokens. A local RSA key stands in for Auth0's signing key.
 */
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const DOMAIN = 'checkwith-test.us.auth0.com';
const ISSUER = `https://${DOMAIN}/`;
const AUDIENCE = 'https://api.checkwith.us/';

vi.mock('@/lib/env', () => ({
  auth0Env: () => ({
    AUTH0_DOMAIN: DOMAIN,
    AUTH0_AUDIENCE: AUDIENCE,
    AUTH0_CLIENT_ID: 'x',
    AUTH0_CLIENT_SECRET: 'x',
  }),
}));

let privateKey: CryptoKey;
let publicJwk: JWK;
/** Simulates Auth0's key endpoint being unreachable. */
let auth0Down = false;

vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  // The real code fetches Auth0's key set over HTTPS; serve ours locally instead.
  return {
    ...actual,
    createRemoteJWKSet: () => {
      const local = createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'k1', alg: 'RS256' }] });
      return (...args: Parameters<typeof local>) => {
        if (auth0Down) throw new TypeError('fetch failed');
        return local(...args);
      };
    },
  };
});

const { requireFamilyUser } = await import('./family');
const { AuthError, AuthUnavailableError } = await import('./http-auth');

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  publicJwk = await exportJWK(pair.publicKey);
});

function sign(claims: Record<string, unknown> = {}, options: { exp?: string } = {}) {
  return new SignJWT({ name: 'Maria', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject('auth0|maria')
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(options.exp ?? '5m')
    .sign(privateKey);
}

const request = (token?: string) =>
  new Request('https://checkwith.us/api/v1/family/me', {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });

describe('requireFamilyUser', () => {
  it('accepts a genuine Auth0 token', async () => {
    await expect(requireFamilyUser(request(await sign()))).resolves.toEqual({
      sub: 'auth0|maria',
      name: 'Maria',
    });
  });

  it('rejects no token', async () => {
    await expect(requireFamilyUser(request())).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects a token for a different API', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('auth0|maria')
      .setIssuer(ISSUER)
      .setAudience('https://some-other-api/')
      .setExpirationTime('5m')
      .sign(privateKey);
    await expect(requireFamilyUser(request(token))).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects a token from a different tenant', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('auth0|maria')
      .setIssuer('https://evil.us.auth0.com/')
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(privateKey);
    await expect(requireFamilyUser(request(token))).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects an expired token, and says so', async () => {
    const token = await sign({}, { exp: '-1m' });
    await expect(requireFamilyUser(request(token))).rejects.toThrow('Sign-in expired');
  });

  it('rejects a token signed with someone else\'s key', async () => {
    const stranger = await generateKeyPair('RS256');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('auth0|maria')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(stranger.privateKey);
    await expect(requireFamilyUser(request(token))).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects an HS256 token, the classic algorithm-confusion forgery', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('auth0|maria')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('guessable-secret-guessable-secret'));
    await expect(requireFamilyUser(request(token))).rejects.toBeInstanceOf(AuthError);
  });

  it('does not sign anyone out when Auth0 itself is unreachable', async () => {
    const token = await sign();
    auth0Down = true;
    try {
      const error = await requireFamilyUser(request(token)).catch((e: unknown) => e);
      // A retryable 503, not "your sign-in is invalid".
      expect(error).toBeInstanceOf(AuthUnavailableError);
      expect(error).not.toBeInstanceOf(AuthError);
    } finally {
      auth0Down = false;
    }
  });

  it('rejects an unsigned alg:none token', async () => {
    const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const token = `${part({ alg: 'none', typ: 'JWT' })}.${part({
      sub: 'auth0|maria',
      iss: ISSUER,
      aud: AUDIENCE,
      exp: now + 300,
    })}.`;
    await expect(requireFamilyUser(request(token))).rejects.toBeInstanceOf(AuthError);
  });
});
