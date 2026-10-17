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

let warned = false;

/** The configured demo branches. A malformed value warns once and is ignored, so Nessie's banks still return. */
function demoLocations() {
  try {
    return demoEnv().DEMO_BANK_LOCATIONS;
  } catch (error) {
    if (!warned) console.warn(error instanceof Error ? error.message : 'Invalid DEMO_BANK_LOCATIONS; ignored');
    warned = true;
    return [];
  }
}

/** Nessie's banks plus the configured demo branches (DEMO_BANK_LOCATIONS), in the same shape. */
export async function bankLocations() {
  const demo = demoLocations().map(({ name, lat, lng }, i) => ({
    id: `demo-${i + 1}`, kind: 'branch' as const, name,
    coordinates: { latitude: lat, longitude: lng }, address: null,
  }));
  return { locations: [...(await nessieBankLocations()), ...demo] };
}
