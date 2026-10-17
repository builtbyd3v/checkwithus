/** Issue #9: small, repeatable probes against both official Nessie hosts. */
import pg from 'pg';
import { dbEnv, nessieEnv } from '@/lib/env';
import { toCents } from '@/lib/money';
import { createNessieClient, NESSIE_BASE_URLS, NessieError } from '@/lib/nessie/client';
import { createPaymentService } from '@/lib/payments';

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--write')) throw new Error('Only --write is supported');
  const write = args.includes('--write');
  const pool = new pg.Pool({ connectionString: dbEnv().DATABASE_URL, max: 2 });
  try {
    const { rows } = await pool.query<{ id: string; nessie_account_id: string; nessie_customer_id: string }>(
      `select id, nessie_account_id, nessie_customer_id from circles
        where protected_name = 'Rosa CheckWith (synthetic)'`,
    );
    if (rows.length !== 1) throw new Error('Expected exactly one seeded synthetic Rosa circle; run seed:demo first');
    const circle = rows[0]!;
    for (const baseUrl of NESSIE_BASE_URLS) {
      const host = new URL(baseUrl).hostname;
      let posts = 0;
      const client = createNessieClient({ key: nessieEnv().NESSIE_API_KEY, baseUrl,
        fetch: async (url, init) => {
          if (init.method === 'POST') posts++;
          const response = await fetch(url, init);
          console.log(JSON.stringify({ host, method: init.method, status: response.status }));
          return response;
        },
      });
      try {
        const before = await client.getAccount(circle.nessie_account_id);
        if (before.nickname !== 'Rosa demo checking (synthetic)' || before.customerId !== circle.nessie_customer_id) {
          throw new Error('Account does not match the synthetic seed');
        }
        if (!write) {
          console.log(JSON.stringify({ host, accountRead: 'ok', note: 'Use --write for a synthetic $1 utility payment' }));
          continue;
        }
        // Normal rules and ledger path, never a direct bank write or forced approval.
        const service = createPaymentService({ pool, nessie: client });
        const payment = await service.createPayment(circle.id, {
          idempotencyKey: `cw-host-check-v1-${host.split('.')[0]}`,
          amountCents: toCents(100), payeeName: 'City Power & Light', payeeKind: 'biller',
          category: 'utilities', onCall: false, guard: null, explanation: null,
        });
        const settled = await service.paymentForCircle(circle.id, payment.id);
        const after = await client.getAccount(circle.nessie_account_id);
        const ledger = await pool.query<{ count: string }>('select count(*)::text as count from spending where payment_id = $1', [payment.id]);
        console.log(JSON.stringify({ host, paymentId: payment.id, status: settled.status, posts,
          ledgerRows: Number(ledger.rows[0]!.count),
          reportedBalanceBeforeCents: before.openingBalanceCents, reportedBalanceAfterCents: after.openingBalanceCents }));
        if (settled.status !== 'paid' || ledger.rows[0]!.count !== '1') process.exitCode = 1;
      } catch (error) {
        // Never log raw fetch errors, URLs, keys, or bank response bodies.
        console.error(JSON.stringify({ host, error: error instanceof NessieError ? 'nessie_request_failed' : 'verification_failed',
          status: error instanceof NessieError ? error.status : undefined }));
        process.exitCode = 1;
      }
    }
  } finally { await pool.end(); }
}

main().catch(() => { console.error('Nessie check failed; verify configuration and synthetic seed'); process.exitCode = 1; });
