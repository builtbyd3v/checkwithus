// GET /api/v1/device/family: who is in the family and what each person can do, for the phone's Settings.
// Display names and roles only: no emails, no sign-in ids.
import { requireDevice } from '@/lib/auth/device';
import { db } from '@/lib/db';
import { handle, json } from '@/lib/http';

export const GET = handle(async (request) => {
  const device = await requireDevice(db(), request);
  const { rows } = await db().query<{ display_name: string; role: 'approver' | 'viewer' }>(
    `select display_name, role from circle_members where circle_id = $1 order by created_at`,
    [device.circleId],
  );
  return json({ family: rows.map((r) => ({ displayName: r.display_name, role: r.role })) });
});
