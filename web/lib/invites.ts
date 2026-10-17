import 'server-only';
import type pg from 'pg';
import { hashShortCode, newShortCode } from '@/lib/auth/tokens';
import { codeHashKey } from '@/lib/env';

/** Invite codes work this long. */
export const INVITE_CODE_DAYS = 7;

/** Sets a new invite code on a circle. Also used by the demo seed. */
export async function issueInviteCode(pool: pg.Pool, circleId: string) {
  const code = newShortCode();
  const { rows } = await pool.query<{ invite_expires_at: Date }>(
    `update circles
        set invite_code_hash = $2,
            invite_expires_at = now() + make_interval(days => $3)
      where id = $1
     returning invite_expires_at`,
    [circleId, hashShortCode(code, codeHashKey()), INVITE_CODE_DAYS],
  );
  if (!rows[0]) throw new Error('Circle not found');
  return { code, expiresAt: rows[0].invite_expires_at.toISOString() };
}
