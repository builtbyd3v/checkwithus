import 'server-only';
import { cacheLife } from 'next/cache';
import { nessie } from '@/lib/nessie/client';

/** Public bank directory, shared across devices; never cache device credentials. */
export async function bankLocations() {
  'use cache';
  cacheLife('hours');
  const [atms, branches] = await Promise.all([nessie().listAtms(), nessie().listBranches()]);
  return { locations: [...atms, ...branches] };
}
