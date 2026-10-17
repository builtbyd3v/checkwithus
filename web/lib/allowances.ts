import 'server-only';
import type pg from 'pg';
import { z } from 'zod';
import { CATEGORIES } from '@/lib/categories';
import { transaction } from '@/lib/db';
import { requireFreshLogin, requirePermission } from '@/lib/permissions';
import { requireMembership } from '@/lib/family';
import { HttpError } from '@/lib/http';

export const allowanceBody = z.strictObject({
  payeeId: z.uuid().nullable().default(null),
  category: z.enum(CATEGORIES).nullable().default(null),
  maxAmountCents: z.number().int().positive().max(100_000_000),
  expiresAt: z.iso.datetime({ offset: true }),
}).refine(v => (v.payeeId === null) !== (v.category === null), 'Choose exactly one payee or category');

export async function grantAllowance(pool: pg.Pool, sub: string, authTime: unknown, circleId: string, input: z.infer<typeof allowanceBody>) {
  requireFreshLogin(authTime);
  return transaction(pool, async q => {
    // Same lock as payment creation and revocation: no stale allowance decision.
    await q.query('select id from circles where id = $1 for update', [circleId]);
    const memberId = await requirePermission(q, sub, circleId, 'approve:payments');
    if (input.payeeId) {
      const payee = await q.query('select 1 from payees where id = $1 and circle_id = $2', [input.payeeId, circleId]);
      if (!payee.rowCount) throw new HttpError(404, 'not_found', 'Payee not found');
    }
    const { rows } = await q.query(
      `insert into allowances(circle_id, payee_id, category, max_amount_cents, expires_at, granted_by)
       select $1, $2, $3, $4, $5, $6 where $5::timestamptz > now()
       and $5::timestamptz <= now() + interval '1 year' returning id`,
      [circleId, input.payeeId, input.category, input.maxAmountCents, input.expiresAt, memberId],
    );
    if (!rows[0]) throw new HttpError(422, 'invalid_expiry', 'Expiry must be in the next year');
    return rows[0] as { id: string };
  });
}

export async function listAllowances(pool: pg.Pool, sub: string, circleId: string) {
  await requireMembership(pool, sub, circleId);
  const { rows } = await pool.query(
    `select a.id, a.payee_id as "payeeId", p.name as "payeeName", a.category,
      a.max_amount_cents as "maxAmountCents", a.expires_at as "expiresAt", a.granted_by as "grantedBy"
     from allowances a left join payees p on p.id = a.payee_id
     where a.circle_id = $1 and a.revoked_at is null and a.expires_at > now() order by a.created_at desc`, [circleId],
  );
  return rows;
}

export async function revokeAllowance(pool: pg.Pool, sub: string, circleId: string, id: string) {
  await transaction(pool, async q => {
    await q.query('select id from circles where id = $1 for update', [circleId]);
    await requirePermission(q, sub, circleId, 'approve:payments');
    const result = await q.query('update allowances set revoked_at = coalesce(revoked_at, now()) where id = $1 and circle_id = $2', [id, circleId]);
    if (!result.rowCount) throw new HttpError(404, 'not_found', 'Allowance not found');
  });
}
