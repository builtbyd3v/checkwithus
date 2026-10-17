// POST /api/v1/device/alerts: "at the bank while on a call", or the big
// "Ask my family" button. The family app shows these.
import { alertBody } from '@/lib/api-schemas';
import { requireDevice } from '@/lib/auth/device';
import { db } from '@/lib/db';
import { addAlert } from '@/lib/device-data';
import { handle, json, readBody } from '@/lib/http';

export const POST = handle(async (request) => {
  const device = await requireDevice(db(), request);
  const body = await readBody(request, alertBody);
  return json(await addAlert(db(), device.circleId, body), 201);
});
