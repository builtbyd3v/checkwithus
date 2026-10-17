import { bearerToken } from '@/lib/auth/http-auth';
import { db } from '@/lib/db';
import { hardwareHeartbeat, hardwareHeartbeatBody } from '@/lib/hardware';
import { handle, json, readBody } from '@/lib/http';
export const POST = handle(async request => {
  const token = bearerToken(request);
  const { deviceId } = await readBody(request, hardwareHeartbeatBody);
  return json(await hardwareHeartbeat(db(), token, deviceId));
});
