// GET /api/v1/family/payments?status=held: what is waiting for this family
// member's answer, or (without the filter) the 50 most recent payments.
import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { familyPayments, memberships } from '@/lib/family';
import { handle, HttpError, json } from '@/lib/http';
import { cibaApprovals, payments } from '@/lib/services';

export const GET = handle(async (request) => {
  const user = await requireFamilyUser(request);
  const status = new URL(request.url).searchParams.get('status');
  if (status !== null && status !== 'held') {
    throw new HttpError(400, 'invalid_request', '`status` may only be "held"');
  }
  // Pick up any Guardian answers first, so the list is current (APPROVAL_MODE=ciba).
  const circles = await memberships(db(), user.sub);
  await cibaApprovals()?.pollCircles(circles.map((c) => c.circleId));
  return json({
    payments: await familyPayments(db(), payments(), user.sub, { heldOnly: status === 'held' }),
  });
});
