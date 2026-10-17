/** The app's long-lived services, built once per server instance. */
import 'server-only';
import { createCibaApprovals, type CibaApprovals } from '@/lib/approvals';
import { createCibaClient } from '@/lib/auth0/ciba';
import { db } from '@/lib/db';
import { appEnv, auth0Env } from '@/lib/env';
import { createFreezeService, type FreezeService } from '@/lib/freeze';
import { nessie } from '@/lib/nessie/client';
import { createPaymentService, type PaymentService } from '@/lib/payments';
import { createTopUpService, type TopUpService } from '@/lib/top-up';

let paymentService: PaymentService | undefined;
let approvals: CibaApprovals | null | undefined;
let freezeService: FreezeService | undefined;
let topUpService: TopUpService | undefined;

export function payments(): PaymentService {
  return (paymentService ??= createPaymentService({
    pool: db(),
    nessie: nessie(),
    onHeld: async (payment) => {
      await cibaApprovals()?.onHeld(payment);
    },
  }));
}

export function freeze(): FreezeService {
  return (freezeService ??= createFreezeService({ pool: db(), nessie: nessie() }));
}

export function topUp(): TopUpService {
  return (topUpService ??= createTopUpService({ pool: db(), nessie: nessie() }));
}

/** True when approvals must come through Auth0 CIBA (Guardian push) rather than the app. */
export function approvalsUseCiba(): boolean {
  return appEnv().APPROVAL_MODE === 'ciba';
}

/** The CIBA approvals service, or null when APPROVAL_MODE=app. */
export function cibaApprovals(): CibaApprovals | null {
  if (approvals === undefined) {
    if (approvalsUseCiba()) {
      const { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_AUDIENCE } = auth0Env();
      approvals = createCibaApprovals({
        pool: db(),
        ciba: createCibaClient({
          domain: AUTH0_DOMAIN,
          clientId: AUTH0_CLIENT_ID,
          clientSecret: AUTH0_CLIENT_SECRET,
          audience: AUTH0_AUDIENCE,
        }),
        payments,
      });
    } else {
      approvals = null;
    }
  }
  return approvals;
}
