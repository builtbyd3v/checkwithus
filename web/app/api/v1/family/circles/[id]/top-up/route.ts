import { z } from 'zod';
import { requireFamilyUser } from '@/lib/auth/family';
import { handle, json, readBody, uuidParam } from '@/lib/http';
import { toCents } from '@/lib/money';
import { topUp } from '@/lib/services';
const body = z.strictObject({
  amountCents: z.number().int().min(100).max(1_000_000),
  idempotencyKey: z.string().min(1).max(200),
});
export const POST = handle(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFamilyUser(request);
  const id = uuidParam((await params).id);
  const { amountCents, idempotencyKey } = await readBody(request, body);
  return json(await topUp().topUp(user.sub, user.authTime, id, { amountCents: toCents(amountCents), idempotencyKey }));
});
