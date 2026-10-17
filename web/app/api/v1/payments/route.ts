// POST /api/v1/payments: the older adult's phone asks to make a payment.
// The fixed rules decide: allowed -> sent to Nessie now; held -> the family decides.
import { createPaymentBody } from '@/lib/api-schemas';
import { requireDevice } from '@/lib/auth/device';
import { db } from '@/lib/db';
import { handle, json, readBody } from '@/lib/http';
import { toCents } from '@/lib/money';
import { payments } from '@/lib/services';
import { devicePaymentView } from '@/lib/views';

export const POST = handle(async (request) => {
  const device = await requireDevice(db(), request);
  const body = await readBody(request, createPaymentBody);

  const payment = await payments().createPayment(device.circleId, {
    idempotencyKey: body.idempotencyKey,
    amountCents: toCents(body.amountCents),
    payeeName: body.payee.name,
    payeeKind: body.payee.kind,
    category: body.category,
    onCall: body.onCall,
    guard: body.guard,
    explanation: body.explanation,
    billDueDate: body.billDueDate,
  });

  // 201 when this request created it; a replayed idempotency key is still a success.
  return json(devicePaymentView(payment, null), 201);
});
