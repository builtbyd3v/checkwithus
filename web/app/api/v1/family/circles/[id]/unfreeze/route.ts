import { z } from 'zod';
import { requireFamilyUser } from '@/lib/auth/family';
import { handle, json, readBody, uuidParam } from '@/lib/http';
import { toCents } from '@/lib/money';
import { freeze } from '@/lib/services';
const body = z.strictObject({ amountCents: z.number().int().min(0).max(100_000_000) });
export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFamilyUser(request);
  const id = uuidParam((await params).id);
  const { amountCents } = await readBody(request, body);
  return json(await freeze().unfreeze(user.sub, id, toCents(amountCents)));
});
