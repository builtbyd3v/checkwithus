import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), query: vi.fn(), requireMembership: vi.fn(),
  joinCircle: vi.fn(), rotateInviteCode: vi.fn(), createPairingCode: vi.fn(),
}));
vi.mock('@/lib/auth0/web', () => ({ auth0: { getSession: mocks.getSession } }));
vi.mock('@/lib/db', () => ({ db: () => ({ query: mocks.query }) }));
vi.mock('@/lib/family', () => mocks);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { addPayeeAction, inviteAction, joinAction, pairingAction, saveSettingsAction } from './actions';

const circleId = '11111111-1111-4111-8111-111111111111';
const cases: { name: string; action: typeof joinAction; fields: Record<string, string> }[] = [
  { name: 'join', action: joinAction, fields: { inviteCode: 'ABCD-EFGH', displayName: 'Maria' } },
  { name: 'settings', action: saveSettingsAction, fields: { circleId, holdDollars: '300.00' } },
  { name: 'payee', action: addPayeeAction, fields: { circleId, name: 'City Power', kind: 'biller', category: 'utilities' } },
  { name: 'invite', action: inviteAction, fields: { circleId } },
  { name: 'pairing', action: pairingAction, fields: { circleId } },
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
    for (const write of [mocks.query, mocks.joinCircle, mocks.rotateInviteCode, mocks.createPairingCode]) {
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
