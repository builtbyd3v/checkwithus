// POST /api/v1/device/pair: the older adult's phone trades the code a family
// member showed it for a device token. The token is returned once, here, and
// never again; the server keeps only its hash.
import { pairBody } from '@/lib/api-schemas';
import { pairDevice } from '@/lib/auth/device';
import { db } from '@/lib/db';
import { handle, HttpError, json, readBody } from '@/lib/http';

export const POST = handle(async (request) => {
  const body = await readBody(request, pairBody);
  const paired = await pairDevice(db(), body);
  if (!paired) {
    // One answer for wrong, used and expired codes: no hints for guessing.
    throw new HttpError(400, 'invalid_code', 'That code is not valid. Ask your family for a new one.');
  }
  return json({ deviceToken: paired.token, circleId: paired.device.circleId }, 201);
});
