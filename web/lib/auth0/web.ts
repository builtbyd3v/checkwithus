import 'server-only';
import { Auth0Client, filterDefaultIdTokenClaims } from '@auth0/nextjs-auth0/server';

/** Cookie-backed Auth0 login for the family dashboard. */
export const auth0 = new Auth0Client({
  // The SDK verifies the ID token before this hook, but its default session
  // filter removes auth_time. Preserve that signed claim for step-up checks;
  // refreshing a token must never reset the time the person authenticated.
  beforeSessionSaved: async (session) => {
    const authTime = session.user.auth_time;
    return { ...session, user: {
      ...filterDefaultIdTokenClaims(session.user),
      ...(typeof authTime === 'number' ? { auth_time: authTime } : {}),
    } };
  },
});
