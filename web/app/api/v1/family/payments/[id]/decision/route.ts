// POST /api/v1/family/payments/:id/decision  { "decision": "approve" | "deny" }
//
// The family app calls this after Face ID succeeds on the phone. The first
// answer from anyone in the circle decides; a later answer gets 409 with the
// payment as it now stands, so the app can say "Leo already said no".
import { decisionBody } from '@/lib/api-schemas';
import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { memberNames, requireMembership } from '@/lib/family';
import { errorResponse, handle, json, readBody, uuidParam } from '@/lib/http';
import { PaymentError, type Payment } from '@/lib/payments';
import { payments } from '@/lib/services';
import { familyPaymentView } from '@/lib/views';

export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFamilyUser(request);
  const id = uuidParam((await params).id);
  const { decision } = await readBody(request, decisionBody);

  const view = async (payment: Payment) => {
    const membership = await requireMembership(db(), user.sub, payment.circleId);
    const names = await memberNames(db(), payment.decidedBy ? [payment.decidedBy] : []);
    return familyPaymentView(payment, {
      protectedName: membership.protectedName,
      decidedByName: payment.decidedBy ? (names.get(payment.decidedBy) ?? null) : null,
    });
  };

  try {
    const payment = await payments().decidePayment({
      paymentId: id,
      member: { auth0Sub: user.sub },
      decision,
      via: 'app',
    });
    return json(await view(payment));
  } catch (error) {
    if (
      error instanceof PaymentError &&
      (error.code === 'already_decided' || error.code === 'expired') &&
      error.payment
    ) {
      return json({ error: error.code, message: error.message, payment: await view(error.payment) }, 409);
    }
    return errorResponse(error);
  }
});
