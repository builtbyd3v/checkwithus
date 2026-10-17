/**
 * Data the family app and dashboard read and change. Every function takes
 * the signed-in member's Auth0 `sub` and only ever touches circles they
 * belong to. A circle they are not in answers "not found", never "forbidden",
 * so a stranger cannot even learn that it exists.
 */
import 'server-only';
import type pg from 'pg';
import { transaction } from '@/lib/db';
import { PAIRING_CODE_MINUTES } from '@/lib/auth/device';
import { hashShortCode, newShortCode, normalizeShortCode } from '@/lib/auth/tokens';
import { codeHashKey } from '@/lib/env';
import { HttpError } from '@/lib/http';
import { issueInviteCode } from '@/lib/invites';
export { issueInviteCode } from '@/lib/invites';
import type { PaymentService } from '@/lib/payments';
import { familyPaymentView } from '@/lib/views';
import { requirePermission } from '@/lib/permissions';

export type Membership = {
  circleId: string;
  memberId: string;
  protectedName: string;
  displayName: string;
  role: 'approver' | 'viewer';
};

export async function memberships(pool: pg.Pool, sub: string): Promise<Membership[]> {
  const { rows } = await pool.query<{
    circle_id: string;
    member_id: string;
    protected_name: string;
    display_name: string;
    role: 'approver' | 'viewer';
  }>(
    `select m.circle_id, m.id as member_id, c.protected_name, m.display_name, m.role
       from circle_members m join circles c on c.id = m.circle_id
      where m.auth0_sub = $1
      order by m.created_at`,
    [sub],
  );
  return rows.map((r) => ({
    circleId: r.circle_id,
    memberId: r.member_id,
    protectedName: r.protected_name,
    displayName: r.display_name,
    role: r.role,
  }));
}

export async function requireMembership(
  pool: pg.Pool,
  sub: string,
  circleId: string,
): Promise<Membership> {
  const membership = (await memberships(pool, sub)).find((m) => m.circleId === circleId);
  if (!membership) throw new HttpError(404, 'not_found', 'Not found');
  return membership;
}

/** Display names of circle members by id, for "Maria said no". */
export async function memberNames(pool: pg.Pool, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { rows } = await pool.query<{ id: string; display_name: string }>(
    `select id, display_name from circle_members where id = any($1::uuid[])`,
    [ids],
  );
  return new Map(rows.map((r) => [r.id, r.display_name]));
}

export async function familyPayments(
  pool: pg.Pool,
  service: PaymentService,
  sub: string,
  options: { heldOnly: boolean; circleId?: string },
) {
  const membershipsForUser = await memberships(pool, sub);
  const circles = options.circleId === undefined
    ? membershipsForUser
    : membershipsForUser.filter((circle) => circle.circleId === options.circleId);
  if (options.circleId !== undefined && circles.length === 0) {
    throw new HttpError(404, 'not_found', 'Not found');
  }
  const payments = await service.listPayments(
    circles.map((c) => c.circleId),
    { heldOnly: options.heldOnly, limit: 50 },
  );
  const names = await memberNames(
    pool,
    payments.flatMap((p) => (p.decidedBy ? [p.decidedBy] : [])),
  );
  const protectedNames = new Map(circles.map((c) => [c.circleId, c.protectedName]));
  return payments.map((p) =>
    familyPaymentView(p, {
      protectedName: protectedNames.get(p.circleId) ?? '',
      decidedByName: p.decidedBy ? (names.get(p.decidedBy) ?? null) : null,
    }),
  );
}

/** Joins a circle with the invite code its creator shared. Joining twice is a no-op. */
export async function joinCircle(
  pool: pg.Pool,
  sub: string,
  input: { inviteCode: string; displayName: string },
): Promise<Membership> {
  const code = normalizeShortCode(input.inviteCode);
  const { rows } = code
    ? await pool.query<{ id: string }>(
        `select id from circles where invite_code_hash = $1 and invite_expires_at > now()`,
        [hashShortCode(code, codeHashKey())],
      )
    : { rows: [] };
  const circleId = rows[0]?.id;
  // Wrong, expired and never-issued codes all get the same answer.
  if (!circleId) throw new HttpError(404, 'invalid_invite', 'That invite code is not valid');

  // Already in: joining again is a no-op, even in a full circle.
  const existing = (await memberships(pool, sub)).find((m) => m.circleId === circleId);
  if (existing) return existing;

  try {
    await transaction(pool, async q => {
      await q.query('select id from circles where id = $1 for update', [circleId]);
      await q.query(
        `insert into circle_members (circle_id, auth0_sub, display_name, role)
         values ($1, $2, $3, case when exists (select 1 from circle_members where circle_id = $1)
           then 'viewer' else 'approver' end)
         on conflict (circle_id, auth0_sub) do nothing`,
        [circleId, sub, input.displayName],
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'circle_full') {
      throw new HttpError(409, 'circle_full', 'This family circle already has three people');
    }
    throw error;
  }
  return requireMembership(pool, sub, circleId);
}

/** A one-time code to pair the older adult's phone. Shown once; stored hashed. */
export async function createPairingCode(pool: pg.Pool, sub: string, circleId: string) {
  await requirePermission(pool, sub, circleId, 'approve:payments');
  const code = newShortCode();
  const { rows } = await pool.query<{ expires_at: Date }>(
    `insert into pairing_codes (code_hash, circle_id, expires_at)
     values ($1, $2, now() + make_interval(mins => $3))
     returning expires_at`,
    [hashShortCode(code, codeHashKey()), circleId, PAIRING_CODE_MINUTES],
  );
  return { code, expiresAt: rows[0]!.expires_at.toISOString() };
}

/** A fresh invite code for the circle; the old one stops working. */
export async function rotateInviteCode(pool: pg.Pool, sub: string, circleId: string) {
  await requirePermission(pool, sub, circleId, 'approve:payments');
  return issueInviteCode(pool, circleId);
}

export async function familyAlerts(pool: pg.Pool, sub: string) {
  const { rows } = await pool.query<{
    id: string;
    circle_id: string;
    protected_name: string;
    kind: 'bank_during_call' | 'ask_family';
    detail: string | null;
    created_at: Date;
  }>(
    `select a.id, a.circle_id, c.protected_name, a.kind, a.detail, a.created_at
       from alerts a
       join circles c on c.id = a.circle_id
       join circle_members m on m.circle_id = a.circle_id and m.auth0_sub = $1
      order by a.created_at desc
      limit 20`,
    [sub],
  );
  return rows.map((r) => ({
    id: r.id,
    circleId: r.circle_id,
    protectedName: r.protected_name,
    kind: r.kind,
    detail: r.detail,
    createdAt: r.created_at.toISOString(),
  }));
}
