import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: () => ({ query: mocks.query }) }));
// Outside a real request Next has no request scope to wait on.
vi.mock('next/server', async (actual) => ({ ...await actual<typeof import('next/server')>(), connection: async () => {} }));

import { GET } from './route';

const circleId = '11111111-1111-4111-8111-111111111111';
const token = `cwd_${'a'.repeat(43)}`;
const get = (auth?: string) =>
  GET(new Request('http://test/api/v1/device/family', { headers: auth ? { authorization: auth } : {} }), undefined);

beforeEach(() => vi.resetAllMocks());

describe('GET /api/v1/device/family', () => {
  it('returns only display names and roles for the paired circle', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: 'device-1', circle_id: circleId }] })
      .mockResolvedValueOnce({
        rows: [
          { display_name: 'Jordan', role: 'approver', auth0_sub: 'auth0|secret', email: 'j@example.com' },
          { display_name: 'Lee', role: 'viewer' },
        ],
      });
    const response = await get(`Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      family: [{ displayName: 'Jordan', role: 'approver' }, { displayName: 'Lee', role: 'viewer' }],
    });
    expect(mocks.query).toHaveBeenLastCalledWith(expect.stringContaining('circle_members'), [circleId]);
  });

  it('answers 401 unauthorized for a missing, malformed or revoked token', async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    for (const auth of [undefined, 'Bearer nope', `Bearer ${token}`]) {
      const response = await get(auth);
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'unauthorized' });
    }
    // Only the revoked token reached the database, and only the device check.
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
