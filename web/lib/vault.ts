/**
 * The Freeze vault (lib/freeze.ts). Kept apart from the route plumbing so the
 * demo seed can use it outside Next.
 */
import 'server-only';
import type pg from 'pg';
import type { NessieClient } from '@/lib/nessie/client';
import { vaultAccountBody } from '@/lib/nessie/format';

/** Cents in circle `c`'s vault. A transfer counts unless it definitely failed. */
export const VAULT_CENTS_SQL = `coalesce((select sum(case t.direction when 'freeze' then t.amount_cents
  else -t.amount_cents end) from vault_transfers t where t.circle_id = c.id and t.status <> 'failed'), 0)::bigint`;

/**
 * Cents added to circle `c`'s spending by top-ups and deposits (017_ledger_credits.sql).
 * Only confirmed credits count: the opposite of the vault, because the safe side
 * for money coming in is to wait until it surely arrived.
 */
export const CREDIT_CENTS_SQL = `coalesce((select sum(k.amount_cents) from ledger_credits k
  where k.circle_id = c.id and k.status = 'sent'), 0)::bigint`;

/** The circle's vault account at Nessie, created on first use. Safe to call again. */
export async function ensureVaultAccount(pool: pg.Pool, nessie: NessieClient, circleId: string): Promise<string> {
  const { rows } = await pool.query<{ vault_account_id: string | null; nessie_customer_id: string }>(
    'select vault_account_id, nessie_customer_id from circles where id = $1', [circleId],
  );
  if (!rows[0]) throw new Error('Circle not found');
  if (rows[0].vault_account_id) return rows[0].vault_account_id;
  // Found by nickname first, so a create that timed out is not made twice.
  const nickname = `checkwith.us vault [cw:${circleId}]`;
  const existing = (await nessie.listCustomerAccounts(rows[0].nessie_customer_id))
    .find((account) => account.nickname === nickname);
  const created = existing?.nessieId
    ?? await nessie.createAccount(rows[0].nessie_customer_id, vaultAccountBody({ nickname }));
  // ponytail: two first freezes racing here can each create an account; the first saved wins, the other stays empty.
  const saved = await pool.query<{ vault_account_id: string }>(
    'update circles set vault_account_id = coalesce(vault_account_id, $2) where id = $1 returning vault_account_id',
    [circleId, created],
  );
  return saved.rows[0]!.vault_account_id;
}
