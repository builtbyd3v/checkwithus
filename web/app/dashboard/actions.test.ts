import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), query: vi.fn(), requireMembership: vi.fn(),
  joinCircle: vi.fn(), rotateInviteCode: vi.fn(), createPairingCode: vi.fn(),
  approvalsUseCiba: vi.fn(), decidePayment: vi.fn(),
}));
vi.mock('@/lib/auth0/web', () => ({ auth0: { getSession: mocks.getSession } }));
vi.mock('@/lib/db', () => ({ db: () => ({ query: mocks.query }) }));
vi.mock('@/lib/family', () => mocks);
vi.mock('@/lib/permissions', async (actual) => ({
  ...await actual<typeof import('@/lib/permissions')>(), requirePermission: mocks.requireMembership,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services', () => ({
  approvalsUseCiba: mocks.approvalsUseCiba, payments: () => ({ decidePayment: mocks.decidePayment }), freeze: vi.fn(),
}));

import { addPayeeAction, decideAction, inviteAction, joinAction, pairingAction, saveSettingsAction } from './actions';
import { PaymentError } from '@/lib/payments';
import { POLICY_OFF_CENTS } from '@/lib/rules';

const circleId = '11111111-1111-4111-8111-111111111111';
const cases: { name: string; action: typeof joinAction; fields: Record<string, string> }[] = [
  { name: 'join', action: joinAction, fields: { inviteCode: 'ABCD-EFGH', displayName: 'Maria' } },
  { name: 'settings', action: saveSettingsAction, fields: { circleId, holdLimit: 'on', holdDollars: '300.00' } },
  { name: 'payee', action: addPayeeAction, fields: { circleId, name: 'City Power', kind: 'biller', category: 'utilities' } },
  { name: 'invite', action: inviteAction, fields: { circleId } },
  { name: 'pairing', action: pairingAction, fields: { circleId } },
  { name: 'decide', action: decideAction, fields: { paymentId: circleId, decision: 'deny' } },
];
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

beforeEach(() => vi.resetAllMocks());

describe('expired dashboard sessions', () => {
  it.each(cases)('$name redirects to sign in without writing anything', async ({ action, fields }) => {
    mocks.getSession.mockResolvedValue(null);
    // Use Next's real redirect exception: it must escape the action's error handler.
    await expect(action({ message: '' }, form(fields)))
      .rejects.toMatchObject({ digest: expect.stringContaining('/auth/login?returnTo=/dashboard') });
    for (const write of [mocks.query, mocks.joinCircle, mocks.rotateInviteCode, mocks.createPairingCode, mocks.decidePayment]) {
      expect(write).not.toHaveBeenCalled();
    }
  });
});

it.each([cases[1]!, cases[2]!])('$name still checks membership before writing', async ({ action, fields }) => {
  mocks.getSession.mockResolvedValue({ user: { sub: 'auth0|stranger' } });
  mocks.requireMembership.mockRejectedValue(new Error('Not found'));
  await expect(action({ message: '' }, form(fields)))
    .resolves.toEqual({ message: 'Not found' });
  expect(mocks.query).not.toHaveBeenCalled();
});

it('with CIBA on, the dashboard can deny but never approve', async () => {
  mocks.getSession.mockResolvedValue({ user: { sub: 'auth0|maria' } });
  mocks.approvalsUseCiba.mockReturnValue(true);
  await expect(decideAction({ message: '' }, form({ paymentId: circleId, decision: 'approve' })))
    .resolves.toEqual({ message: 'Approve from the Auth0 Guardian notification on your phone.' });
  expect(mocks.decidePayment).not.toHaveBeenCalled();

  mocks.decidePayment.mockResolvedValue({ status: 'denied' });
  await expect(decideAction({ message: '' }, form({ paymentId: circleId, decision: 'deny' })))
    .resolves.toEqual({ message: 'Denied. The payment will not go through.', decided: true });
  expect(mocks.decidePayment).toHaveBeenCalledWith({
    paymentId: circleId, member: { auth0Sub: 'auth0|maria' }, decision: 'deny', via: 'dashboard',
  });
});

describe('dashboard decisions', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ user: { sub: 'auth0|maria' } });
    mocks.approvalsUseCiba.mockReturnValue(false);
  });

  it('approves through the authenticated payment service in app mode', async () => {
    mocks.decidePayment.mockResolvedValue({ status: 'paid' });
    await expect(decideAction({ message: '' }, form({ paymentId: circleId, decision: 'approve' })))
      .resolves.toEqual({ message: 'Approved. The payment is on its way.', decided: true });
    expect(mocks.decidePayment).toHaveBeenCalledWith({
      paymentId: circleId, member: { auth0Sub: 'auth0|maria' }, decision: 'approve', via: 'dashboard',
    });
  });

  it('keeps a multi-approver payment waiting after the first approval', async () => {
    mocks.decidePayment.mockResolvedValue({ status: 'held' });
    await expect(decideAction({ message: '' }, form({ paymentId: circleId, decision: 'approve' })))
      .resolves.toEqual({ message: 'Your approval is in. It still needs another approver.' });
  });

  it('shows permission failures without claiming a decision succeeded', async () => {
    mocks.decidePayment.mockRejectedValue(new Error('approve:payments permission required'));
    await expect(decideAction({ message: '' }, form({ paymentId: circleId, decision: 'approve' })))
      .resolves.toEqual({ message: 'approve:payments permission required' });
  });

  it.each(['expired', 'already_decided'] as const)('refreshes a stale %s card', async (code) => {
    mocks.decidePayment.mockRejectedValue(new PaymentError(code, 'Payment is no longer waiting.'));
    await expect(decideAction({ message: '' }, form({ paymentId: circleId, decision: 'approve' })))
      .resolves.toEqual({ message: 'Payment is no longer waiting.', decided: true });
  });

  it('rejects malformed decisions before calling the payment service', async () => {
    await expect(decideAction({ message: '' }, form({ paymentId: circleId, decision: 'send' })))
      .resolves.toEqual({ message: 'Payment not found.' });
    expect(mocks.decidePayment).not.toHaveBeenCalled();
  });
});

describe('rules settings', () => {
  const now = () => Math.floor(Date.now() / 1000);
  const save = (fields: Record<string, string>) => saveSettingsAction({ message: '' }, form({ circleId, ...fields }));
  const updates = () => mocks.query.mock.calls.filter(([sql]) => String(sql).startsWith('update'));
  beforeEach(() => {
    mocks.requireMembership.mockResolvedValue('member-1');
    mocks.query.mockImplementation(async (sql: string) => String(sql).startsWith('select')
      ? { rows: [{ hold_over_cents: 30_000, two_approvals_over_cents: 100_000 }] }
      : { rows: [], rowCount: 1 });
  });
  const signedIn = (authTime?: number) => mocks.getSession.mockResolvedValue({ user: { sub: 'auth0|maria', auth_time: authTime } });

  it.each(['1000000', '1000000.00', '-1', '1.234', 'abc', '', '99999999999999999999'])('refuses hold amount %j', async (holdDollars) => {
    signedIn(now());
    await expect(save({ holdLimit: 'on', holdDollars, twoApprovals: 'on', twoDollars: '1000' }))
      .resolves.toMatchObject({ message: expect.stringContaining('$0 to $999,999.99') });
    expect(updates()).toHaveLength(0);
  });

  it('refuses a bad two-approver amount', async () => {
    signedIn(now());
    await expect(save({ holdLimit: 'on', holdDollars: '300', twoApprovals: 'on', twoDollars: '1000000' }))
      .resolves.toMatchObject({ message: expect.stringContaining('$0 to $999,999.99') });
    expect(updates()).toHaveLength(0);
  });

  it('accepts the edges, $0 and $999,999.99, with a fresh sign-in', async () => {
    signedIn(now());
    await expect(save({ holdLimit: 'on', holdDollars: '0', twoApprovals: 'on', twoDollars: '999,999.99' }))
      .resolves.toEqual({ message: 'Rules saved. Changes apply to new payments.' });
    expect(updates()[0]![1]).toEqual([circleId, 0, 99_999_999]);
  });

  it('allows a stricter change without a fresh sign-in', async () => {
    signedIn(undefined);
    await expect(save({ holdLimit: 'on', holdDollars: '200', twoApprovals: 'on', twoDollars: '800' }))
      .resolves.toEqual({ message: 'Rules saved. Changes apply to new payments.' });
    expect(updates()[0]![1]).toEqual([circleId, 20_000, 80_000]);
  });

  it.each([
    ['a higher hold limit', { holdLimit: 'on', holdDollars: '400', twoApprovals: 'on', twoDollars: '1000' }],
    ['hold limit off', { holdLimit: 'off', twoApprovals: 'on', twoDollars: '1000' }],
    ['a higher two-approver amount', { holdLimit: 'on', holdDollars: '300', twoApprovals: 'on', twoDollars: '1500' }],
    ['two approvers off', { holdLimit: 'on', holdDollars: '300', twoApprovals: 'off' }],
  ])('refuses %s without a fresh sign-in', async (_name, fields) => {
    signedIn(now() - 600);
    await expect(save(fields)).resolves.toEqual({
      message: 'To loosen a rule, sign in again. Then save within 5 minutes.',
      signInUrl: `/auth/login?returnTo=${encodeURIComponent(`/dashboard?circle=${circleId}`)}&max_age=0`,
    });
    expect(updates()).toHaveLength(0);
  });

  it('turns both rules off after a fresh sign-in', async () => {
    signedIn(now() - 30);
    await expect(save({ holdLimit: 'off', twoApprovals: 'off' }))
      .resolves.toEqual({ message: 'Rules saved. Changes apply to new payments.' });
    expect(updates()[0]![1]).toEqual([circleId, POLICY_OFF_CENTS, POLICY_OFF_CENTS]);
  });

  it('keeps the two-approver amount when the form does not send it', async () => {
    signedIn(undefined);
    await expect(save({ holdLimit: 'on', holdDollars: '250' }))
      .resolves.toEqual({ message: 'Rules saved. Changes apply to new payments.' });
    expect(updates()[0]![1]).toEqual([circleId, 25_000, 100_000]);
  });

  it('a viewer cannot change rules', async () => {
    signedIn(now());
    mocks.requireMembership.mockRejectedValue(new Error('approve:payments permission required'));
    await expect(save({ holdLimit: 'on', holdDollars: '200' }))
      .resolves.toEqual({ message: 'approve:payments permission required' });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
