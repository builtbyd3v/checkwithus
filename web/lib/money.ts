/**
 * Money. Read this before touching any amount anywhere in the app.
 *
 * Hard rule: money is integer cents everywhere. Never a float, never a
 * dollar-denominated number in a variable, a database column, or a JSON body.
 * Floats cannot represent 0.1 exactly, so `0.1 + 0.2 !== 0.3`, and a hold
 * threshold of "over $300" starts letting $300.00 through at random.
 *
 * Dollars exist in exactly two places:
 *   - input  -> `parseDollars` converts once, at the edge
 *   - output -> `formatCents` converts once, for display
 *
 * Nessie: its amount fields accept whole numbers only, so we send cents
 * directly and read its balances back as cents. Do not "convert to dollars"
 * for Nessie -- that is what would introduce a fraction.
 */

/** An integer number of cents. 1234 is $12.34. Never fractional. */
export type Cents = number & { readonly __brand: 'Cents' };

/** Thrown when a value that must be money is not usable as money. */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** Asserts an arbitrary number is a whole, finite, non-negative cent amount. */
export function toCents(value: number): Cents {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`Amount is not a finite number: ${value}`);
  }
  if (!Number.isInteger(value)) {
    throw new MoneyError(
      `Amount must be whole cents, got ${value}. Convert dollars with parseDollars() at the edge.`,
    );
  }
  if (value < 0) {
    throw new MoneyError(`Amount must not be negative, got ${value}`);
  }
  return value as Cents;
}

/**
 * The single dollars -> cents conversion. Use this at every input boundary
 * (form fields, Nessie bill payloads that quote dollars, seed data) and
 * nowhere else.
 *
 * Accepts "12.34", "$1,234.56", " 12 ", 12, 12.34.
 * Rejects anything with more than two decimal places rather than silently
 * rounding, because a silently rounded amount is a wrong amount.
 */
export function parseDollars(input: string | number): Cents {
  const raw = typeof input === 'number' ? String(input) : input.trim().replace(/[$,\s]/g, '');

  if (raw === '') {
    throw new MoneyError('Amount is empty');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new MoneyError(
      `Amount must be a dollar value with at most 2 decimal places, got "${input}"`,
    );
  }

  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  return toCents(cents);
}

/** Cents -> display string. Output only; never feed this back into math. */
export function formatCents(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, '0');
  return `${sign}$${dollars.toLocaleString('en-US')}.${remainder}`;
}

/**
 * Cents -> the number Nessie wants. Identity by design: Nessie takes whole
 * numbers and we treat its unit as cents. This exists as a named function so
 * the boundary is greppable and so that if Nessie ever turns out to want
 * dollars, there is exactly one line to change.
 */
export function toNessieAmount(cents: Cents): number {
  return toCents(cents);
}

/** The number Nessie gave back -> cents. */
export function fromNessieAmount(amount: number): Cents {
  return toCents(Math.round(amount));
}

/** Adds cent amounts without ever leaving integer space. */
export function addCents(...amounts: Cents[]): Cents {
  return toCents(amounts.reduce<number>((sum, a) => sum + a, 0));
}
