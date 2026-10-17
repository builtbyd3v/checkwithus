import { describe, expect, it } from 'vitest';
import { MoneyError, toCents } from '@/lib/money';
import {
  billListSchema,
  fromBill,
  fromNessieDollars,
  paidBillBody,
  paymentIdFromDescription,
  purchaseBody,
  taggedDescription,
  toNessieDate,
  toNessieDollars,
  toNessieWholeDollars,
} from './format';

const PAYMENT_ID = '0b9e2c8e-6a43-4f7a-9d0e-3f1f6f1b2c4d';
const EASTERN = 'America/New_York';

describe('amounts', () => {
  it('sends whole dollars where Nessie truncates cents', () => {
    expect(toNessieWholeDollars(toCents(1_200))).toBe(12);
  });

  it('refuses an amount Nessie would silently truncate (12.75 -> 12 was observed live)', () => {
    expect(() => toNessieWholeDollars(toCents(1_275))).toThrow(MoneyError);
  });

  it('keeps cents for bills', () => {
    expect(toNessieDollars(toCents(1_247))).toBe(12.47);
    expect(JSON.stringify({ payment_amount: toNessieDollars(toCents(1_247)) })).toBe(
      '{"payment_amount":12.47}',
    );
  });

  it('reads dollars back into exact cents despite float representation', () => {
    expect(fromNessieDollars(12.47)).toBe(1_247);
    expect(fromNessieDollars(0.1 + 0.2)).toBe(30);
    expect(fromNessieDollars(12)).toBe(1_200);
  });

  it('refuses a Nessie amount that is not whole cents', () => {
    expect(() => fromNessieDollars(12.345)).toThrow(MoneyError);
  });
});

describe('dates', () => {
  // 9:30 PM in Gainesville on Oct 16 is already Oct 17 in UTC.
  const eveningOfTheHackathon = new Date('2026-10-17T01:30:00Z');

  it('uses the local calendar date, not UTC', () => {
    expect(toNessieDate(eveningOfTheHackathon, EASTERN)).toBe('2026-10-16');
    expect(toNessieDate(eveningOfTheHackathon, 'UTC')).toBe('2026-10-17');
  });
});

describe('request bodies', () => {
  const at = new Date('2026-10-17T15:00:00Z');

  it('builds a purchase with the fields Nessie requires', () => {
    expect(
      purchaseBody({
        merchantId: 'm-1',
        amountCents: toCents(50_000),
        at,
        timeZone: EASTERN,
        description: 'Gift cards',
      }),
    ).toEqual({
      merchant_id: 'm-1',
      medium: 'balance',
      purchase_date: '2026-10-17',
      amount: 500,
      status: 'completed',
      description: 'Gift cards',
    });
  });

  it('refuses to build a purchase with cents', () => {
    expect(() =>
      purchaseBody({
        merchantId: 'm-1',
        amountCents: toCents(1_299),
        at,
        timeZone: EASTERN,
        description: 'x',
      }),
    ).toThrow(MoneyError);
  });

  it('always gives a bill a recurring_date, or the account bill list breaks', () => {
    const body = paidBillBody({
      payee: 'City Power & Light',
      nickname: 'Electric',
      amountCents: toCents(8_412),
      at,
      timeZone: EASTERN,
    });
    expect(body).toEqual({
      status: 'completed',
      payee: 'City Power & Light',
      nickname: 'Electric',
      payment_date: '2026-10-17',
      recurring_date: 17,
      payment_amount: 84.12,
    });
    // Nessie rejects this field on create; it computes it itself.
    expect(body).not.toHaveProperty('upcoming_payment_date');
  });
});

describe('payment tags', () => {
  it('round-trips a payment id through a description', () => {
    const text = taggedDescription('  Gift cards  ', PAYMENT_ID);
    expect(text).toBe(`Gift cards [cw:${PAYMENT_ID}]`);
    expect(paymentIdFromDescription(text)).toBe(PAYMENT_ID);
  });

  it('ignores descriptions we did not tag', () => {
    expect(paymentIdFromDescription('Groceries')).toBeNull();
    expect(paymentIdFromDescription(undefined)).toBeNull();
    expect(paymentIdFromDescription(`[cw:${PAYMENT_ID}] moved to the front`)).toBeNull();
  });

  it('finds the tag on a bill, where it lives in the nickname', () => {
    // Shape copied from a live GET /accounts/{id}/bills response.
    const [bill] = billListSchema.parse([
      {
        _id: '8c29c60c-ec18-41a5-8b02-15c679ef94ba',
        status: 'completed',
        payee: 'City Power & Light',
        nickname: taggedDescription('Electric', PAYMENT_ID),
        creation_date: '2026-10-17',
        payment_date: '2026-10-17',
        recurring_date: 17,
        upcoming_payment_date: '2026-11-17',
        payment_amount: 84.12,
        account_id: '19b1e8d8-04fb-4c29-ba2b-0f1c767e0c68',
      },
    ]);
    expect(fromBill(bill!)).toMatchObject({
      kind: 'bill',
      amountCents: 8_412,
      paymentId: PAYMENT_ID,
    });
  });
});
