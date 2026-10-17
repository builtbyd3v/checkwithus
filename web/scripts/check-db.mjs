/**
 * Verifies both Tiger Data connection strings without printing any secrets.
 *   npm run check:db
 *
 * Checks, for each of DATABASE_URL (pooled) and DIRECT_DATABASE_URL (direct):
 *   - it parses, points somewhere reachable, and authenticates
 *   - sslmode=require is actually set
 *   - the timescaledb extension is present (no extension => no hypertables,
 *     no continuous aggregates, no Tiger Data track)
 * and confirms the two are not the same endpoint.
 */
import pg from 'pg';

/** Host:port only -- never the user, never the password. */
function endpoint(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}`;
  } catch {
    return '<unparseable>';
  }
}

async function check(label, url) {
  if (!url) {
    console.log(`✗ ${label}  not set in .env.local`);
    return null;
  }

  if (url.startsWith('psql ')) {
    console.log(`✗ ${label}  looks like a psql command, not a URL.`);
    console.log(`    Strip the leading 'psql "' and the trailing '"'.`);
    return null;
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    console.log(`✗ ${label}  does not start with postgres://`);
    return null;
  }
  if (!/sslmode=require/.test(url)) {
    console.log(`✗ ${label}  missing ?sslmode=require  (${endpoint(url)})`);
    return null;
  }

  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15_000 });
  try {
    await client.connect();
    const { rows } = await client.query(
      "select current_database() as db, extversion from pg_extension where extname = 'timescaledb'",
    );
    const version = rows[0]?.extversion;
    console.log(`✓ ${label}  connected  ${endpoint(url)}  db=${rows[0]?.db ?? '?'}`);
    if (version) {
      console.log(`    timescaledb ${version}`);
    } else {
      console.log(`    ⚠ timescaledb extension NOT present -- was this created as plain PostgreSQL?`);
    }
    return endpoint(url);
  } catch (err) {
    console.log(`✗ ${label}  ${err.message}  (${endpoint(url)})`);
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

const pooled = await check('DATABASE_URL        (pooled)', process.env.DATABASE_URL);
const direct = await check('DIRECT_DATABASE_URL (direct)', process.env.DIRECT_DATABASE_URL);

if (pooled && direct && pooled === direct) {
  console.log(
    `\n⚠ Both point at ${pooled}. One should be the pooler and one direct --` +
      ` looks like the same string got pasted twice.`,
  );
}

process.exit(pooled && direct ? 0 : 1);
