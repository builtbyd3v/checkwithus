'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth0 } from '@/lib/auth0/web';
import { CATEGORIES, PAYEE_KINDS } from '@/lib/categories';
import { db } from '@/lib/db';
import { createPairingCode, joinCircle, rotateInviteCode, unpairDevices } from '@/lib/family';
import { formatCents, parseDollars, type Cents } from '@/lib/money';
import { normalizeName } from '@/lib/names';
import { requireFreshLogin, requirePermission } from '@/lib/permissions';
import { PaymentError } from '@/lib/payments';
import { POLICY_OFF_CENTS } from '@/lib/rules';
import { approvalsUseCiba, freeze, payments } from '@/lib/services';

export type FormState = { message: string; code?: string; expiresAt?: string; decided?: boolean; signInUrl?: string };
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

const BAD_AMOUNT = 'Enter an amount from $0 to $999,999.99, in dollars and cents.';
/** Dollars from the form to whole cents, or null. Off is `POLICY_OFF_CENTS`, so an amount must stay under it. */
function limitCents(state: 'on' | 'off', dollars: string | undefined): Cents | null {
  if (state === 'off') return POLICY_OFF_CENTS;
  try {
    const cents = parseDollars(dollars ?? '');
    return cents < POLICY_OFF_CENTS ? cents : null;
  } catch { return null; }
}

/** Hold limit and two-approver rule. Loosening either needs a sign-in from the last 5 minutes. */
export async function saveSettingsAction(_state: FormState, form: FormData): Promise<FormState> {
  const text = z.string().max(20).optional();
  const parsed = z.object({
    circleId: z.uuid(), holdLimit: z.enum(['on', 'off']), holdDollars: text,
    twoApprovals: z.enum(['on', 'off']).optional(), twoDollars: text,
  }).safeParse({
    circleId: value(form, 'circleId'), holdLimit: value(form, 'holdLimit'), holdDollars: value(form, 'holdDollars') ?? undefined,
    twoApprovals: value(form, 'twoApprovals') ?? undefined, twoDollars: value(form, 'twoDollars') ?? undefined,
  });
  if (!parsed.success) return { message: BAD_AMOUNT };
  const { circleId, holdLimit, holdDollars, twoApprovals, twoDollars } = parsed.data;
  const hold = limitCents(holdLimit, holdDollars);
  const two = twoApprovals ? limitCents(twoApprovals, twoDollars) : undefined;
  if (hold === null || two === null) return { message: BAD_AMOUNT };
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect('/auth/login?returnTo=/dashboard');
  try {
    await requirePermission(db(), session.user.sub, circleId, 'approve:payments');
    const { rows } = await db().query<{ hold_over_cents: number; two_approvals_over_cents: number }>(
      'select hold_over_cents, two_approvals_over_cents from circles where id = $1', [circleId],
    );
    if (!rows[0]) return { message: 'Circle not found.' };
    const nextTwo = two ?? rows[0].two_approvals_over_cents;
    // A higher amount or a rule turned off lets more money out without the family.
    if (hold > rows[0].hold_over_cents || nextTwo > rows[0].two_approvals_over_cents) {
      try { requireFreshLogin(session.user.auth_time); } catch {
        return { message: 'To loosen a rule, sign in again. Then save within 5 minutes.', signInUrl: `/auth/login?returnTo=${encodeURIComponent(`/dashboard?circle=${circleId}`)}&max_age=0` };
      }
    }
    // ponytail: read then write, no row lock. A racing save can only write values it already checked.
    await db().query('update circles set hold_over_cents = $2, two_approvals_over_cents = $3 where id = $1', [circleId, hold, nextTwo]);
    revalidatePath('/dashboard');
    return { message: 'Rules saved. Changes apply to new payments.' };
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

/** Releases the older adult's phone. Same rules as the family app's unpair route. */
export async function unpairAction(_state: FormState, form: FormData): Promise<FormState> {
  const circleId = z.uuid().safeParse(value(form, 'circleId'));
  if (!circleId.success) return { message: 'Circle not found.' };
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect('/auth/login?returnTo=/dashboard');
  try {
    const { unpaired } = await unpairDevices(db(), session.user.sub, session.user.auth_time, circleId.data);
    return { message: unpaired ? 'Their phone is unpaired. It goes back to the first screen.' : 'No phone was paired.' };
  } catch (error) { return fail(error); }
}

/** Approve or deny a held payment. Same rules as the family app's decision route. */
export async function decideAction(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ paymentId: z.uuid(), decision: z.enum(['approve', 'deny']) })
    .safeParse({ paymentId: value(form, 'paymentId'), decision: value(form, 'decision') });
  if (!parsed.success) return { message: 'Payment not found.' };
  const sub = await actor();
  // With CIBA, only the Guardian push (enrolled phone + Face ID) can approve.
  // A dashboard session alone must not move money. Denying only stops money.
  if (parsed.data.decision === 'approve' && approvalsUseCiba()) {
    return { message: 'Approve from the Auth0 Guardian notification on your phone.' };
  }
  try {
    const payment = await payments().decidePayment({
      paymentId: parsed.data.paymentId, member: { auth0Sub: sub }, decision: parsed.data.decision, via: 'dashboard',
    });
    revalidatePath('/dashboard');
    if (payment.status === 'held') return { message: 'Your approval is in. It still needs another approver.' };
    if (payment.status === 'denied') return { message: 'Denied. The payment will not go through.', decided: true };
    if (payment.status === 'failed') return { message: 'Approved, but the bank could not send it.', decided: true };
    return { message: 'Approved. The payment is on its way.', decided: true };
  } catch (error) {
    if (error instanceof PaymentError && (error.code === 'expired' || error.code === 'already_decided')) {
      revalidatePath('/dashboard');
      return { ...fail(error), decided: true };
    }
    return fail(error);
  }
}

export async function freezeAction(_state: FormState, form: FormData): Promise<FormState> {
  const circleId = z.uuid().safeParse(value(form, 'circleId'));
  if (!circleId.success) return { message: 'Circle not found.' };
  const sub = await actor();
  try {
    const { movedCents } = await freeze().freeze(sub, circleId.data);
    revalidatePath('/dashboard');
    return { message: `Spending is frozen. ${formatCents(movedCents)} moved to the vault.` };
  } catch (error) { return fail(error); }
}

export async function unfreezeAction(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ circleId: z.uuid(), dollars: z.string().trim().regex(/^\d+$/) })
    .safeParse({ circleId: value(form, 'circleId'), dollars: value(form, 'dollars') });
  if (!parsed.success) return { message: 'Enter a whole dollar amount.' };
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect('/auth/login?returnTo=/dashboard');
  try {
    const { movedCents } = await freeze().unfreeze(
      session.user.sub, session.user.auth_time, parsed.data.circleId, parseDollars(parsed.data.dollars),
    );
    revalidatePath('/dashboard');
    return { message: `Spending is back on. ${formatCents(movedCents)} moved back from the vault.` };
  } catch (error) { return fail(error); }
}
