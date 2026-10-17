/**
 * Checks the Auth0 tenant is set up the way web/ needs, without printing any
 * secret or token.   npm run check:auth0
 *
 *  1. The tenant answers OpenID discovery, and whether it advertises CIBA.
 *  2. Our client id/secret can get an access token for AUTH0_AUDIENCE (client
 *     credentials). Proves the API exists and the credentials are right.
 *  3. That token verifies with the same checks the API applies to family
 *     tokens (issuer, audience, RS256, JWKS), and whether the API adds an RBAC
 *     `permissions` claim (Enable RBAC + Add Permissions in the Access Token).
 *  4. With AUTH0_CIBA_RAR=true: a CIBA request with `audience` and our payment
 *     `authorization_details` for a user that does not exist. Harmless: no
 *     push can be sent. It shows whether Auth0 accepts both.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

const { AUTH0_DOMAIN: domain, AUTH0_CLIENT_ID: clientId, AUTH0_CLIENT_SECRET: secret, AUTH0_AUDIENCE: audience } =
  process.env;
for (const [name, value] of Object.entries({ AUTH0_DOMAIN: domain, AUTH0_CLIENT_ID: clientId, AUTH0_CLIENT_SECRET: secret, AUTH0_AUDIENCE: audience })) {
  if (!value) {
    console.log(`✗ ${name} is not set`);
    process.exit(1);
  }
}

let ok = true;
const issuer = `https://${domain}/`;

const discovery = await fetch(`${issuer}.well-known/openid-configuration`, { signal: AbortSignal.timeout(15_000) });
if (!discovery.ok) {
  console.log(`✗ discovery answered ${discovery.status}: check AUTH0_DOMAIN`);
  process.exit(1);
}
const config = await discovery.json();
console.log(`✓ tenant reachable, issuer matches: ${config.issuer === issuer}`);
console.log(`  CIBA endpoint advertised: ${Boolean(config.backchannel_authentication_endpoint)}`);
console.log(`  grant types: ${(config.grant_types_supported ?? []).join(', ') || '(not listed)'}`);

const tokenResponse = await fetch(`${issuer}oauth/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: secret, audience }),
  signal: AbortSignal.timeout(15_000),
});
const tokenBody = await tokenResponse.json().catch(() => ({}));
if (!tokenResponse.ok) {
  ok = false;
  console.log(`✗ client credentials for AUTH0_AUDIENCE failed: ${tokenBody.error ?? tokenResponse.status}`);
  console.log(`  ${String(tokenBody.error_description ?? '').slice(0, 200)}`);
} else {
  console.log('✓ client id/secret valid; API for AUTH0_AUDIENCE exists');
  try {
    const { payload, protectedHeader } = await jwtVerify(
      tokenBody.access_token,
      createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`)),
      { issuer, audience, algorithms: ['RS256'] },
    );
    console.log(`✓ token verifies (alg ${protectedHeader.alg}, has sub: ${Boolean(payload.sub)})`);
    console.log(`  permissions claim in this client-credentials token (RBAC + Add Permissions on): ${Array.isArray(payload.permissions)}`);
  } catch (error) {
    ok = false;
    console.log(`✗ token did not verify: ${error.code ?? error.message}`);
  }
}
if (process.env.AUTH0_CIBA_RAR === 'true') {
  const probe = await fetch(`${issuer}bc-authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      scope: 'openid',
      audience,
      binding_message: 'checkwith.us setup check',
      login_hint: JSON.stringify({ format: 'iss_sub', iss: issuer, sub: 'auth0|checkwith-probe-no-such-user' }),
      // Same shape as lib/auth0/ciba.ts paymentAuthorizationDetails.
      authorization_details: JSON.stringify([{
        type: 'urn:auth0:schemas:authorization-details:v1:payment',
        instruction: 'Setup check. Nothing to approve.',
        properties: { amount: { display: true, name: 'Amount (USD)', display_order: 1, value: '$1.00' } },
      }]),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await probe.json().catch(() => ({}));
  const description = String(body.error_description ?? '');
  const said = `${body.error ?? probe.status}: ${description.replace(clientId, '<client>').slice(0, 200)}`;
  // Seen on our tenant: a refused audience says the client "is not authorized
  // to access resource server"; refused details name authorization_details.
  // Any other 4xx (here unknown_user_id, since the probe user does not exist)
  // means Auth0 accepted them.
  const is4xx = probe.status >= 400 && probe.status < 500;
  const audienceOk = is4xx && !/not authorized to access resource server/i.test(description);
  const detailsOk = audienceOk && !/authorization_details/i.test(description);
  if (!detailsOk) ok = false;
  console.log(`${audienceOk ? '✓' : '✗'} CIBA audience accepted (code ${body.error ?? probe.status})`);
  console.log(`${detailsOk ? '✓' : '✗'} CIBA authorization_details accepted -> ${said}`);
  if (!detailsOk) console.log('  Fix the tenant (web/INTEGRATION.md, "Auth0 dashboard steps") or unset AUTH0_CIBA_RAR.');
}

process.exit(ok ? 0 : 1);
