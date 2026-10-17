import { requireFamilyUser } from '@/lib/auth/family';
import { revokeAllowance } from '@/lib/allowances';
import { db } from '@/lib/db';
import { handle, json, uuidParam } from '@/lib/http';
export const DELETE = handle(async (request, { params }: { params: Promise<{ id: string; allowanceId: string }> }) => {
  const user = await requireFamilyUser(request);
  const { id, allowanceId } = await params;
  await revokeAllowance(db(), user.sub, uuidParam(id), uuidParam(allowanceId));
  return json({ revoked: true });
});
