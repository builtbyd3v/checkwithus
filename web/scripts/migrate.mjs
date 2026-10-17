/**
 * Applies db/migrations/*.sql in name order, once each.
 *   npm run db:migrate
 *
 * - Uses DIRECT_DATABASE_URL only. Through the transaction pooler a session
 *   advisory lock would not hold, and schema changes should not be pooled.
 * - Takes an advisory lock, so two people migrating at once cannot interleave.
 * - Each file runs in its own transaction and is recorded with its SHA-256.
 *   Editing a file after it has been applied is an error: write a new
 *   migration instead, or two databases quietly end up different.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = fileURLToPath(new URL('../db/migrations/', import.meta.url));
const url = process.env.DIRECT_DATABASE_URL;
if (!url) {
  console.error('DIRECT_DATABASE_URL is not set. Migrations never run through the pooler.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

let failed = false;
try {
  await client.query("select pg_advisory_lock(hashtext('checkwith.migrations'))");
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      sha256 text not null,
      applied_at timestamptz not null default now()
    )`);

  const applied = new Map(
    (await client.query('select name, sha256 from schema_migrations')).rows.map((r) => [
      r.name,
      r.sha256,
    ]),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  let ran = 0;
  for (const name of files) {
    const sql = await readFile(join(dir, name), 'utf8');
    const sha256 = createHash('sha256').update(sql).digest('hex');

    if (applied.has(name)) {
      if (applied.get(name) !== sha256) {
        throw new Error(
          `${name} was changed after it was applied. Revert it and add a new migration instead.`,
        );
      }
      continue;
    }

    process.stdout.write(`applying ${name} ... `);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations (name, sha256) values ($1, $2)', [
        name,
        sha256,
      ]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      console.log('failed');
      throw new Error(`${name}: ${error.message}`);
    }
    console.log('ok');
    ran++;
  }
  console.log(ran === 0 ? 'Up to date.' : `Applied ${ran} migration(s).`);
} catch (error) {
  console.error(error.message);
  failed = true;
} finally {
  await client.query("select pg_advisory_unlock(hashtext('checkwith.migrations'))").catch(() => {});
  await client.end();
}
process.exit(failed ? 1 : 0);
