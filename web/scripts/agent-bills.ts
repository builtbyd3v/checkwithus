/**
 * The bill-pay agent (#19), as its own Auth0 identity. It signs in with the
 * client credentials grant (AUTH0_AGENT_CLIENT_ID / _SECRET, scope pay:bills)
 * and asks our API to pay the bills that are due. The API's rules decide:
 * inside an allowance it pays with no push; otherwise the family is asked.
 *
 *   npm run agent:bills                          circles with an allowance, due in 7 days
 *   npm run agent:bills -- --circle <id> --within 14
 *
 * The summary below is fixed text built from the API's answer. No AI model.
 */
import { z } from 'zod';
import { fetchAgentToken } from '@/lib/auth0/agent-token';
import { formatCents, toCents } from '@/lib/money';

const env = z.object({
  AUTH0_DOMAIN: z.string().min(1),
  AUTH0_AUDIENCE: z.string().min(1),
  AUTH0_AGENT_CLIENT_ID: z.string().min(1, 'is required: the agent is off without it'),
  AUTH0_AGENT_CLIENT_SECRET: z.string().min(1, 'is required: the agent is off without it'),
  APP_BASE_URL: z.url(),
});

const answer = z.object({
  proposals: z.array(z.object({
    payee: z.string(), amountCents: z.number().int(), dueDate: z.string(), status: z.string(),
    allowanceId: z.string().nullable(), holdReasons: z.array(z.string()),
    skipped: z.string().nullable(), error: z.string().nullable(),
  })),
});

const SKIP_WORDS: Record<string, string> = { family_said_no: 'family said no', expired: 'nobody answered in time', failed: 'the bank send failed' };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const parsed = env.safeParse(process.env);
  if (!parsed.success) {
    // Names only, never values.
    throw new Error(`Agent configuration: ${parsed.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  const e = parsed.data;
  const { accessToken, scope } = await fetchAgentToken({
    domain: e.AUTH0_DOMAIN, clientId: e.AUTH0_AGENT_CLIENT_ID, clientSecret: e.AUTH0_AGENT_CLIENT_SECRET, audience: e.AUTH0_AUDIENCE,
  });
  console.log(`Signed in as the bill-pay agent (scope: ${scope ?? 'none'})`);
  const circleId = arg('--circle');
  const within = arg('--within');
  const response = await fetch(`${e.APP_BASE_URL}/api/v1/agent/bills/run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ...(circleId ? { circleId } : {}), ...(within ? { dueWithinDays: Number(within) } : {}) }),
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(`API answered ${response.status}: ${JSON.stringify(body)}`);
  const { proposals } = answer.parse(body);
  if (!proposals.length) console.log('No known bills are due.');
  for (const p of proposals) {
    const what = `${p.payee} ${formatCents(toCents(p.amountCents))} (due ${p.dueDate})`;
    if (p.skipped) console.log(`Skipped: ${what}: ${SKIP_WORDS[p.skipped] ?? p.skipped}`);
    else if (p.error) console.log(`Not paid: ${what}: ${p.error}`);
    else if (p.status === 'held') console.log(`Asked the family: ${what}. Reason: ${p.holdReasons.join(', ')}`);
    else if (p.allowanceId) console.log(`Paid under the family's allowance: ${what}. Status: ${p.status}`);
    else console.log(`${what}: ${p.status}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
