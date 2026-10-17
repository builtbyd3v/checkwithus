'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth0 } from '@/lib/auth0/web';
import { CATEGORIES, PAYEE_KINDS } from '@/lib/categories';
import { db } from '@/lib/db';
import { createPairingCode, joinCircle, rotateInviteCode } from '@/lib/family';
import { parseDollars } from '@/lib/money';
import { normalizeName } from '@/lib/names';
import { requirePermission } from '@/lib/permissions';
import { allowanceBody, grantAllowance, revokeAllowance } from '@/lib/allowances';

export type FormState = { message: string; code?: string; expiresAt?: string };
const fail = (error: unknown): FormState => ({
  message: error instanceof Error ? error.message : 'Please try again.',
});
const value = (data: FormData, key: string) => data.get(key);

async function actor() {
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect('/auth/login?returnTo=/dashboard');
  return session.user.sub;
}

export async function joinAction(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({
    inviteCode: z.string().min(4).max(20),
    displayName: z.string().trim().min(1).max(80),
  }).safeParse({ inviteCode: value(form, 'inviteCode'), displayName: value(form, 'displayName') });
  if (!parsed.success) return { message: 'Enter your name and a valid invite code.' };
  const sub = await actor();
  try {
    await joinCircle(db(), sub, parsed.data);
  } catch (error) {
    return fail(error);
  }
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function saveSettingsAction(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ circleId: z.uuid(), holdDollars: z.string().trim().regex(/^\d+(\.\d{1,2})?$/) })
    .safeParse({ circleId: value(form, 'circleId'), holdDollars: value(form, 'holdDollars') });
  if (!parsed.success) return { message: 'Enter a valid dollar amount.' };
  const sub = await actor();
  try {
    await requirePermission(db(), sub, parsed.data.circleId, 'approve:payments');
    const cents = parseDollars(parsed.data.holdDollars);
    await db().query('update circles set hold_over_cents = $2 where id = $1', [parsed.data.circleId, cents]);
    revalidatePath('/dashboard');
    return { message: 'Hold limit saved.' };
  } catch (error) { return fail(error); }
}

export async function addPayeeAction(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({
    circleId: z.uuid(), name: z.string().trim().min(1).max(80),
    kind: z.enum(PAYEE_KINDS), category: z.enum(CATEGORIES),
  }).safeParse({
    circleId: value(form, 'circleId'), name: value(form, 'name'),
    kind: value(form, 'kind'), category: value(form, 'category'),
  });
  if (!parsed.success) return { message: 'Check the payee name, type, and category.' };
  const sub = await actor();
  try {
    await requirePermission(db(), sub, parsed.data.circleId, 'approve:payments');
    await db().query(
      `insert into payees (circle_id, name, normalized_name, kind, category)
       values ($1, $2, $3, $4, $5) on conflict (circle_id, kind, normalized_name) do nothing`,
      [parsed.data.circleId, parsed.data.name, normalizeName(parsed.data.name), parsed.data.kind, parsed.data.category],
    );
    revalidatePath('/dashboard');
    return { message: 'Known payee saved.' };
  } catch (error) { return fail(error); }
}

export async function inviteAction(_state: FormState, form: FormData): Promise<FormState> {
  const circleId = z.uuid().safeParse(value(form, 'circleId'));
  if (!circleId.success) return { message: 'Circle not found.' };
  const sub = await actor();
  try {
    const invite = await rotateInviteCode(db(), sub, circleId.data);
    return { message: 'Share this invite with a family member.', ...invite };
  } catch (error) { return fail(error); }
}

export async function pairingAction(_state: FormState, form: FormData): Promise<FormState> {
  const circleId = z.uuid().safeParse(value(form, 'circleId'));
  if (!circleId.success) return { message: 'Circle not found.' };
  const sub = await actor();
  try {
    const pairing = await createPairingCode(db(), sub, circleId.data);
    return { message: 'Enter this code on the older adult’s phone.', ...pairing };
  } catch (error) { return fail(error); }
}

export async function grantAllowanceAction(_state: FormState, form: FormData): Promise<FormState> {
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect('/auth/login?returnTo=/dashboard');
  const circle = z.uuid().safeParse(value(form, 'circleId'));
  const input = allowanceBody.safeParse({
    payeeId: value(form, 'payeeId') || null, category: value(form, 'category') || null,
    maxAmountCents: Number(value(form, 'maxAmountCents')), expiresAt: value(form, 'expiresAt'),
  });
  if (!circle.success || !input.success) return { message: 'Check the allowance scope, amount, and expiry.' };
  try {
    await grantAllowance(db(), session.user.sub, session.user.auth_time, circle.data, input.data);
    revalidatePath('/dashboard');
    return { message: 'Allowance granted.' };
  } catch (error) { return fail(error); }
}

export async function revokeAllowanceAction(_state: FormState, form: FormData): Promise<FormState> {
  const sub = await actor();
  const input = z.object({ circleId: z.uuid(), allowanceId: z.uuid() }).safeParse({ circleId: value(form, 'circleId'), allowanceId: value(form, 'allowanceId') });
  if (!input.success) return { message: 'Allowance not found.' };
  try {
    await revokeAllowance(db(), sub, input.data.circleId, input.data.allowanceId);
    revalidatePath('/dashboard');
    return { message: 'Allowance revoked.' };
  } catch (error) { return fail(error); }
}
