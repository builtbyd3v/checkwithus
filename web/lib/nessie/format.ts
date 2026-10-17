/**
 * The Nessie boundary. Every value going into or coming out of Nessie passes
 * through this file, so the rest of the app only ever handles integer cents,
 * `Date`s and our own category names. Nothing here does I/O.
 *
 * Verified against the live API with our own key on 2026-10-16, not taken from
 * docs (the old docs host is gone and this Nessie is a reimplementation with
 * different validation):
 *
 *  - Amounts are dollars. Purchases, withdrawals and deposits TRUNCATE cents
 *    (12.75 is stored as 12, 5.25 as 5). Bills keep cents (12.47 stays 12.47).
 *  - Account balances never change after a purchase or withdrawal, so Nessie
 *    cannot be our ledger. Tiger Data is.
 *  - A merchant's `category` is a single string, not an array.
 *  - A bill created without `recurring_date` is accepted, and then makes
 *    `GET /accounts/{id}/bills` fail validation for the WHOLE account. Every
 *    bill must carry it. `upcoming_payment_date` is computed by Nessie and is
 *    rejected if we send it.
 *  - Ids are UUIDs. Creates answer `{ code, message, objectCreated: {...} }`.
 *  - Purchases and withdrawals cannot be deleted, only offset.
 */
import { z } from 'zod';
import { formatCents, MoneyError, toCents, type Cents } from '@/lib/money';
import type { Category } from '@/lib/categories';

// ---------------------------------------------------------------------------
// Amounts

/**
 * Cents -> whole dollars, for purchases, withdrawals, deposits and opening
 * balances. Nessie truncates anything after the decimal point without saying
 * so; rounding here would still be wrong by up to 99 cents. So an amount with
 * cents is refused, never adjusted.
 */
export function toNessieWholeDollars(cents: Cents): number {
  if (cents % 100 !== 0) {
    throw new MoneyError(
      `Nessie only keeps whole dollars for this kind of payment; ${formatCents(cents)} has cents.`,
    );
  }
  return cents / 100;
}

/** Cents -> dollars with up to two decimals, for bills (the one place Nessie keeps cents). */
export function toNessieDollars(cents: Cents): number {
  return cents / 100;
}

/**
 * Dollars from Nessie -> cents. `12.47 * 100` is `1246.9999...` in binary
 * floating point; rounding corrects that representation error. Anything
 * further than a hair from a whole cent is not a real money amount.
 */
export function fromNessieDollars(amount: number): Cents {
  const scaled = amount * 100;
  const cents = Math.round(scaled);
  if (!Number.isFinite(scaled) || Math.abs(scaled - cents) > 1e-6) {
    throw new MoneyError(`Nessie returned an amount that is not whole cents: ${amount}`);
  }
  return toCents(cents);
}

// ---------------------------------------------------------------------------
// Dates

/**
 * A moment -> Nessie's `YYYY-MM-DD`, as a calendar date in `timeZone`.
 * UTC would be wrong in the evening: at 9 PM in Gainesville it is already
 * tomorrow in UTC, and a payment would land on the wrong day.
 */
export function toNessieDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type: 'year' | 'month' | 'day') => {
    const value = parts.find((p) => p.type === type)?.value;
    if (!value) throw new Error(`Could not format ${type} for ${timeZone}`);
    return value;
  };
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const nessieDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

/** Day of month (1-31) of a Nessie date, which is what `recurring_date` wants. */
function dayOfMonth(nessieDateString: string): number {
  return Number(nessieDateString.slice(8, 10));
}

// ---------------------------------------------------------------------------
// Text

/**
 * Tags a description with our payment id. Purchases cannot be deleted and a
 * POST that times out may still have succeeded, so the tag is how we find out
 * afterwards whether a payment reached Nessie, instead of guessing and paying
 * twice.
 */
export function taggedDescription(text: string, paymentId: string): string {
  return `${text.trim()} [cw:${paymentId}]`;
}

/** The payment id inside a description written by `taggedDescription`, if any. */
export function paymentIdFromDescription(description: string | undefined): string | null {
  return description?.match(/\[cw:([0-9a-f-]{36})\]$/)?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Request bodies: our types in, exactly the fields Nessie accepts out.

export type NessieAddress = {
  street_number: string;
  street_name: string;
  city: string;
  state: string;
  zip: string;
};

export function customerBody(input: {
  firstName: string;
  lastName: string;
  address: NessieAddress;
}) {
  return { first_name: input.firstName, last_name: input.lastName, address: input.address };
}

export function checkingAccountBody(input: { nickname: string; openingBalanceCents: Cents }) {
  return {
    type: 'Checking' as const,
    nickname: input.nickname,
    rewards: 0,
    balance: toNessieWholeDollars(input.openingBalanceCents),
  };
}

export function merchantBody(input: {
  name: string;
  category: Category;
  address: NessieAddress;
  geocode: { lat: number; lng: number };
}) {
  return {
    name: input.name,
    category: input.category,
    address: input.address,
    geocode: input.geocode,
  };
}

type MovementInput = {
  amountCents: Cents;
  at: Date;
  timeZone: string;
  description: string;
};

export function purchaseBody(input: MovementInput & { merchantId: string }) {
  return {
    merchant_id: input.merchantId,
    medium: 'balance' as const,
    purchase_date: toNessieDate(input.at, input.timeZone),
    amount: toNessieWholeDollars(input.amountCents),
    status: 'completed' as const,
    description: input.description,
  };
}

export function withdrawalBody(input: MovementInput) {
  return {
    medium: 'balance' as const,
    transaction_date: toNessieDate(input.at, input.timeZone),
    status: 'completed' as const,
    amount: toNessieWholeDollars(input.amountCents),
    description: input.description,
  };
}

export function depositBody(input: MovementInput) {
  return {
    medium: 'balance' as const,
    transaction_date: toNessieDate(input.at, input.timeZone),
    status: 'completed' as const,
    amount: toNessieWholeDollars(input.amountCents),
    description: input.description,
  };
}

/**
 * A bill that has been paid. Always carries `recurring_date`; see the file
 * header. Bills have no description field, so pass the payment tag
 * (`taggedDescription`) as the nickname.
 */
export function paidBillBody(input: {
  payee: string;
  nickname: string;
  amountCents: Cents;
  at: Date;
  timeZone: string;
}) {
  const paymentDate = toNessieDate(input.at, input.timeZone);
  return {
    status: 'completed' as const,
    payee: input.payee,
    nickname: input.nickname,
    payment_date: paymentDate,
    recurring_date: dayOfMonth(paymentDate),
    payment_amount: toNessieDollars(input.amountCents),
  };
}

// ---------------------------------------------------------------------------
// Responses: Nessie's shapes in, our types out. Parsed, never trusted.

export const createdSchema = z.object({
  objectCreated: z.object({ _id: z.string().min(1) }).loose(),
});

export const accountSchema = z
  .object({
    _id: z.string(),
    type: z.string(),
    nickname: z.string(),
    balance: z.number(),
    customer_id: z.string(),
  })
  .loose();

export const customerSchema = z
  .object({ _id: z.string(), first_name: z.string(), last_name: z.string() })
  .loose();

export const merchantSchema = z
  .object({ _id: z.string(), name: z.string(), category: z.string().optional() })
  .loose();

const purchaseSchema = z
  .object({
    _id: z.string(),
    merchant_id: z.string(),
    purchase_date: nessieDate,
    amount: z.number(),
    description: z.string().optional(),
  })
  .loose();

const movementSchema = z
  .object({
    _id: z.string(),
    transaction_date: nessieDate,
    amount: z.number(),
    description: z.string().optional(),
  })
  .loose();

const billSchema = z
  .object({
    _id: z.string(),
    payee: z.string(),
    nickname: z.string().optional(),
    payment_date: nessieDate,
    payment_amount: z.number(),
  })
  .loose();

export const purchaseListSchema = z.array(purchaseSchema);
export const movementListSchema = z.array(movementSchema);
export const billListSchema = z.array(billSchema);
export const merchantListSchema = z.array(merchantSchema);
export const customerListSchema = z.array(customerSchema);
export const accountListSchema = z.array(accountSchema);

/**
 * An account as the rest of the app sees it. Nessie never updates `balance`
 * after a payment, so this is only the opening balance; the live balance is
 * computed from our ledger in Tiger Data.
 */
export type NessieAccount = {
  nessieId: string;
  customerId: string;
  type: string;
  nickname: string;
  openingBalanceCents: Cents;
};

export function fromAccount(a: z.infer<typeof accountSchema>): NessieAccount {
  return {
    nessieId: a._id,
    customerId: a.customer_id,
    type: a.type,
    nickname: a.nickname,
    openingBalanceCents: fromNessieDollars(a.balance),
  };
}

/** One money movement as the rest of the app sees it. */
export type NessieRecord = {
  nessieId: string;
  kind: 'purchase' | 'withdrawal' | 'deposit' | 'bill';
  date: string;
  amountCents: Cents;
  description: string;
  paymentId: string | null;
  merchantId: string | null;
};

export function fromPurchase(p: z.infer<typeof purchaseSchema>): NessieRecord {
  return {
    nessieId: p._id,
    kind: 'purchase',
    date: p.purchase_date,
    amountCents: fromNessieDollars(p.amount),
    description: p.description ?? '',
    paymentId: paymentIdFromDescription(p.description),
    merchantId: p.merchant_id,
  };
}

export function fromMovement(
  m: z.infer<typeof movementSchema>,
  kind: 'withdrawal' | 'deposit',
): NessieRecord {
  return {
    nessieId: m._id,
    kind,
    date: m.transaction_date,
    amountCents: fromNessieDollars(m.amount),
    description: m.description ?? '',
    paymentId: paymentIdFromDescription(m.description),
    merchantId: null,
  };
}

export function fromBill(b: z.infer<typeof billSchema>): NessieRecord {
  return {
    nessieId: b._id,
    kind: 'bill',
    date: b.payment_date,
    amountCents: fromNessieDollars(b.payment_amount),
    description: b.payee,
    paymentId: paymentIdFromDescription(b.nickname),
    merchantId: null,
  };
}
