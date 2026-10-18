import { describe, expect, it } from 'vitest';
import { canonicalCode, cleanCode, nextCode } from './short-code';
import { normalizeShortCode } from './auth/tokens';

describe('cleanCode', () => {
  it.each([
    ['lowercase', 'abcd2345', 'ABCD2345'],
    ['pasted with dash', 'ABCD-2345', 'ABCD2345'],
    ['pasted with spaces', ' ab cd 23 45 ', 'ABCD2345'],
    ['look-alikes', 'oOiIlL00', '00111100'],
    ['9+ characters', 'ABCD-23456789', 'ABCD2345'],
    ['invalid characters', 'A!B@U#C$D_2.3/4,5', 'ABCD2345'],
    ['7 characters', 'ABCD-234', 'ABCD234'],
  ])('%s', (_case, input, cleaned) => expect(cleanCode(input)).toBe(cleaned));
});

describe('nextCode', () => {
  it('types one character at a time and stops at 8', () => {
    expect(nextCode('ABC', 'ABCd')).toBe('ABCD');
    expect(nextCode('ABCD2345', 'ABCD23456')).toBe('ABCD2345');
  });
  it('ignores a typed dash or invalid character', () => {
    expect(nextCode('ABCD', 'ABCD-')).toBe('ABCD');
    expect(nextCode('ABCD', 'ABCDU')).toBe('ABCD');
  });
  it('backspace removes the last character', () => expect(nextCode('ABCD', 'ABC')).toBe('ABC'));
  it('a full paste replaces what is there', () => {
    expect(nextCode('', 'abcd-2345')).toBe('ABCD2345');
    expect(nextCode('XY', 'XY wxyz 2345')).toBe('WXYZ2345');
    expect(nextCode('ABCD2345', 'ABCD2345WXYZ-6789')).toBe('WXYZ6789');
  });
  it('a short paste appends', () => expect(nextCode('AB', 'AB cd')).toBe('ABCD'));
});

describe('canonicalCode', () => {
  it('needs all 8', () => {
    expect(canonicalCode('ABCD234')).toBeNull();
    expect(canonicalCode('ABCD2345')).toBe('ABCD-2345');
  });

  it('agrees with the server on every code the server accepts', () => {
    for (const input of ['abcd2345', 'ABCD-2345', ' ab cd 23 45 ', 'oOiIlL00', 'zyxw-vtsr']) {
      expect(canonicalCode(cleanCode(input))).toBe(normalizeShortCode(input));
    }
  });
});
