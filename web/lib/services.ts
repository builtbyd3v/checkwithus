/** The app's long-lived services, built once per server instance. */
import 'server-only';
import { db } from '@/lib/db';
import { nessie } from '@/lib/nessie/client';
import { createPaymentService, type PaymentService } from '@/lib/payments';

let paymentService: PaymentService | undefined;

export function payments(): PaymentService {
  return (paymentService ??= createPaymentService({ pool: db(), nessie: nessie() }));
}
