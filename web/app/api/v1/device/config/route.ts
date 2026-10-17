// GET /api/v1/device/config: who the family is and which app groups stay locked.
import { requireDevice } from '@/lib/auth/device';
import { db } from '@/lib/db';
import { deviceConfig } from '@/lib/device-data';
import { handle, json } from '@/lib/http';

export const GET = handle(async (request) => {
  const device = await requireDevice(db(), request);
  return json(await deviceConfig(db(), device.circleId));
});
