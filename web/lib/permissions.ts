import 'server-only';
import type { Queryable } from '@/lib/db';
import { HttpError } from '@/lib/http';

/** Circle-specific RBAC is server-owned; a caller cannot send its own role. */
export async function requirePermission(q: Queryable, sub: string, circleId: string, permission: 'approve:payments') {
  const { rows } = await q.query<{ id: string; role: string }>(
    'select id, role from circle_members where circle_id = $1 and auth0_sub = $2', [circleId, sub],
  );
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Not found');
  if (rows[0].role !== 'approver') throw new HttpError(403, 'permission_required', `${permission} permission required`);
  return rows[0].id;
}

/** auth_time comes from a verified Auth0 token/session, never a request body. */
export function requireFreshLogin(authTime: unknown) {
  const now = Math.floor(Date.now() / 1000);
  if (typeof authTime !== 'number' || !Number.isSafeInteger(authTime) || authTime > now + 30 || now - authTime > 300) {
    throw new HttpError(403, 'step_up_required', 'Sign in again to authorize this change.');
  }
}
