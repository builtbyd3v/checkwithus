import { z } from 'zod';
import { requireFamilyUser } from '@/lib/auth/family';
import { db, transaction } from '@/lib/db';
import { handle, HttpError, json, readBody, uuidParam } from '@/lib/http';
import { requireFreshLogin, requirePermission } from '@/lib/permissions';
const body = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('threshold'), twoApprovalsOverCents: z.number().int().min(0).max(100_000_000) }),
  z.strictObject({ action: z.literal('role'), memberId: z.uuid(), role: z.enum(['approver', 'viewer']) }),
]);
export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFamilyUser(request);
  requireFreshLogin(user.authTime);
  const id = uuidParam((await params).id);
  const input = await readBody(request, body);
  await transaction(db(), async q => {
    await q.query('select id from circles where id = $1 for update', [id]);
    await requirePermission(q, user.sub, id, 'approve:payments');
    if (input.action === 'threshold') {
      await q.query('update circles set two_approvals_over_cents = $2 where id = $1', [id, input.twoApprovalsOverCents]);
    } else {
      const changed = await q.query(
        `update circle_members set role = $3 where id = $2 and circle_id = $1
         and ($3 = 'approver' or exists (select 1 from circle_members where circle_id = $1 and id <> $2 and role = 'approver'))`,
        [id, input.memberId, input.role],
      );
      if (!changed.rowCount) throw new HttpError(409, 'role_conflict', 'Keep at least one approver in this circle');
    }
  });
  return json({ saved: true });
});
