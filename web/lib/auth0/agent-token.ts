/**
 * The bill-pay agent's own Auth0 sign-in: the OAuth client credentials grant
 * for its Machine-to-Machine application. Auth0 issues a token with only the
 * scopes the app is authorized for on our API (`pay:bills`); asking for more
 * gets nothing extra.
 */
import { z } from 'zod';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const tokenResponse = z.object({ access_token: z.string().min(1), scope: z.string().optional() });

export async function fetchAgentToken(input: {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  fetch?: FetchLike;
}): Promise<{ accessToken: string; scope: string | null }> {
  const doFetch: FetchLike = input.fetch ?? ((url, init) => fetch(url, init));
  const response = await doFetch(`https://${input.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      audience: input.audience,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Auth0's error code only: never the secret, never the request body.
    const code = z.object({ error: z.string() }).safeParse(json);
    throw new Error(`Auth0 refused the agent's sign-in (${response.status} ${code.success ? code.data.error : 'unknown'})`);
  }
  const parsed = tokenResponse.parse(json);
  return { accessToken: parsed.access_token, scope: parsed.scope ?? null };
}
