import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { requireMembership } from '@/lib/family';
import { VAULT_CENTS_SQL } from '@/lib/freeze';
import { handle, json, uuidParam } from '@/lib/http';
import { nessie } from '@/lib/nessie/client';
export const GET = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFamilyUser(request);
  const id = uuidParam((await params).id);
  await requireMembership(db(), user.sub, id);
  const { rows } = await db().query<{ nessie_account_id: string; ledger_balance: number; reserved: number; frozen: boolean }>(
    // Money in the Freeze vault has left the spending account.
    `select nessie_account_id, frozen, opening_balance_cents - coalesce((select sum(amount_cents)
       from spending where circle_id = c.id), 0) - ${VAULT_CENTS_SQL} as ledger_balance,
       coalesce((select sum(amount_cents) from payments where circle_id = c.id and status in ('approved', 'paying')), 0) as reserved
     from circles c where c.id = $1`, [id],
  );
  const circle = rows[0]!;
  const account = await nessie().getAccount(circle.nessie_account_id);
  return json({ nessieReportedBalanceCents: account.openingBalanceCents,
    ledgerBalanceCents: circle.ledger_balance, reservedCents: circle.reserved,
    availableCents: Math.max(0, Math.min(account.openingBalanceCents, circle.ledger_balance) - circle.reserved),
    checkedAt: new Date().toISOString(), balanceSource: 'ledger_with_nessie_ceiling', frozen: circle.frozen });
});
