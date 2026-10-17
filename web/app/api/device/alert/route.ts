import { bearerToken } from '@/lib/auth/http-auth';
import { db } from '@/lib/db';
import { acceptHardwareEvent, hardwareEventBody } from '@/lib/hardware';
import { handle, HttpError, readBody } from '@/lib/http';
export const POST = handle(async request => {
  const token = bearerToken(request);
  const input = await readBody(request, hardwareEventBody);
  try {
    const result = await acceptHardwareEvent(db(), token, input);
    return Response.json(result, { status: result.duplicate ? 200 : 201,
      headers: { 'Cache-Control': 'no-store', 'X-CheckWith-Accepted': result.eventId } });
  } catch (error) {
    if (error instanceof HttpError && error.status === 429) {
      return Response.json({ error: error.code, message: error.message },
        { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
    }
    throw error;
  }
});
