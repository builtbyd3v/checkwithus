// GET /api/health: is the deployment up and can it reach the database.
// Says only that; no versions, hosts or error text.
import { connection } from 'next/server';
import { db } from '@/lib/db';
import { json } from '@/lib/http';

export async function GET() {
  // Request time only: never let `next build` prerender this and query the database.
  await connection();
  try {
    await db().query('select 1');
    return json({ ok: true, database: 'reachable' });
  } catch (error) {
    console.error('[health] database check failed:', error instanceof Error ? error.message : error);
    return json({ ok: false, database: 'unreachable' }, 503);
  }
}
