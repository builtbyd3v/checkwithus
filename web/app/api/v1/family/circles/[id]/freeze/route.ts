import { z } from 'zod';
import { requireFamilyUser } from '@/lib/auth/family';
import { handle, json, readBody, uuidParam } from '@/lib/http';
import { freeze } from '@/lib/services';
export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFamilyUser(request);
  const id = uuidParam((await params).id);
  await readBody(request, z.strictObject({}));
  return json(await freeze().freeze(user.sub, id));
});
