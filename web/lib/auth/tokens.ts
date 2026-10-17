/**
 * Secrets we issue: device tokens and the short codes people read out loud.
 * We store only their SHA-256; the plaintext exists once, in the response
 * that hands it over.
 */
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';

/** Prefixed so a leaked token is recognizable in a log, a paste or a commit. */
const DEVICE_TOKEN_PREFIX = 'cwd_';

/** 256 bits of randomness. */
export function newDeviceToken(): string {
  return DEVICE_TOKEN_PREFIX + randomBytes(32).toString('base64url');
}

export function looksLikeDeviceToken(value: string): boolean {
  return /^cwd_[A-Za-z0-9_-]{43}$/.test(value);
}

/**
 * For device tokens: 256 random bits cannot be brute-forced from their hash,
 * so a plain SHA-256 is enough.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * For short codes, a plain hash is not enough: 40 bits is ~10^12 codes, which
 * a GPU tries against a SHA-256 in minutes. So codes are hashed with a key
 * that lives in the server's environment, not the database: a leaked
 * database alone cannot be used to recover a working code.
 */
export function hashShortCode(canonicalCode: string, key: string): string {
  return createHmac('sha256', key).update(canonicalCode).digest('hex');
}

/**
 * Crockford base32: no I, L, O or U, so a code read aloud or copied by hand
 * cannot mix up 1/I/L or 0/O. 8 characters = 40 bits, shown as XXXX-XXXX.
 */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newShortCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * What someone typed -> the canonical code, or null if it cannot be one.
 * Forgives case, spaces, dashes, and the look-alikes the alphabet left out.
 */
export function normalizeShortCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (cleaned.length !== 8 || [...cleaned].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}
