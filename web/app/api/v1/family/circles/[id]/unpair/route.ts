// POST /api/v1/family/circles/:id/unpair: revokes the older adult's phone token.
// Approver only, fresh sign-in. The phone hears 401 and returns to its first screen.
import { z } from 'zod';
import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { unpairDevices } from '@/lib/family';
import { handle, json, readBody, uuidParam } from '@/lib/http';
import { requireTokenPermission } from '@/lib/permissions';

export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFamilyUser(request);
  requireTokenPermission(user.permissions, 'approve:payments');
  const circleId = uuidParam((await params).id);
  await readBody(request, z.strictObject({}));
  return json(await unpairDevices(db(), user.sub, user.authTime, circleId));
});
