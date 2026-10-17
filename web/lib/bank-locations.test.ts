import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ cacheLife: () => {} }));
vi.mock('@/lib/nessie/client', () => ({
  nessie: () => ({
    listAtms: async () => [{ id: 'atm-1', kind: 'atm', name: 'Nessie ATM', coordinates: null, address: null }],
    listBranches: async () => [],
  }),
}));

async function load(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) delete process.env.DEMO_BANK_LOCATIONS;
  else process.env.DEMO_BANK_LOCATIONS = value;
  return (await import('./bank-locations')).bankLocations();
}

afterEach(() => {
  delete process.env.DEMO_BANK_LOCATIONS;
});

describe('bankLocations', () => {
  it('returns only Nessie banks when no demo locations are set', async () => {
    for (const value of [undefined, '']) {
      expect((await load(value)).locations.map((l) => l.id)).toEqual(['atm-1']);
    }
  });

  it('adds configured demo branches in the directory shape', async () => {
    const { locations } = await load('[{"name":"Demo Bank","lat":29.6,"lng":-82.3}]');
    expect(locations[1]).toEqual({
      id: 'demo-1', kind: 'branch', name: 'Demo Bank', coordinates: { latitude: 29.6, longitude: -82.3 }, address: null,
    });
  });

  it('rejects bad config without echoing it', async () => {
    for (const value of ['not json', '[{"name":"x","lat":91,"lng":0}]', '[{"name":"x","lat":1}]']) {
      const error = await load(value).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).toContain('DEMO_BANK_LOCATIONS');
      expect(String(error)).not.toContain(value);
    }
  });
});
