// POST /api/v1/family/join: join a family circle with its invite code.
import { joinBody } from '@/lib/api-schemas';
import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { joinCircle } from '@/lib/family';
import { handle, json, readBody } from '@/lib/http';

export const POST = handle(async (request) => {
  const user = await requireFamilyUser(request);
  const body = await readBody(request, joinBody);
  const membership = await joinCircle(db(), user.sub, body);
  return json({ circleId: membership.circleId, protectedName: membership.protectedName });
});
