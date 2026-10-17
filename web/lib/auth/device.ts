/**
 * The older adult's phone. It never signs in: the family pairs it once with a
 * short code, and it gets a long random token it sends on every request.
 * Only the token's SHA-256 is stored, so a database leak does not leak
 * working tokens.
 */
import 'server-only';
import type pg from 'pg';
import { transaction } from '@/lib/db';
import { AuthError, bearerToken } from './http-auth';
import { looksLikeDeviceToken, newDeviceToken, normalizeShortCode, sha256 } from './tokens';

export type Device = { id: string; circleId: string };

/** The paired, unrevoked device making this request, or AuthError (401). */
export async function requireDevice(pool: pg.Pool, request: Request): Promise<Device> {
  const token = bearerToken(request);
  // Cheap shape check first, so garbage never costs a database query.
  if (!looksLikeDeviceToken(token)) throw new AuthError('Invalid device token');

  const { rows } = await pool.query<{ id: string; circle_id: string }>(
    `update devices set last_seen_at = now()
      where token_hash = $1 and revoked_at is null
     returning id, circle_id`,
    [sha256(token)],
  );
  if (!rows[0]) throw new AuthError('Invalid device token');
  return { id: rows[0].id, circleId: rows[0].circle_id };
}

/** Pairing codes live this long. Long enough to walk across a room. */
export const PAIRING_CODE_MINUTES = 10;

/**
 * Trades a pairing code for a device token. The code is spent in the same
 * statement that checks it, so it works exactly once even if two phones try
 * it at the same moment.
 */
export async function pairDevice(
  pool: pg.Pool,
  input: { code: string; label: string },
): Promise<{ token: string; device: Device } | null> {
  const code = normalizeShortCode(input.code);
  if (!code) return null;

  // One transaction: if the device cannot be saved, the code is not spent.
  return transaction(pool, async (client) => {
    const spent = await client.query<{ circle_id: string }>(
      `update pairing_codes set used_at = now()
        where code_hash = $1 and used_at is null and expires_at > now()
       returning circle_id`,
      [sha256(code)],
    );
    const circleId = spent.rows[0]?.circle_id;
    if (!circleId) return null;

    const token = newDeviceToken();
    const { rows } = await client.query<{ id: string }>(
      `insert into devices (circle_id, token_hash, label) values ($1, $2, $3) returning id`,
      [circleId, sha256(token), input.label],
    );
    return { token, device: { id: rows[0]!.id, circleId } };
  });
}
