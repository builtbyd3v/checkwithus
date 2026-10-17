/**
 * Shared plumbing for route handlers: JSON in (validated), JSON out, and one
 * place that turns errors into responses.
 *
 * Unexpected errors become a generic 500. Their details go to the server log
 * only: stack traces and SQL never reach a phone.
 */
import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { connection } from 'next/server';
import type { z } from 'zod';
import { AuthError } from '@/lib/auth/http-auth';
import { PaymentError, type PaymentErrorCode } from '@/lib/payments';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

const MAX_BODY_CHARS = 16_384;

/**
 * Reads and validates a JSON body. Schemas are strict, so an unknown field is
 * an error rather than silently ignored: a phone sending `amount` instead of
 * `amountCents` hears about it instead of the server never seeing the amount.
 */
export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_CHARS) throw new HttpError(413, 'body_too_large', 'Request body is too large');
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) throw new HttpError(413, 'body_too_large', 'Request body is too large');

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(
      400,
      'invalid_request',
      'Request body is invalid',
      parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return parsed.data;
}

const PAYMENT_ERROR_STATUS: Record<PaymentErrorCode, number> = {
  not_found: 404,
  expired: 409,
  already_decided: 409,
  idempotency_conflict: 409,
  whole_dollars_only: 422,
};

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.code, message: error.message, details: error.details }, error.status);
  }
  if (error instanceof AuthError) {
    return Response.json(
      { error: 'unauthorized', message: error.message },
      { status: 401, headers: { 'Cache-Control': 'no-store', 'WWW-Authenticate': 'Bearer' } },
    );
  }
  if (error instanceof PaymentError) {
    return json({ error: error.code, message: error.message }, PAYMENT_ERROR_STATUS[error.code]);
  }
  console.error('[api] unhandled error:', error instanceof Error ? error.message : error);
  return json({ error: 'internal_error', message: 'Something went wrong' }, 500);
}

/**
 * Wraps a route handler so every throw becomes a proper response.
 *
 * - `connection()` first: API routes only ever run for a real request, never
 *   while `next build` prerenders, so a build cannot query the database.
 * - `unstable_rethrow` before handling: Next signals things like "this route
 *   is dynamic" or `notFound()` by throwing, and those must reach Next rather
 *   than be turned into a 500 here.
 */
export function handle<C>(
  handler: (request: Request, context: C) => Promise<Response>,
): (request: Request, context: C) => Promise<Response> {
  return async (request, context) => {
    await connection();
    try {
      return await handler(request, context);
    } catch (error) {
      unstable_rethrow(error);
      return errorResponse(error);
    }
  };
}

/** A route's `[id]` param, checked to be a UUID before it reaches SQL. */
export function uuidParam(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(404, 'not_found', 'Not found');
  }
  return value.toLowerCase();
}
