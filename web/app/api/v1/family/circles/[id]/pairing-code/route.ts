// POST /api/v1/family/circles/:id/pairing-code: a one-time code (10 minutes)
// to pair the older adult's phone. Shown once; the server keeps only its hash.
import { requireFamilyUser } from '@/lib/auth/family';
import { db } from '@/lib/db';
import { createPairingCode } from '@/lib/family';
import { handle, json, uuidParam } from '@/lib/http';

export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFamilyUser(request);
  const circleId = uuidParam((await params).id);
  return json(await createPairingCode(db(), user.sub, circleId), 201);
});
