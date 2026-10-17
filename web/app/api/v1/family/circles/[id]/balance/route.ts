import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { requireMembership } from '@/lib/family';
import { VAULT_CENTS_SQL } from '@/lib/vault';
import { handle, json, uuidParam } from '@/lib/http';
import { nessie } from '@/lib/nessie/client';
export const GET = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFamilyUser(request);
  const id = uuidParam((await params).id);
  await requireMembership(db(), user.sub, id);
  const { rows } = await db().query<{ nessie_account_id: string; ledger_balance: number; reserved: number; frozen: boolean }>(
    // Money in the Freeze vault has left the spending account. Casts: sum() is numeric, which pg returns as a string.
    `select nessie_account_id, frozen, (opening_balance_cents - coalesce((select sum(amount_cents)
       from spending where circle_id = c.id), 0) - ${VAULT_CENTS_SQL})::bigint as ledger_balance,
       coalesce((select sum(amount_cents) from payments where circle_id = c.id and status in ('approved', 'paying')), 0)::bigint as reserved
     from circles c where c.id = $1`, [id],
  );
  const circle = rows[0]!;
  // Nessie's stored balance never changes after the account opens (verified live, INTEGRATION.md),
  // so the ledger decides and Nessie's figure is informational. Nessie being down must not hide the balance.
  const account = await nessie().getAccount(circle.nessie_account_id).catch(() => null);
  return json({ nessieReportedBalanceCents: account?.openingBalanceCents ?? null,
    ledgerBalanceCents: circle.ledger_balance, reservedCents: circle.reserved,
    availableCents: Math.max(0, circle.ledger_balance - circle.reserved),
    checkedAt: new Date().toISOString(), balanceSource: 'ledger', frozen: circle.frozen });
});
