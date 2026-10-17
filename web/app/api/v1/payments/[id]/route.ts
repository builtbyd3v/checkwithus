// GET /api/v1/payments/:id: the older adult's phone polls this while its
// screen says "Waiting for family". Reading also settles anything due: an
// expired deadline, or a send that was cut off mid-flight.
import { requireDevice } from '@/lib/auth/device';
import { db } from '@/lib/db';
import { memberNames } from '@/lib/family';
import { handle, json, uuidParam } from '@/lib/http';
import { cibaApprovals, payments } from '@/lib/services';
import { devicePaymentView } from '@/lib/views';

export const GET = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const device = await requireDevice(db(), request);
  const id = uuidParam((await params).id);

  // While this screen waits, its polling is also what asks Auth0 whether the
  // family answered the Guardian push (APPROVAL_MODE=ciba).
  await cibaApprovals()?.pollPayment(id, device.circleId);
  const payment = await payments().paymentForCircle(device.circleId, id);
  const names = await memberNames(db(), payment.decidedBy ? [payment.decidedBy] : []);
  return json(devicePaymentView(payment, payment.decidedBy ? (names.get(payment.decidedBy) ?? null) : null));
});
