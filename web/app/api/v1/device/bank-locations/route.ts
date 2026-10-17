// The phone matches its location locally for the bank-while-on-a-call alert.
import { requireDevice } from '@/lib/auth/device';
import { bankLocations } from '@/lib/bank-locations';
import { db } from '@/lib/db';
import { handle, json } from '@/lib/http';

export const GET = handle(async (request) => {
  await requireDevice(db(), request);
  return json(await bankLocations());
});
