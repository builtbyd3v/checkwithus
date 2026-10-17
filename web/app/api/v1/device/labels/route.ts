// GET /api/v1/device/labels?cursor=<nextCursor>: family decisions as training
// labels for the Guard, which retrains on the phone. Ids and labels only.
import { requireDevice } from '@/lib/auth/device';
import { db } from '@/lib/db';
import { learningLabels } from '@/lib/device-data';
import { handle, HttpError, json } from '@/lib/http';
import { z } from 'zod';

const cursorSchema = z.strictObject({
  decidedAt: z.iso.datetime({ precision: 6 }),
  paymentId: z.uuid(),
});

export const GET = handle(async (request) => {
  const device = await requireDevice(db(), request);
  const query = new URL(request.url).searchParams;
  const afterParam = query.get('after');
  const cursorParam = query.get('cursor');
  let cursor: z.infer<typeof cursorSchema> | null = null;
  if (cursorParam !== null) {
    if (afterParam !== null || !/^[A-Za-z0-9_-]{1,512}$/.test(cursorParam)) {
      throw new HttpError(400, 'invalid_request', 'Use a valid cursor without `after`');
    }
    try {
      cursor = cursorSchema.parse(JSON.parse(Buffer.from(cursorParam, 'base64url').toString('utf8')));
    } catch {
      throw new HttpError(400, 'invalid_request', 'Invalid label cursor');
    }
  }
  const after = afterParam ? new Date(afterParam) : null;
  if (after && Number.isNaN(after.getTime())) {
    throw new HttpError(400, 'invalid_request', '`after` must be an ISO 8601 time');
  }
  return json(await learningLabels(db(), device.circleId, after, cursor));
});
