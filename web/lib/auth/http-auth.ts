/** Shared pieces of request authentication. */

/** Missing or bad credentials. Always answered as 401 with a fixed message. */
export class AuthError extends Error {
  constructor(message = 'Not signed in') {
    super(message);
    this.name = 'AuthError';
  }
}

/** The token from `Authorization: Bearer <token>`, or AuthError. */
export function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) throw new AuthError('Missing bearer token');
  return match[1];
}
