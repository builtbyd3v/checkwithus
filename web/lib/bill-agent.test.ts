import { describe, expect, it } from 'vitest';
import { nextDueDate } from './bill-agent';

describe('nextDueDate', () => {
  it('is one month after the last bill, clamped to the month end', () => {
    expect(nextDueDate('2026-10-02')).toBe('2026-11-02');
    expect(nextDueDate('2026-12-15')).toBe('2027-01-15');
    expect(nextDueDate('2026-01-31')).toBe('2026-02-28');
  });
});
