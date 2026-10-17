// GET /api/v1/family/payments/:id: authenticated family polling and recovery.
// Authorize before polling Auth0 or touching the payment state machine.
import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { memberNames } from '@/lib/family';
import { handle, HttpError, json, uuidParam } from '@/lib/http';
import { cibaApprovals, payments } from '@/lib/services';
import { familyPaymentView } from '@/lib/views';

export const GET = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFamilyUser(request);
  const id = uuidParam((await params).id);
  const { rows } = await db().query<{ circle_id: string; protected_name: string }>(
    `select p.circle_id, c.protected_name
       from payments p
       join circles c on c.id = p.circle_id
       join circle_members m on m.circle_id = p.circle_id
      where p.id = $1 and m.auth0_sub = $2`,
    [id, user.sub],
  );
  const circle = rows[0];
  if (!circle) throw new HttpError(404, 'not_found', 'Not found');

  await cibaApprovals()?.pollPayment(id, circle.circle_id);
  const payment = await payments().paymentForCircle(circle.circle_id, id);
  const names = await memberNames(db(), payment.decidedBy ? [payment.decidedBy] : []);
  return json(familyPaymentView(payment, {
    protectedName: circle.protected_name,
    decidedByName: payment.decidedBy ? (names.get(payment.decidedBy) ?? null) : null,
  }));
});
