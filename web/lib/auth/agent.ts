/**
 * The bill-pay agent signs in as its own Auth0 Machine-to-Machine client
 * (client credentials grant), never as a family member. Its token must be:
 *
 *   - a valid RS256 access token for our API (issuer, audience), and
 *   - a client credentials token (`gty`) issued to AUTH0_AGENT_CLIENT_ID
 *     (`sub` is `<client id>@clients`; `azp`, when present, the same id), and
 *   - carry the scope the route needs (`pay:bills`).
 *
 * The scope only lets the agent ASK to pay a known biller. Whether money moves
 * is still decided by createPayment's fixed rules and the family's allowances.
 * Family routes reject machine tokens outright (lib/auth/family.ts).
 */
import 'server-only';
import { agentClientId } from '@/lib/env';
import { HttpError } from '@/lib/http';
import { verifyApiToken } from './family';
import { bearerToken } from './http-auth';

/** Every scope the agent can hold. Grant only these on the Auth0 API. */
export const AGENT_SCOPES = { payBills: 'pay:bills' } as const;
export type AgentScope = (typeof AGENT_SCOPES)[keyof typeof AGENT_SCOPES];

export async function requireAgent(request: Request, scope: AgentScope): Promise<{ clientId: string }> {
  const clientId = agentClientId();
  if (!clientId) {
    throw new HttpError(503, 'agent_disabled', 'The bill-pay agent is off: AUTH0_AGENT_CLIENT_ID is not set.');
  }
  const payload = await verifyApiToken(bearerToken(request));
  const isAgent =
    payload.gty === 'client-credentials' &&
    payload.sub === `${clientId}@clients` &&
    (payload.azp === undefined || payload.azp === clientId);
  if (!isAgent) throw new HttpError(403, 'agent_only', 'Only the bill-pay agent can call this.');
  const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];
  if (!scopes.includes(scope)) {
    throw new HttpError(403, 'insufficient_scope', `The agent's token needs the ${scope} scope.`);
  }
  return { clientId };
}
