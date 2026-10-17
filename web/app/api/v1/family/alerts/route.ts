// GET /api/v1/family/alerts: recent "bank during a call" and "Ask my family" alerts.
import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { familyAlerts } from '@/lib/family';
import { handle, json } from '@/lib/http';

export const GET = handle(async (request) => {
  const user = await requireFamilyUser(request);
  return json({ alerts: await familyAlerts(db(), user.sub) });
});
