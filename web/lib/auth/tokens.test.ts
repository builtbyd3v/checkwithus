import { describe, expect, it } from 'vitest';
import {
  hashShortCode,
  looksLikeDeviceToken,
  newDeviceToken,
  newShortCode,
  normalizeShortCode,
  sha256,
} from './tokens';

describe('device tokens', () => {
  it('are prefixed, url-safe and unique', () => {
    const tokens = new Set(Array.from({ length: 200 }, newDeviceToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(looksLikeDeviceToken(token)).toBe(true);
  });

  it('rejects things that are not one of ours', () => {
    expect(looksLikeDeviceToken('')).toBe(false);
    expect(looksLikeDeviceToken('Bearer cwd_x')).toBe(false);
    expect(looksLikeDeviceToken('cwd_' + 'a'.repeat(42))).toBe(false);
  });

  it('are stored as a stable hash', () => {
    expect(sha256('cwd_abc')).toBe(sha256('cwd_abc'));
    expect(sha256('cwd_abc')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('short code hashes', () => {
  it('depend on the server key, so a database alone cannot be brute-forced', () => {
    const code = '7K2M-9Q4X';
    expect(hashShortCode(code, 'key-one-'.repeat(4))).toBe(hashShortCode(code, 'key-one-'.repeat(4)));
    expect(hashShortCode(code, 'key-one-'.repeat(4))).not.toBe(hashShortCode(code, 'key-two-'.repeat(4)));
    expect(hashShortCode(code, 'key-one-'.repeat(4))).not.toBe(sha256(code));
  });
});

describe('short codes', () => {
  it('look like XXXX-XXXX from an unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = newShortCode();
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
      expect(normalizeShortCode(code)).toBe(code);
    }
  });

  it('forgive how people actually type them', () => {
    expect(normalizeShortCode(' 7k2m 9q4x ')).toBe('7K2M-9Q4X');
    expect(normalizeShortCode('7K2M9Q4X')).toBe('7K2M-9Q4X');
    // Look-alikes the alphabet leaves out map to the digits they resemble.
    expect(normalizeShortCode('O1LI-ABCD')).toBe('0111-ABCD');
  });

  it('refuse what cannot be a code', () => {
    expect(normalizeShortCode('7K2M-9Q4')).toBeNull();
    expect(normalizeShortCode('7K2M-9Q4X1')).toBeNull();
    expect(normalizeShortCode('UUUU-UUUU')).toBeNull();
    expect(normalizeShortCode('')).toBeNull();
  });
});
