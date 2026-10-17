import { auth0 } from '@/lib/auth0/web';
import { db } from '@/lib/db';
import { hardwareDashboard } from '@/lib/hardware';
import { handle, HttpError, json, uuidParam } from '@/lib/http';
export const GET = handle(async request => {
  const session = await auth0.getSession();
  if (!session?.user.sub) throw new HttpError(401, 'unauthorized', 'Sign in to see your family');
  const circleId = uuidParam(new URL(request.url).searchParams.get('circleId') ?? '');
  return json(await hardwareDashboard(db(), session.user.sub, circleId));
});
