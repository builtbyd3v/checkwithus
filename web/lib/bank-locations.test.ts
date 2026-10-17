import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ cacheLife: () => {} }));
vi.mock('@/lib/nessie/client', () => ({
  nessie: () => ({
    listAtms: async () => [{ id: 'atm-1', kind: 'atm', name: 'Nessie ATM', coordinates: null, address: null }],
    listBranches: async () => [],
  }),
}));

async function fresh(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) delete process.env.DEMO_BANK_LOCATIONS;
  else process.env.DEMO_BANK_LOCATIONS = value;
  return import('./bank-locations');
}
const load = async (value: string | undefined) => (await fresh(value)).bankLocations();

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

  it('ignores bad config with one warning that does not echo it', async () => {
    for (const value of ['not json', '[{"name":"x","lat":91,"lng":0}]', '[{"name":"x","lat":1}]']) {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { bankLocations } = await fresh(value);
      for (let i = 0; i < 2; i++) expect((await bankLocations()).locations.map((l) => l.id)).toEqual(['atm-1']);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0])).toContain('DEMO_BANK_LOCATIONS');
      expect(String(warn.mock.calls[0]![0])).not.toContain(value);
      warn.mockRestore();
    }
  });
});
