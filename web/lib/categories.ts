/**
 * Our own vocabulary for where money goes. The iOS app, the rules engine, the
 * database and the dashboard all speak this; Nessie's strings are translated
 * at the Nessie boundary (`lib/nessie/format.ts`).
 */

export const CATEGORIES = [
  'groceries',
  'pharmacy',
  'utilities',
  'dining',
  'shopping',
  'transport',
  'healthcare',
  'gift_cards',
  'crypto',
  'wire_transfer',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Who is being paid decides which Nessie record a payment becomes:
 *   merchant -> purchase   (whole dollars only)
 *   person   -> withdrawal (whole dollars only; Nessie transfers cannot name a payee)
 *   biller   -> bill       (keeps cents)
 */
export const PAYEE_KINDS = ['merchant', 'person', 'biller'] as const;
export type PayeeKind = (typeof PAYEE_KINDS)[number];

/** Plain-words labels for the family dashboard and notifications. */
export const CATEGORY_LABELS: Record<Category, string> = {
  groceries: 'Groceries',
  pharmacy: 'Pharmacy',
  utilities: 'Utilities',
  dining: 'Dining',
  shopping: 'Shopping',
  transport: 'Transport',
  healthcare: 'Healthcare',
  gift_cards: 'Gift cards',
  crypto: 'Crypto',
  wire_transfer: 'Wire transfer',
  other: 'Other',
};

/** Payee kinds whose Nessie record drops cents. */
export function payeeKindNeedsWholeDollars(kind: PayeeKind): boolean {
  return kind !== 'biller';
}
