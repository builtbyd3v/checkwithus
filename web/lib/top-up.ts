/**
 * Family top-up (#13): an approver sends money from their own Nessie account
 * into the older adult's spending with one Nessie transfer.
 *
 * Exactly once, like Freeze (lib/freeze.ts): the credit row is claimed under
 * the circle's row lock with the caller's idempotency key, so a retried tap
 * answers with the first one and never sends again. A send whose outcome is
 * unknown stays 'sending', is never repeated, and does not count: only a
 * confirmed top-up raises the balance (the safe side for money coming in). Only a definite
 * refusal (4xx) marks it failed, and then the same key may try again.
 */
import 'server-only';
import type pg from 'pg';
import { transaction } from '@/lib/db';
import { HttpError } from '@/lib/http';
import { toCents, type Cents } from '@/lib/money';
import { NessieError, type NessieClient } from '@/lib/nessie/client';
import { checkingAccountBody, customerBody, taggedDescription, transferBody } from '@/lib/nessie/format';
import { createFreezeService } from '@/lib/freeze';
import { requireFreshLogin, requirePermission } from '@/lib/permissions';

export type TopUpResult = { id: string; movedCents: Cents; status: 'sending' | 'sent' };
type Credit = { id: string; kind: string; amount_cents: number; member_id: string | null; status: string };

// ponytail: family members give no address; Nessie requires one, so it is synthetic.
const FAMILY_ADDRESS = { street_number: '1', street_name: 'Family Street', city: 'Gainesville', state: 'FL', zip: '32601' };

/** The member's own Nessie account, created on first use. Found by tag first, so a create that timed out is not made twice. */
export async function ensureFamilyAccount(pool: pg.Pool, nessie: NessieClient, memberId: string): Promise<string> {
  const { rows } = await pool.query<{ nessie_account_id: string | null; display_name: string }>(
    'select nessie_account_id, display_name from circle_members where id = $1', [memberId],
  );
  if (!rows[0]) throw new Error('Member not found');
  if (rows[0].nessie_account_id) return rows[0].nessie_account_id;
  const lastName = `CheckWith family [cw:${memberId}]`;
  const customerId = (await nessie.listCustomers()).find((c) => c.last_name === lastName)?._id
    ?? await nessie.createCustomer(customerBody({ firstName: rows[0].display_name, lastName, address: FAMILY_ADDRESS }));
  const nickname = `checkwith.us family funds [cw:${memberId}]`;
  // Opened at $0: Nessie neither checks nor changes stored balances (INTEGRATION.md).
  const accountId = (await nessie.listCustomerAccounts(customerId)).find((a) => a.nickname === nickname)?.nessieId
    ?? await nessie.createAccount(customerId, checkingAccountBody({ nickname, openingBalanceCents: toCents(0) }));
  // ponytail: two first top-ups racing here can each create an account; the first saved wins, the other stays unused.
  const saved = await pool.query<{ nessie_account_id: string }>(
    'update circle_members set nessie_account_id = coalesce(nessie_account_id, $2) where id = $1 returning nessie_account_id',
    [memberId, accountId],
  );
  return saved.rows[0]!.nessie_account_id;
}

export function createTopUpService(deps: { pool: pg.Pool; nessie: NessieClient }) {
  const { pool, nessie } = deps;

  /** A claimed top-up that definitely never reached Nessie; the same key may try again. */
  async function markFailed(creditId: string, error: unknown) {
    const failure = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    console.error(`Top-up ${creditId} failed: ${failure}`);
    await pool.query(`update ledger_credits set status = 'failed', failure = $2 where id = $1`, [creditId, failure]);
  }

  async function topUp(
    sub: string, authTime: unknown, circleId: string, input: { amountCents: Cents; idempotencyKey: string },
  ): Promise<TopUpResult> {
    const memberId = await requirePermission(pool, sub, circleId, 'approve:payments');
    // Money moves on a tap, so it needs a recent sign-in, like unfreeze.
    requireFreshLogin(authTime);
    if (input.amountCents % 100 !== 0) {
      throw new HttpError(422, 'whole_dollars_only', 'The bank only moves whole dollars between accounts.');
    }
    const claimed = await transaction(pool, async (q) => {
      // The same lock as payments and Freeze taps: a top-up lands before a freeze (and moves with it) or is refused after.
      const circle = (await q.query<{ frozen: boolean; nessie_account_id: string; time_zone: string }>(
        'select frozen, nessie_account_id, time_zone from circles where id = $1 for update', [circleId],
      )).rows[0]!;
      const existing = (await q.query<Credit>(
        // Every kind: the key is unique per circle across top-ups and deposits.
        `select id, kind, amount_cents, member_id, status from ledger_credits
          where circle_id = $1 and idempotency_key = $2`,
        [circleId, input.idempotencyKey],
      )).rows[0];
      if (existing && (existing.kind !== 'top_up' || existing.amount_cents !== input.amountCents || existing.member_id !== memberId)) {
        throw new HttpError(409, 'idempotency_conflict', 'This key was already used for a different top-up.');
      }
      if (existing && existing.status !== 'failed') return { credit: existing, send: false, circle };
      if (circle.frozen) throw new HttpError(409, 'frozen', 'Spending is frozen. Unfreeze first.');
      const { rows } = await q.query<Credit>(
        existing
          // It definitely never reached Nessie, so the same key may try again.
          ? `update ledger_credits set status = 'sending', failure = null, occurred_at = now() where id = $1
             returning id, kind, amount_cents, member_id, status`
          : `insert into ledger_credits (circle_id, kind, amount_cents, member_id, idempotency_key)
             values ($1, 'top_up', $2, $3, $4) returning id, kind, amount_cents, member_id, status`,
        existing ? [existing.id] : [circleId, input.amountCents, memberId, input.idempotencyKey],
      );
      return { credit: rows[0]!, send: true, circle };
    });

    const { credit, circle } = claimed;
    if (!claimed.send) return { id: credit.id, movedCents: toCents(credit.amount_cents), status: credit.status as TopUpResult['status'] };
    // After the frozen and key checks, so a refused tap opens no Nessie account.
    let from: string;
    try {
      from = await ensureFamilyAccount(pool, nessie, memberId);
    } catch (error) {
      await markFailed(credit.id, error);
      throw new HttpError(502, 'bank_error', 'The bank did not open your account. Try again.');
    }
    let nessieId: string;
    try {
      nessieId = await nessie.createTransfer(from, transferBody({
        amountCents: toCents(credit.amount_cents), at: new Date(), timeZone: circle.time_zone,
        description: taggedDescription(`Top-up: to spending ${circle.nessie_account_id}`, credit.id),
      }));
    } catch (error) {
      // ponytail: no lookup at Nessie to settle an unknown outcome, as in Freeze.
      if (error instanceof NessieError && error.outcomeUnknown) {
        return { id: credit.id, movedCents: toCents(credit.amount_cents), status: 'sending' };
      }
      await markFailed(credit.id, error);
      throw new HttpError(502, 'bank_error', 'The bank did not move the money. Try again.');
    }
    // If this write fails the row stays 'sending': not counted, never resent.
    await pool.query(`update ledger_credits set status = 'sent', nessie_id = $2 where id = $1`, [credit.id, nessieId]);
    // The lock was released before the send, so a Freeze tap may have swept the balance in between and missed
    // this money. If spending is frozen now, sweep it into the vault too (a failure leaves it for the next tap).
    const { rows: now } = await pool.query<{ frozen: boolean }>('select frozen from circles where id = $1', [circleId]);
    if (now[0]?.frozen) {
      await createFreezeService({ pool, nessie }).freeze(sub, circleId)
        .catch((error: unknown) => console.error(`Top-up ${credit.id} could not be swept into the frozen vault: ${error instanceof Error ? error.message : String(error)}`));
    }
    return { id: credit.id, movedCents: toCents(credit.amount_cents), status: 'sent' };
  }

  return { topUp };
}

export type TopUpService = ReturnType<typeof createTopUpService>;
