/** Read-only ledger verification after demo:atm -- --with-gift-card. */
import pg from 'pg';
import { z } from 'zod';
import { scamSequences } from '../lib/scam-sequence';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error('Usage: npm run check:sequence -- <held-payment-uuid>');
  const paymentId = z.uuid().parse(args[0]);
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('begin isolation level repeatable read read only');
    await client.query("set local statement_timeout = '10s'");
    const { rows } = await client.query<{
      circle_id: string; status: string; nessie_id: string | null; unexpired: boolean;
    }>(`select p.circle_id, p.status, p.nessie_id, p.expires_at > now() as unexpired
          from payments p join circles c on c.id = p.circle_id
         where p.id = $1 and c.protected_name = 'Rosa CheckWith (synthetic)'`, [paymentId]);
    const payment = rows[0];
    if (!payment) throw new Error('Payment not found in the synthetic Rosa circle');
    if (payment.status !== 'held' || !payment.unexpired || payment.nessie_id !== null) {
      throw new Error('Expected an unexpired held payment with no recorded Nessie payment ID; check before deciding it');
    }
    const evidence = (await scamSequences(client, payment.circle_id, [paymentId])).get(paymentId);
    if (!evidence) throw new Error('Missing stored sequence reason or eligible ATM ledger evidence');
    const ledger = await client.query<{ n: string }>('select count(*)::text as n from spending where payment_id = $1', [paymentId]);
    if (ledger.rows[0]?.n !== '0') throw new Error('Held gift-card request unexpectedly has spending ledger entries');
    await client.query('commit');
    console.log(JSON.stringify({
      ok: true, paymentId, status: payment.status, evidence,
      scope: 'Read-only database evidence only; does not verify Auth0 or independently inspect Nessie',
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Sequence verification failed');
  process.exitCode = 1;
});
