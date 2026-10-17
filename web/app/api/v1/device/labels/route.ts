// GET /api/v1/device/labels?after=<ISO time>: family decisions as training
// labels for the Guard, which retrains on the phone. Ids and labels only.
import { requireDevice } from '@/lib/auth/device';
import { db } from '@/lib/db';
import { learningLabels } from '@/lib/device-data';
import { handle, HttpError, json } from '@/lib/http';

export const GET = handle(async (request) => {
  const device = await requireDevice(db(), request);
  const afterParam = new URL(request.url).searchParams.get('after');
  const after = afterParam ? new Date(afterParam) : null;
  if (after && Number.isNaN(after.getTime())) {
    throw new HttpError(400, 'invalid_request', '`after` must be an ISO 8601 time');
  }
  return json({ labels: await learningLabels(db(), device.circleId, after) });
});
