/**
 * Verifies both Tiger Data connection strings without printing any secrets.
 *   npm run check:db
 *
 * Checks, for each of DATABASE_URL (pooled) and DIRECT_DATABASE_URL (direct):
 *   - it parses, points somewhere reachable, and authenticates
 *   - sslmode is actually set to `require`
 *   - the timescaledb extension is present (no extension => no hypertables,
 *     no continuous aggregates, no Tiger Data track)
 * and confirms the two are not the same endpoint.
 *
 * Exits non-zero if any stated check fails, so it is usable in a pre-deploy
 * gate and not only as something a human squints at.
 */
import pg from 'pg';

/** Host:port only -- never the user, never the password. */
function endpoint(parsed) {
  return `${parsed.hostname}:${parsed.port || '5432'}`;
}

async function check(label, url) {
  const fail = (msg, where = '') => {
    console.log(`✗ ${label}  ${msg}${where && `  (${where})`}`);
    return null;
  };

  if (!url) return fail('not set in .env.local');

  if (url.startsWith('psql ')) {
    console.log(`✗ ${label}  looks like a psql command, not a URL.`);
    console.log(`    Strip the leading 'psql "' and the trailing '"'.`);
    return null;
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return fail('does not start with postgres://');
  }

  // Parse rather than regex the raw string: `?sslmode=disable&x=sslmode=require`
  // would satisfy a substring test while pg quietly connects without TLS.
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return fail(
      'is not a parseable URL. If the password contains @ : / # or ?, URL-encode it.',
    );
  }

  const sslmode = parsed.searchParams.get('sslmode');
  if (sslmode !== 'require') {
    return fail(
      sslmode === null
        ? 'has no sslmode parameter; add ?sslmode=require'
        : `has sslmode=${sslmode}, expected sslmode=require`,
      endpoint(parsed),
    );
  }

  const where = endpoint(parsed);
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15_000 });
  try {
    await client.connect();
    const { rows } = await client.query(
      "select current_database() as db, (select extversion from pg_extension where extname = 'timescaledb') as timescaledb",
    );
    const version = rows[0]?.timescaledb;

    // Connecting is not success on its own: without the extension there are no
    // hypertables and no continuous aggregates, so the service is unusable for
    // what we are building and this must exit non-zero.
    if (!version) {
      console.log(`✗ ${label}  connected (${where}) but timescaledb is NOT installed.`);
      console.log(`    Was this service created with "plain PostgreSQL"? Recreate it.`);
      return null;
    }

    console.log(`✓ ${label}  ${where}  db=${rows[0]?.db ?? '?'}  timescaledb ${version}`);
    return where;
  } catch (err) {
    return fail(err.message, where);
  } finally {
    await client.end().catch(() => {});
  }
}

const pooled = await check('DATABASE_URL        (pooled)', process.env.DATABASE_URL);
const direct = await check('DIRECT_DATABASE_URL (direct)', process.env.DIRECT_DATABASE_URL);

const sameEndpoint = pooled !== null && pooled === direct;
if (sameEndpoint) {
  console.log(
    `\n✗ Both point at ${pooled}. One must be the pooler and one direct --` +
      ` looks like the same string got pasted twice.`,
  );
}

process.exit(pooled && direct && !sameEndpoint ? 0 : 1);
