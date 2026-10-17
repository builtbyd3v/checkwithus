import 'server-only';
import { cacheLife } from 'next/cache';
import { demoEnv } from '@/lib/env';
import { nessie } from '@/lib/nessie/client';

/** Public bank directory, shared across devices; never cache device credentials. */
async function nessieBankLocations() {
  'use cache';
  cacheLife('hours');
  const [atms, branches] = await Promise.all([nessie().listAtms(), nessie().listBranches()]);
  return [...atms, ...branches];
}

/** Nessie's banks plus the configured demo branches (DEMO_BANK_LOCATIONS), in the same shape. */
export async function bankLocations() {
  const demo = demoEnv().DEMO_BANK_LOCATIONS.map(({ name, lat, lng }, i) => ({
    id: `demo-${i + 1}`, kind: 'branch' as const, name,
    coordinates: { latitude: lat, longitude: lng }, address: null,
  }));
  return { locations: [...(await nessieBankLocations()), ...demo] };
}
