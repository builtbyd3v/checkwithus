/** Synthetic Rosa demo. Run once with `npm run seed:demo`; safe to rerun. Also used by demo:reset. */
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { dbEnv, nessieEnv } from '@/lib/env';
import { ensureVaultAccount } from '@/lib/vault';
import { issueInviteCode } from '@/lib/invites';
import { toCents } from '@/lib/money';
import { normalizeName } from '@/lib/names';
import { createNessieClient, type NessieClient } from '@/lib/nessie/client';
import {
  checkingAccountBody,
  customerBody,
  depositBody,
  merchantBody,
  paidBillBody,
  purchaseBody,
  type NessieRecord,
} from '@/lib/nessie/format';
import type { Category } from '@/lib/categories';

const CUSTOMER = { firstName: 'Rosa', lastName: 'CheckWithSynthetic' };
const ACCOUNT_NICKNAME = 'Rosa demo checking (synthetic)';
const OPENING_CENTS = toCents(1_200_000);
const ADDRESS = {
  street_number: '100', street_name: 'Demo Street', city: 'Gainesville', state: 'FL', zip: '32601',
};
const LOCATION = { address: ADDRESS, geocode: { lat: 29.6516, lng: -82.3248 } };
const TIME_ZONE = 'America/New_York';
const ANCHOR = Date.UTC(2026, 9, 17, 16);
const atDaysAgo = (days: number) => new Date(ANCHOR - days * 86_400_000);
const MARKER = '[seed:cw:v1:';

type Merchant = { name: string; category: Category; amountCents: number };
const MERCHANTS: Merchant[] = [
  { name: 'Sunrise Grocery', category: 'groceries', amountCents: 4200 },
  { name: 'Neighborhood Pharmacy', category: 'pharmacy', amountCents: 1800 },
  { name: 'Corner Cafe', category: 'dining', amountCents: 2400 },
];

export type SeedOptions = {
  pool: pg.Pool;
  nessie: NessieClient;
  /** A different synthetic Nessie customer, so throwaway schemas never share live Rosa's accounts. */
  customerLastName?: string;
  rotateInvite?: boolean;
};

/** Creates or finds Rosa's circle, accounts, history and vault. Idempotent. */
export async function seedDemo({ pool, nessie, customerLastName = CUSTOMER.lastName, rotateInvite = false }: SeedOptions) {
  { // ponytail: bare block keeps the old body's indentation, so the diff stays small.
    const customers = await nessie.listCustomers();
    const existingCustomer = customers.find(
      (customer) => customer.first_name === CUSTOMER.firstName && customer.last_name === customerLastName,
    );
    const customerId = existingCustomer?._id ?? await nessie.createCustomer(customerBody({
      firstName: CUSTOMER.firstName, lastName: customerLastName, address: ADDRESS,
    }));

    const accounts = await nessie.listCustomerAccounts(customerId);
    const existingAccount = accounts.find((account) => account.nickname === ACCOUNT_NICKNAME && account.type === 'Checking');
    const accountId = existingAccount?.nessieId ?? await nessie.createAccount(
      customerId, checkingAccountBody({ nickname: ACCOUNT_NICKNAME, openingBalanceCents: OPENING_CENTS }),
    );

    const { rows: circles } = await pool.query<{ id: string; invite_expires_at: Date | null }>(
      `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
       values ('Rosa CheckWith (synthetic)', $1, $2, $3)
       on conflict (nessie_account_id) do update
         set nessie_customer_id = excluded.nessie_customer_id
       returning id, invite_expires_at`,
      [customerId, accountId, OPENING_CENTS],
    );
    const circleId = circles[0]!.id;
    // The Freeze vault (#18). Found by nickname at Nessie, so a rerun reuses it.
    const vaultId = await ensureVaultAccount(pool, nessie, circleId);
    for (const payee of [
      { name: 'City Power & Light', kind: 'biller', category: 'utilities' },
      ...MERCHANTS.slice(0, 2).map(({ name, category }) => ({ name, kind: 'merchant', category })),
    ]) {
      await pool.query(
        `insert into payees (circle_id, name, normalized_name, kind, category)
         values ($1, $2, $3, $4, $5) on conflict (circle_id, kind, normalized_name) do nothing`,
        [circleId, payee.name, normalizeName(payee.name), payee.kind, payee.category],
      );
    }

    const knownMerchants = await nessie.listMerchants();
    const merchantIds = new Map<string, string>();
    for (const merchant of MERCHANTS) {
      const existing = knownMerchants.find((item) => item.name === merchant.name && item.category === merchant.category);
      const id = existing?._id ?? await nessie.createMerchant(merchantBody({
        name: merchant.name, category: merchant.category, ...LOCATION,
      }));
      merchantIds.set(merchant.name, id);
      await pool.query(
        `insert into nessie_merchants (normalized_name, category, name, nessie_merchant_id)
         values ($1, $2, $3, $4) on conflict do nothing`,
        [normalizeName(merchant.name), merchant.category, merchant.name, id],
      );
    }

    const existingRecords = await nessie.listRecords(accountId);
    let created = 0;
    let ledgerAdded = 0;
    async function ensureSpending(input: {
      key: string; at: Date; amountCents: number; category: Category; payeeName: string;
      create: () => Promise<string>;
    }) {
      const marker = `${MARKER}${input.key}]`;
      const existing = existingRecords.find((record: NessieRecord) => record.reference.includes(marker));
      if (existing && existing.amountCents !== input.amountCents) {
        throw new Error(`Demo record ${input.key} has an unexpected amount`);
      }
      const nessieId = existing?.nessieId ?? await input.create();
      if (!existing) created++;
      const client = await pool.connect();
      try {
        await client.query('begin');
        const claim = await client.query(
          `insert into spending_nessie_records (nessie_id, circle_id) values ($1, $2)
           on conflict do nothing`,
          [nessieId, circleId],
        );
        if (claim.rowCount) {
          await client.query(
            `insert into spending (occurred_at, circle_id, amount_cents, category, payee_name, nessie_id)
             values ($1, $2, $3, $4, $5, $6)`,
            [input.at, circleId, input.amountCents, input.category, input.payeeName, nessieId],
          );
          ledgerAdded++;
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }

    // Eighteen ordinary purchases spread across nearly 90 days, plus three
    // utility bills. A rerun finds each marker at Nessie before writing.
    let index = 0;
    for (let days = 88; days >= 3; days -= 5) {
      const merchant = MERCHANTS[index % MERCHANTS.length]!;
      const at = atDaysAgo(days);
      const key = `purchase:${days}`;
      const amountCents = toCents(merchant.amountCents);
      await ensureSpending({
        key, at, amountCents, category: merchant.category, payeeName: merchant.name,
        create: () => nessie.createPurchase(accountId, purchaseBody({
          merchantId: merchantIds.get(merchant.name)!, amountCents, at, timeZone: TIME_ZONE,
          description: `${merchant.name} ${MARKER}${key}]`,
        })),
      });
      index++;
    }
    for (const days of [75, 45, 15]) {
      const at = atDaysAgo(days);
      const key = `bill:${days}`;
      const amountCents = toCents(8_412);
      await ensureSpending({
        key, at, amountCents, category: 'utilities', payeeName: 'City Power & Light',
        create: () => nessie.createBill(accountId, paidBillBody({
          payee: 'City Power & Light', nickname: `Utilities ${MARKER}${key}]`,
          amountCents, at, timeZone: TIME_ZONE,
        })),
      });
    }

    // Rosa's monthly pension, as Nessie deposits. Credits add to the ledger balance (017_ledger_credits.sql).
    for (const days of [76, 46, 16]) {
      const key = `deposit:${days}`;
      const at = atDaysAgo(days);
      const amountCents = toCents(150_000);
      const existing = existingRecords.find((record) => record.kind === 'deposit' && record.reference.includes(`${MARKER}${key}]`));
      if (existing && existing.amountCents !== amountCents) throw new Error(`Demo record ${key} has an unexpected amount`);
      const nessieId = existing?.nessieId ?? await nessie.createDeposit(accountId, depositBody({
        amountCents, at, timeZone: TIME_ZONE, description: `Monthly pension ${MARKER}${key}]`,
      }));
      if (!existing) created++;
      const added = await pool.query(
        `insert into ledger_credits (circle_id, kind, amount_cents, status, idempotency_key, nessie_id, occurred_at)
         values ($1, 'deposit', $2, 'sent', $3, $4, $5) on conflict (circle_id, idempotency_key) do nothing`,
        [circleId, amountCents, `seed:${key}`, nessieId, at],
      );
      ledgerAdded += added.rowCount ?? 0;
    }

    // These backdated rows can sit behind the continuous aggregate watermark.
    // Refresh once so the dashboard and unusual-spending rule see them now.
    await pool.query(
      `call refresh_continuous_aggregate('spending_daily',
         now() - interval '91 days', now() - interval '1 hour')`,
    );
    // spending_weekly rolls up spending_daily, so it refreshes after it.
    await pool.query(
      `call refresh_continuous_aggregate('spending_weekly',
         now() - interval '98 days', now() - interval '1 hour')`,
    );
    await pool.query(
      `call refresh_continuous_aggregate('spending_payee_daily',
         now() - interval '91 days', now() - interval '1 hour')`,
    );

    const inviteIsValid = circles[0]!.invite_expires_at && circles[0]!.invite_expires_at > new Date();
    const invite = !inviteIsValid || rotateInvite ? await issueInviteCode(pool, circleId) : null;
    return { circleId, customerId, accountId, vaultId, created, ledgerAdded, invite };
  }
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--rotate-invite')) {
    throw new Error('Only --rotate-invite is supported');
  }
  const nessie = createNessieClient({ key: nessieEnv().NESSIE_API_KEY });
  const pool = new pg.Pool({ connectionString: dbEnv().DATABASE_URL, max: 2 });
  try {
    const { circleId, customerId, accountId, vaultId, created, ledgerAdded, invite } = await seedDemo({
      pool, nessie, rotateInvite: process.argv.includes('--rotate-invite'),
    });
    console.log(`Demo circle ${circleId}; Nessie customer ${customerId}; account ${accountId}`);
    console.log(`Nessie records created: ${created}; Tiger Data ledger rows added: ${ledgerAdded}`);
    console.log(`Freeze vault account ${vaultId}. Run npm run demo:atm right before demo step 4.`);
    if (invite) console.log(`Family invite code: ${invite.code} (expires ${invite.expiresAt})`);
    else console.log('Existing family invite remains valid; use --rotate-invite to show a fresh one.');
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo seed failed');
    process.exitCode = 1;
  });
}
