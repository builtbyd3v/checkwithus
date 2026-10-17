/**
 * Postgres (Tiger Cloud) access for the app.
 *
 * Connects through the transaction pooler (DATABASE_URL). That rules out
 * session state between statements: no LISTEN/NOTIFY, no session advisory
 * locks, no SET outside a transaction. Use `transaction()` for anything that
 * must see one connection.
 */
import 'server-only';
import pg from 'pg';
import { dbEnv } from '@/lib/env';

// int8 (bigint) arrives as a string by default, so `amount_cents` would be
// "50000" and comparisons against numbers would quietly go wrong. Every
// bigint here is a cent amount far below 2^53, but if one ever is not, fail
// loudly rather than round.
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error(`bigint ${value} is too large to handle exactly`);
  return n;
});

const globalForPool = globalThis as typeof globalThis & { checkwithPool?: pg.Pool };

/** The shared pool. Kept on globalThis so dev hot-reload does not leak pools. */
export function db(): pg.Pool {
  if (!globalForPool.checkwithPool) {
    globalForPool.checkwithPool = new pg.Pool({
      connectionString: dbEnv().DATABASE_URL,
      // Serverless instances each hold a pool; the pooler multiplexes them.
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForPool.checkwithPool;
}

export type Queryable = Pick<pg.Pool, 'query'> | Pick<pg.PoolClient, 'query'>;

/** Runs `work` in one transaction on one connection; rolls back if it throws. */
export async function transaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
