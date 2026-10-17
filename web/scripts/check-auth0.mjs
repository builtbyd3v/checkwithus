/**
 * Checks the Auth0 tenant is set up the way web/ needs, without printing any
 * secret or token.   npm run check:auth0
 *
 *  1. The tenant answers OpenID discovery, and whether it advertises CIBA.
 *  2. Our client id/secret can get an access token for AUTH0_AUDIENCE (client
 *     credentials). Proves the API exists and the credentials are right.
 *  3. That token verifies with the same checks the API applies to family
 *     tokens (issuer, audience, RS256, JWKS).
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
  } catch (error) {
    ok = false;
    console.log(`✗ token did not verify: ${error.code ?? error.message}`);
  }
}
process.exit(ok ? 0 : 1);
