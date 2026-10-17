import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), registerHardware: vi.fn(), changeHardwareCredential: vi.fn(), resolveHardwareRequest: vi.fn(), saveAssistanceContact: vi.fn() }));
vi.mock('@/lib/auth0/web', () => ({ auth0: { getSession: mocks.getSession } }));
vi.mock('@/lib/db', () => ({ db: () => ({}) }));
vi.mock('@/lib/hardware', async original => ({ ...await original<typeof import('@/lib/hardware')>(), ...mocks }));
import { hardwareAction } from './hardware-actions';
const circleId = '11111111-1111-4111-8111-111111111111';
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
beforeEach(() => vi.resetAllMocks());

it('redirects an expired session before registering a device', async () => {
  mocks.getSession.mockResolvedValue(null);
  await expect(hardwareAction({ message: '' }, form({ action: 'register', circleId, name: 'Kitchen' })))
    .rejects.toMatchObject({ digest: expect.stringContaining('/auth/login?returnTo=/dashboard') });
  expect(mocks.registerHardware).not.toHaveBeenCalled();
});

it('rejects invalid device identifiers before calling a mutation', async () => {
  mocks.getSession.mockResolvedValue({ user: { sub: 'auth0|family' } });
  const result = await hardwareAction({ message: '' }, form({ action: 'revoke', circleId, deviceId: 'not-a-uuid' }));
  expect(result.message).toContain('Check');
  expect(mocks.changeHardwareCredential).not.toHaveBeenCalled();
});

it('uses the session identity and does not expose internal errors or previous credentials', async () => {
  mocks.getSession.mockResolvedValue({ user: { sub: 'auth0|family' } });
  mocks.registerHardware.mockRejectedValue(new Error('private database details'));
  const result = await hardwareAction({ message: '', token: 'previous-secret' }, form({ action: 'register', circleId, name: 'Kitchen', sub: 'auth0|intruder' }));
  expect(mocks.registerHardware).toHaveBeenCalledWith({}, 'auth0|family', circleId, 'Kitchen');
  expect(result).toEqual({ message: 'Could not save this change. Please try again.' });
});
