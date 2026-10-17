import { describe, expect, it } from 'vitest';
import { addCents, formatCents, MoneyError, parseDollars, toCents } from './money';

describe('parseDollars', () => {
  it.each([
    ['12.34', 1234],
    ['$1,234.56', 123456],
    [' 12 ', 1200],
    ['0.1', 10],
    ['0.10', 10],
    ['0', 0],
  ])('reads %j as %i cents', (input, cents) => {
    expect(parseDollars(input)).toBe(cents);
  });

  it('reads numbers the same way as strings', () => {
    expect(parseDollars(12)).toBe(1200);
    expect(parseDollars(12.34)).toBe(1234);
  });

  it.each(['12.345', '', 'abc', '-5', '1e3', '12.'])('refuses %j instead of guessing', (input) => {
    expect(() => parseDollars(input)).toThrow(MoneyError);
  });

  it('refuses a float that is not really two decimals', () => {
    // 0.1 + 0.2 is 0.30000000000000004: a sign the value already went through float math.
    expect(() => parseDollars(0.1 + 0.2)).toThrow(MoneyError);
  });

  it('keeps sums exact where floats would not be', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(addCents(parseDollars('0.10'), parseDollars('0.20'))).toBe(30);
  });
});

describe('toCents', () => {
  it.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY])('refuses %d', (value) => {
    expect(() => toCents(value)).toThrow(MoneyError);
  });
});

describe('formatCents', () => {
  it.each([
    [123456, '$1,234.56'],
    [5, '$0.05'],
    [30000, '$300.00'],
  ])('formats %i as %s', (cents, text) => {
    expect(formatCents(toCents(cents))).toBe(text);
  });
});
