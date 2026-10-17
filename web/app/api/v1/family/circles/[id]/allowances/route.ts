import { requireFamilyUser } from '@/lib/auth/family';
import { allowanceBody, grantAllowance, listAllowances } from '@/lib/allowances';
import { db } from '@/lib/db';
import { handle, json, readBody, uuidParam } from '@/lib/http';
type Context = { params: Promise<{ id: string }> };
export const GET = handle(async (request, { params }: Context) => {
  const user = await requireFamilyUser(request);
  return json({ allowances: await listAllowances(db(), user.sub, uuidParam((await params).id)) });
});
export const POST = handle(async (request, { params }: Context) => {
  const user = await requireFamilyUser(request);
  return json(await grantAllowance(db(), user.sub, user.authTime, uuidParam((await params).id), await readBody(request, allowanceBody)), 201);
});
