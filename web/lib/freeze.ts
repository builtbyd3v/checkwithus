/**
 * Freeze: during a live scam the family taps Freeze, and the spending balance
 * moves to a vault account with a Nessie transfer, so nothing is left to take.
 *
 *   freeze    frozen = true, then the spendable balance -> vault
 *   unfreeze  a chosen amount -> back to spending, then frozen = false
 *
 * Each tap flips `circles.frozen` under the circle's row lock, the same lock a
 * new payment takes, so a payment lands either before the freeze (and its
 * money is set aside) or after it (and it is held). The flag is set before any
 * money moves: if Nessie is down, payments are still held. Unfreeze is the
 * reverse: spending stays frozen until the transfer back has gone through, so a
 * payment can never pass the rules while the money is still in the vault.
 *
 * Exactly once: the transfer row is claimed under that lock, so two taps at
 * once produce one transfer, and a retry of a tap that already happened sends
 * nothing and answers with the transfer it made. A send whose outcome is
 * unknown is never repeated (see 014_freeze.sql).
 */
import 'server-only';
import type pg from 'pg';
import { transaction } from '@/lib/db';
import { HttpError } from '@/lib/http';
import { toCents, type Cents } from '@/lib/money';
import { NessieError, type NessieClient } from '@/lib/nessie/client';
import { taggedDescription, transferBody } from '@/lib/nessie/format';
import { requireFreshLogin, requirePermission } from '@/lib/permissions';
import { AVAILABLE_CENTS_SQL, ensureVaultAccount, VAULT_CENTS_SQL } from '@/lib/vault';

export type FreezeResult = { frozen: boolean; movedCents: Cents };

type Transfer = { id: string; direction: 'freeze' | 'unfreeze'; status: string; amount_cents: number; in_flight?: boolean };
type CircleRow = {
  frozen: boolean;
  nessie_account_id: string;
  vault_account_id: string | null;
  time_zone: string;
  spendable: number;
  vault: number;
};

export function createFreezeService(deps: { pool: pg.Pool; nessie: NessieClient }) {
  const { pool, nessie } = deps;

  /** Locks the circle and reads what a tap needs. Call inside a transaction. */
  async function lockCircle(q: pg.PoolClient, circleId: string) {
    const circle = await q.query<CircleRow>(
      `select c.frozen, c.nessie_account_id, c.vault_account_id, c.time_zone,
         ${AVAILABLE_CENTS_SQL} as spendable,
         ${VAULT_CENTS_SQL} as vault
       from circles c where c.id = $1 for update`,
      [circleId],
    );
    const last = await q.query<Transfer>(
      `select id, direction, status, amount_cents,
              status = 'sending' and created_at > now() - interval '30 seconds' as in_flight
         from vault_transfers
        where circle_id = $1 order by id desc limit 1`,
      [circleId],
    );
    return { circle: circle.rows[0]!, last: last.rows[0] ?? null };
  }

  async function claim(q: pg.PoolClient, circleId: string, direction: Transfer['direction'], amountCents: number) {
    const { rows } = await q.query<Transfer>(
      `insert into vault_transfers (circle_id, direction, amount_cents, status)
       values ($1, $2, $3::bigint, case when $3::bigint = 0 then 'sent' else 'sending' end)
       returning id, direction, status, amount_cents`,
      [circleId, direction, amountCents],
    );
    return rows[0]!;
  }

  /** A claimed transfer that never reached Nessie: it stops counting as moved. */
  async function markFailed(transfer: Transfer, error: unknown) {
    const failure = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    console.error(`Vault transfer ${transfer.id} failed: ${failure}`);
    await pool.query(`update vault_transfers set status = 'failed', failure = $2 where id = $1`, [transfer.id, failure]);
  }

  /** Sends a claimed transfer once. False when Nessie definitely refused it. */
  async function send(transfer: Transfer, from: string, label: string, timeZone: string): Promise<boolean> {
    let nessieId: string;
    try {
      nessieId = await nessie.createTransfer(from, transferBody({
        amountCents: toCents(transfer.amount_cents), at: new Date(), timeZone,
        description: taggedDescription(label, transfer.id),
      }));
    } catch (error) {
      // Unknown outcome: it may have landed, so it stays 'sending', counts as
      // moved, and is never sent again.
      // ponytail: no lookup at Nessie to settle it; its transfers list answers 404 when empty.
      if (error instanceof NessieError && error.outcomeUnknown) return true;
      await markFailed(transfer, error);
      return false;
    }
    // If this write fails the row stays 'sending': still counted, never resent.
    await pool.query(`update vault_transfers set status = 'sent', nessie_id = $2 where id = $1`, [transfer.id, nessieId]);
    return true;
  }

  async function freeze(sub: string, circleId: string): Promise<FreezeResult> {
    await requirePermission(pool, sub, circleId, 'approve:payments');
    const tap = await transaction(pool, async (q) => {
      const { circle, last } = await lockCircle(q, circleId);
      if (last?.direction === 'unfreeze' && last.in_flight) {
        throw new HttpError(409, 'unfreeze_in_progress', 'The unfreeze is still moving the money. Try again in a moment.');
      }
      // A retry of a freeze that already happened: answer with it, move nothing. A repeat tap that finds
      // whole dollars left (a top-up that landed after the sweep) falls through and sweeps them too.
      if (circle.frozen && last?.direction === 'freeze' && last.status !== 'failed' && circle.spendable < 100) {
        return { transfer: null, moved: last.amount_cents, circle };
      }
      await q.query('update circles set frozen = true where id = $1', [circleId]);
      // Nessie keeps only whole dollars of a transfer; the cents stay behind.
      const amount = Math.max(0, Math.floor(circle.spendable / 100) * 100);
      const transfer = await claim(q, circleId, 'freeze', amount);
      return { transfer, moved: transfer.amount_cents, circle };
    });
    const { transfer, circle } = tap;
    if (transfer?.status === 'sending') {
      let vault: string | null = null;
      try {
        vault = await ensureVaultAccount(pool, nessie, circleId);
      } catch (error) {
        await markFailed(transfer, error);
      }
      if (!vault || !(await send(transfer, circle.nessie_account_id, `Freeze: to vault ${vault}`, circle.time_zone))) {
        // Spending stays frozen, so payments are still held. Tapping again retries the move.
        throw new HttpError(502, 'bank_error', 'Spending is frozen, but the bank did not move the money yet. Try again.');
      }
    }
    return { frozen: true, movedCents: toCents(tap.moved) };
  }

  /** Unfreezing removes a protection, so it needs a recent sign-in (freeze stays one tap). */
  async function unfreeze(sub: string, authTime: unknown, circleId: string, amountCents: Cents): Promise<FreezeResult> {
    await requirePermission(pool, sub, circleId, 'approve:payments');
    requireFreshLogin(authTime);
    if (amountCents % 100 !== 0) {
      throw new HttpError(422, 'whole_dollars_only', 'The bank only moves whole dollars between accounts.');
    }
    const tap = await transaction(pool, async (q) => {
      const { circle, last } = await lockCircle(q, circleId);
      if (!circle.frozen) {
        const moved = last?.direction === 'unfreeze' && last.status !== 'failed' ? last.amount_cents : 0;
        return { transfer: null, moved, circle };
      }
      // A freeze still sending: let it land first, so the vault total is real.
      if (last?.direction === 'freeze' && last.in_flight) {
        throw new HttpError(409, 'freeze_in_progress', 'The freeze is still moving the money. Try again in a moment.');
      }
      if (last?.direction === 'unfreeze' && last.status !== 'failed') {
        // Another tap is moving the money back right now: never send a second transfer.
        if (last.in_flight) throw new HttpError(409, 'unfreeze_in_progress', 'The unfreeze is still moving the money. Try again in a moment.');
        // Stuck 'sending': its outcome is unknown and it may still fail, so stay frozen rather than let
        // payments pass while the money may be in the vault. Never resent.
        // ponytail: no lookup at Nessie to settle it, so this stays frozen until someone checks the bank.
        if (last.status === 'sending') {
          throw new HttpError(409, 'unfreeze_unconfirmed', 'The bank has not confirmed the earlier unfreeze, so spending stays frozen.');
        }
        // It sent but stopped before lifting the freeze: finish it, send nothing.
        await q.query('update circles set frozen = false where id = $1', [circleId]);
        return { transfer: null, moved: last.amount_cents, circle };
      }
      // No vault account yet means the first freeze is still moving the money.
      if (amountCents > circle.vault || (amountCents > 0 && !circle.vault_account_id)) {
        throw new HttpError(409, 'not_enough_in_vault', 'The vault does not hold that much.');
      }
      // Still frozen: the flag is lifted only after the money is back (below).
      const transfer = await claim(q, circleId, 'unfreeze', amountCents);
      return { transfer, moved: transfer.amount_cents, circle };
    });
    const { transfer, circle } = tap;
    if (transfer?.status === 'sending'
      && !(await send(transfer, circle.vault_account_id!, `Unfreeze: to spending ${circle.nessie_account_id}`, circle.time_zone))) {
      // Nothing moved and the flag was never lifted: still frozen, and tapping again retries.
      throw new HttpError(502, 'bank_error', 'The bank did not move the money back, so spending is still frozen. Try again.');
    }
    let frozen = false;
    if (transfer) {
      // The money is back (or may be: an unknown outcome counts). Lift the freeze unless a newer freeze took
      // over; answer with what was saved, not what was hoped.
      const lifted = await pool.query(
        `update circles set frozen = false where id = $1
           and (select direction from vault_transfers where circle_id = $1 order by id desc limit 1) = 'unfreeze'`,
        [circleId],
      );
      frozen = !lifted.rowCount;
    }
    return { frozen, movedCents: toCents(tap.moved) };
  }

  return { freeze, unfreeze };
}

export type FreezeService = ReturnType<typeof createFreezeService>;
