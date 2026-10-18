import { expect, it } from 'vitest';
import { usualLabel } from '@/lib/usual';
import { alertHeadline, dayHeading, moneyProtected, speedHeadline, timeAgo, timeOfDay, usualWeekCents } from './format';

it('words each alert kind and skips unknown ones', () => {
  expect(alertHeadline({ kind: 'bank_during_call', detail: 'At a bank (Seven Corners 1 ATM) while on a phone call.' }, 'Rosa'))
    .toBe('Rosa is at a bank (Seven Corners 1 ATM) while on a phone call');
  expect(alertHeadline({ kind: 'bank_during_call', detail: null }, 'Rosa')).toBe('Rosa is at a bank while on a phone call');
  expect(alertHeadline({ kind: 'ask_family', detail: null }, 'Rosa')).toBe('Rosa tapped “Ask my family” and wants a call');
  expect(alertHeadline({ kind: 'lottery_win', detail: 'x' }, 'Rosa')).toBeNull();
});

it('says how long ago', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  const ago = (seconds: number) => timeAgo(new Date(now.getTime() - seconds * 1000), now);
  expect(ago(20)).toBe('just now');
  expect(ago(5 * 60)).toBe('5 minutes ago');
  expect(ago(3 * 3600)).toBe('3 hours ago');
  expect(ago(30 * 3600)).toBe('yesterday');
});

it('prefers the payee history, falls back to daily spending, hides small or missing ratios', () => {
  expect(usualLabel({ payee_times: 6, daily_times: 9 }, 'Target', 'Rosa')).toBe('About 6x Rosa’s usual at Target');
  expect(usualLabel({ payee_times: 1, daily_times: 9 }, 'Target', 'Rosa')).toBeNull();
  expect(usualLabel({ payee_times: null, daily_times: 4 }, 'Target', 'Rosa')).toBe('About 4x Rosa’s usual daily spending');
  expect(usualLabel({ payee_times: null, daily_times: 1 }, 'Target', 'Rosa')).toBeNull();
  expect(usualLabel({ payee_times: null, daily_times: null }, 'Target', 'Rosa')).toBeNull();
  expect(usualLabel(undefined, 'Target', 'Rosa')).toBeNull();
});

it('groups by the family day and words the heading', () => {
  const now = new Date('2026-10-17T19:00:00Z');
  expect(dayHeading(new Date('2026-10-17T13:00:00Z'), now)).toBe('Today');
  // 1 AM UTC on the 17th is still the 16th in New York.
  expect(dayHeading(new Date('2026-10-17T01:00:00Z'), now)).toBe('Yesterday');
  expect(dayHeading(new Date('2026-10-09T20:00:00Z'), now)).toBe('Friday, Oct 9');
  expect(timeOfDay(new Date('2026-10-17T19:02:00Z'))).toBe('3:02 PM');
});

it('counts denials this month plus everything held, in cents', () => {
  const now = new Date('2026-10-17T19:00:00Z');
  const payments = [
    { status: 'denied', amountCents: 74000, createdAt: '2026-10-09T20:00:00Z' },
    { status: 'denied', amountCents: 9900, createdAt: '2026-09-30T12:00:00Z' },
    { status: 'paid', amountCents: 4618, createdAt: '2026-10-17T15:00:00Z' },
  ];
  expect(moneyProtected(payments, [{ status: 'held', amountCents: 50000, createdAt: '2026-10-17T19:02:00Z' }], now))
    .toEqual({ deniedCents: 74000, heldCents: 50000 });
});

it('takes the usual week from finished weeks only', () => {
  expect(usualWeekCents([100, 200, 300, 9999])).toBe(200);
  expect(usualWeekCents([0, 0, 1])).toBe(0);
  expect(usualWeekCents([])).toBe(0);
});

it('claims a speedup only from 1.5x, otherwise says both are fast', () => {
  expect(speedHeadline({ aggregateMs: 0.84, rawMs: 37.9 })).toBe('45.1x faster.');
  expect(speedHeadline({ aggregateMs: 1, rawMs: 1.5 })).toBe('1.5x faster.');
  expect(speedHeadline({ aggregateMs: 1.2, rawMs: 1.4 })).toBe('Both under 2 ms at this size.');
  expect(speedHeadline({ aggregateMs: 1, rawMs: 1 })).toBe('Both under 2 ms at this size.');
  expect(speedHeadline({ aggregateMs: 3.1, rawMs: 2.5 })).toBe('Both under 4 ms at this size.');
  expect(speedHeadline({ aggregateMs: 0.3, rawMs: 0.2 })).toBe('Both under 1 ms at this size.');
});
