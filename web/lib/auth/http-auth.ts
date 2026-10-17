/** Shared pieces of request authentication. */

/** Missing or bad credentials. Always answered as 401 with a fixed message. */
export class AuthError extends Error {
  constructor(message = 'Not signed in') {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * We could not check the credentials (e.g. Auth0's signing keys could not be
 * fetched). Answered as 503 so the app retries instead of signing the person
 * out: a valid sign-in must not look invalid during someone else's outage.
 */
export class AuthUnavailableError extends Error {
  constructor(message = 'Sign-in could not be checked right now; try again shortly') {
    super(message);
    this.name = 'AuthUnavailableError';
  }
}

/** The token from `Authorization: Bearer <token>`, or AuthError. */
export function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) throw new AuthError('Missing bearer token');
  return match[1];
}
