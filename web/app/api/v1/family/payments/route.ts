// GET /api/v1/family/payments?status=held: what is waiting for this family
// member's answer, or (without the filter) the 50 most recent payments.
import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { familyPayments } from '@/lib/family';
import { handle, HttpError, json } from '@/lib/http';
import { payments } from '@/lib/services';

export const GET = handle(async (request) => {
  const user = await requireFamilyUser(request);
  const status = new URL(request.url).searchParams.get('status');
  if (status !== null && status !== 'held') {
    throw new HttpError(400, 'invalid_request', '`status` may only be "held"');
  }
  return json({
    payments: await familyPayments(db(), payments(), user.sub, { heldOnly: status === 'held' }),
  });
});
