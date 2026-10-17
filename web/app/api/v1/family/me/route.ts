// GET /api/v1/family/me: the circles the signed-in family member belongs to.
// An empty list means they still need to join with an invite code.
import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { memberships } from '@/lib/family';
import { handle, json } from '@/lib/http';

export const GET = handle(async (request) => {
  const user = await requireFamilyUser(request);
  const circles = await memberships(db(), user.sub);
  return json({
    circles: circles.map((c) => ({
      circleId: c.circleId,
      protectedName: c.protectedName,
      yourName: c.displayName,
    })),
  });
});
