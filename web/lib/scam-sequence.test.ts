import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { SCAM_SEQUENCE_SQL, type SequenceRow } from './scam-sequence';
import { CASH_THEN_GIFT_CARD_WINDOW_SECONDS, decideHold } from './rules';
import { toCents } from './money';

const database = new PGlite();
const circle = '11111111-1111-4111-8111-111111111111';
const otherCircle = '22222222-2222-4222-8222-222222222222';
const payment = '33333333-3333-4333-8333-333333333333';
const requestedAt = new Date('2026-10-17T15:00:00Z');

beforeAll(async () => {
  // Core PostgreSQL semantics only; Tiger Data hypertable tests remain in test:db.
  await database.exec(`create table payments (id uuid, circle_id uuid, created_at timestamptz, category text, hold_reasons text[]);
    create table spending (circle_id uuid, occurred_at timestamptz, amount_cents bigint, payee_name text, atm_id text, nessie_id text);`);
}, 30_000);
afterAll(() => database.close());
beforeEach(async () => {
  await database.exec('truncate payments, spending');
  await database.query(`insert into payments values ($1,$2,$3,'gift_cards',array['gift_card','cash_then_gift_card'])`, [payment, circle, requestedAt]);
});
const cash = (secondsBefore: number, family = circle, atmId: string | null = 'synthetic-atm') => database.query(
  'insert into spending values ($1,$2,20000,$3,$4,$5)',
  [family, new Date(requestedAt.getTime() - secondsBefore * 1000), 'ATM cash: Test ATM', atmId, crypto.randomUUID()],
);
const matches = async (family = circle) => (await database.query<SequenceRow>(SCAM_SEQUENCE_SQL,
  [family, [payment], CASH_THEN_GIFT_CARD_WINDOW_SECONDS])).rows;

it('shows seeded cash then gift-card evidence on the payment held by fixed rules', async () => {
  await cash(1800);
  const evidence = await matches();
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({ payment_id: payment, cash_cents: '20000', atm_name: 'ATM cash: Test ATM' });
  expect(decideHold({
    payment: { amountCents: toCents(50000), category: 'gift_cards', payeeKind: 'merchant', payeeKnown: true, onCall: false },
    holdOverCents: toCents(100000), baseline: null, guard: null,
    circle: { frozen: false, atmCashRecently: evidence.length > 0 },
  })).toEqual({ action: 'hold', reasons: ['gift_card', 'cash_then_gift_card'] });
});

it('includes exactly two hours but excludes one second beyond the window', async () => {
  await cash(7200);
  expect(await matches()).toHaveLength(1);
  await database.exec('truncate spending');
  await cash(7201);
  expect(await matches()).toEqual([]);
});

it('does not expose another family, future cash, or an ordinary purchase', async () => {
  await cash(600, otherCircle);
  await cash(-1);
  await cash(600, circle, null);
  expect(await matches()).toEqual([]);
  await cash(600);
  expect(await matches(otherCircle)).toEqual([]);
});

it('uses the original payment time and picks the most recent eligible cash', async () => {
  await cash(3600);
  await cash(900);
  const evidence = (await matches())[0]!;
  expect(new Date(evidence.cash_at).toISOString()).toBe('2026-10-17T14:45:00.000Z');
});

it('does not invent a sequence for a payment without the stored hold reason', async () => {
  await cash(600);
  await database.query("update payments set hold_reasons = array['gift_card']");
  expect(await matches()).toEqual([]);
});
