import { expect, it } from 'vitest';
import { usualLabel } from '@/lib/usual';
import { alertHeadline, timeAgo } from './format';

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
