// POST /api/v1/agent/bills/run  { circleId?, dueWithinDays? }
//
// The bill-pay agent, signed in as its own Auth0 M2M client with `pay:bills`,
// asks to pay known bills that are due. Our rules decide each one: inside an
// allowance it pays, otherwise it is held and the family is asked.
// Without circleId it runs for every circle that has granted an allowance.
import { z } from 'zod';
import { AGENT_SCOPES, requireAgent } from '@/lib/auth/agent';
import { circlesWithAllowances, runBillAgent } from '@/lib/bill-agent';
import { db } from '@/lib/db';
import { handle, json, readBody } from '@/lib/http';
import { payments } from '@/lib/services';

const body = z.strictObject({
  circleId: z.uuid().optional(),
  dueWithinDays: z.number().int().min(0).max(31).default(7),
});

export const POST = handle(async (request) => {
  await requireAgent(request, AGENT_SCOPES.payBills);
  const input = await readBody(request, body);
  const circleIds = input.circleId ? [input.circleId.toLowerCase()] : await circlesWithAllowances(db());
  const results = [];
  for (const circleId of circleIds) {
    for (const proposal of await runBillAgent({ pool: db(), payments: payments() }, { circleId, dueWithinDays: input.dueWithinDays })) {
      const { payment } = proposal;
      results.push({
        circleId,
        paymentId: payment.id,
        payee: proposal.payeeName,
        amountCents: proposal.amountCents,
        dueDate: proposal.dueDate,
        status: payment.status,
        allowanceId: payment.allowanceId ?? null,
        holdReasons: payment.holdReasons,
      });
    }
  }
  return json({ proposals: results });
});
