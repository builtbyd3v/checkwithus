/**
 * Demo step 4 (#17): Rosa takes $200 cash at a Nessie ATM, right now. A gift
 * card bought from the phone in the next two hours is then held as the
 * "cash then gift card" scam sequence. Each run is one more withdrawal, so run
 * it once, just before showing the step. `npm run demo:atm`
 */
import pg from 'pg';
import { dbEnv, nessieEnv } from '@/lib/env';
import { toCents } from '@/lib/money';
import { createNessieClient } from '@/lib/nessie/client';
import { withdrawalBody } from '@/lib/nessie/format';
import { createPaymentService } from '@/lib/payments';

const AMOUNT_CENTS = toCents(20_000);

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--with-gift-card')) throw new Error('Only --with-gift-card is supported');
  const nessie = createNessieClient({ key: nessieEnv().NESSIE_API_KEY });
  const pool = new pg.Pool({ connectionString: dbEnv().DATABASE_URL, max: 2 });
  try {
    const { rows } = await pool.query<{ id: string; nessie_account_id: string; time_zone: string }>(
      `select id, nessie_account_id, time_zone from circles where protected_name = 'Rosa CheckWith (synthetic)'`,
    );
    if (rows.length !== 1) throw new Error('Expected exactly one seeded synthetic Rosa circle; run seed:demo first');
    const circle = rows[0]!;
    const atm = (await nessie.listAtms())[0];
    if (!atm) throw new Error('Nessie lists no ATMs');
    const at = new Date();
    const nessieId = await nessie.createWithdrawal(circle.nessie_account_id, withdrawalBody({
      amountCents: AMOUNT_CENTS, at, timeZone: circle.time_zone, description: `ATM cash at ${atm.name}`,
    }));
    // Same ledger claim as payments: one row per Nessie record.
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('insert into spending_nessie_records (nessie_id, circle_id) values ($1, $2)', [nessieId, circle.id]);
      await client.query(
        `insert into spending (occurred_at, circle_id, amount_cents, category, payee_name, nessie_id, atm_id)
         values ($1, $2, $3, 'other', $4, $5, $6)`,
        [at, circle.id, AMOUNT_CENTS, `ATM cash: ${atm.name}`, nessieId, atm.id],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    console.log(`ATM cash $200 at ${atm.name}, ${at.toISOString()}. A gift card before ${new Date(at.getTime() + 7_200_000).toISOString()} is held as a scam sequence.`);
    if (args.includes('--with-gift-card')) {
      // Seed a held request through fixed rules. No gift-card purchase is sent
      // to Nessie and no Guardian push is seeded by this standalone helper.
      const payment = await createPaymentService({ pool, nessie }).createPayment(circle.id, {
        idempotencyKey: `demo-sequence-${nessieId}`, amountCents: toCents(50000),
        payeeName: 'Demo Gift Cards (synthetic)', payeeKind: 'merchant', category: 'gift_cards',
        onCall: false, guard: null, explanation: null,
      });
      if (payment.status !== 'held' || !payment.holdReasons.includes('cash_then_gift_card')) {
        throw new Error('Expected the synthetic gift-card request to be held as cash then gift cards');
      }
      console.log(`Synthetic sequence ready: held payment ${payment.id}. Review or deny it from the family dashboard.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Demo ATM withdrawal failed');
  process.exitCode = 1;
});
