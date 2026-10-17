// POST /api/v1/agent/bills/run  { circleId?, dueWithinDays? }
//
// The bill-pay agent, signed in as its own Auth0 M2M client with `pay:bills`,
// asks to pay known bills that are due. Our rules decide each one: inside an
// allowance it pays, otherwise it is held and the family is asked.
// It acts only in circles whose family granted a live allowance (opted in).
import { z } from 'zod';
import { AGENT_SCOPES, requireAgent } from '@/lib/auth/agent';
import { circlesWithAllowances, runBillAgent } from '@/lib/bill-agent';
import { db } from '@/lib/db';
import { handle, HttpError, json, readBody } from '@/lib/http';
import { payments } from '@/lib/services';

const body = z.strictObject({
  circleId: z.uuid().optional(),
  dueWithinDays: z.number().int().min(0).max(14).default(7),
});

export const POST = handle(async (request) => {
  await requireAgent(request, AGENT_SCOPES.payBills);
  const input = await readBody(request, body);
  const invited = await circlesWithAllowances(db());
  const circleId = input.circleId?.toLowerCase();
  if (circleId && !invited.includes(circleId)) {
    throw new HttpError(403, 'agent_not_invited', 'This family has not granted the bill-pay agent an allowance.');
  }
  const results = [];
  for (const id of circleId ? [circleId] : invited) {
    for (const proposal of await runBillAgent({ pool: db(), payments: payments() }, { circleId: id, dueWithinDays: input.dueWithinDays })) {
      const { payment } = proposal;
      results.push({
        circleId: id,
        paymentId: payment?.id ?? null,
        payee: proposal.payeeName,
        amountCents: proposal.amountCents,
        dueDate: proposal.dueDate,
        status: payment?.status ?? (proposal.error ? 'error' : 'skipped'),
        skipped: proposal.skipped,
        error: proposal.error,
        allowanceId: payment?.allowanceId ?? null,
        holdReasons: payment?.holdReasons ?? [],
      });
    }
  }
  return json({ proposals: results });
});
