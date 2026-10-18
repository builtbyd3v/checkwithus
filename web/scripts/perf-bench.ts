/**
 * Tiger Data performance story (#6). `npm run bench:perf`, only ever against a
 * throwaway schema: it seeds 1M synthetic payments, so it refuses to run
 * unless the connection's schema is named wt_*.
 *
 * Seeds `spending`, refreshes the continuous aggregates, then times each
 * dashboard or rules query against raw rows (row store), raw rows
 * (columnstore) and the continuous aggregate. Prints a Markdown table and
 * writes it to docs/perf.md.
 */
import { writePerfArtifacts } from './write-perf-report';
import { renderPerfReport, type PerfReport } from '../lib/perf-report';
import pg from 'pg';

const ROWS = 1_000_000;
const CIRCLES = 200;
const PAYEES = 40;
const YEARS = 3;
const WARMUP = 3;
const RUNS = 21;

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error('DIRECT_DATABASE_URL is not set');
const client = new pg.Client({ connectionString: url });

type Query = { name: string; raw: string; agg: string; params: unknown[] };

/** Server-side planning + execution ms, median of RUNS after WARMUP. */
async function time(sql: string, params: unknown[]): Promise<number> {
  const ms: number[] = [];
  for (let i = 0; i < WARMUP + RUNS; i++) {
    const { rows } = await client.query<{ 'QUERY PLAN': { 'Planning Time': number; 'Execution Time': number }[] }>(
      `explain (analyze, timing off, format json) ${sql}`, params,
    );
    const plan = rows[0]!['QUERY PLAN'][0]!;
    if (i >= WARMUP) ms.push(plan['Planning Time'] + plan['Execution Time']);
  }
  ms.sort((a, b) => a - b);
  return ms[Math.floor(ms.length / 2)]!;
}

async function main() {
  await client.connect();
  // Tables are unqualified, so check where each one actually resolves, not
  // just current_schema(): a wt_* schema without migrations falls through to public.
  const resolved = (await client.query<{ rel: string; ns: string | null }>(
    `select rel, (select n.nspname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where c.oid = to_regclass(rel)) as ns
       from unnest(array['spending', 'circles', 'spending_daily', 'spending_weekly', 'spending_payee_daily']) rel`,
  )).rows;
  const schema = resolved[0]!.ns ?? '';
  for (const { rel, ns } of resolved) {
    if (!ns?.startsWith('wt_') || ns !== schema) throw new Error(`refusing to seed ${ROWS} rows: ${rel} resolves to ${ns ?? 'nothing'}; use a migrated wt_* schema`);
  }
  const version = (await client.query<{ v: string }>(
    `select extversion || ', ' || split_part(version(), ' (', 1) as v from pg_extension where extname = 'timescaledb'`,
  )).rows[0]!.v;

  // Background policies would compress or refresh mid-measurement. The schema is
  // thrown away afterwards, so they stay paused.
  await client.query(`
    select alter_job(job_id, scheduled => false) from timescaledb_information.jobs
     where (hypertable_schema, hypertable_name) in (
       select $1::name, 'spending'::name
       union all
       select materialization_hypertable_schema, materialization_hypertable_name
         from timescaledb_information.continuous_aggregates where view_schema = $1::name)`, [schema]);

  console.log(`seeding ${ROWS} rows into ${schema}.spending ...`);
  await client.query('select setseed(0.42)');
  await client.query(
    `insert into circles (protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
     select 'Bench ' || g, 'bench', 'bench-' || g, 0 from generate_series(1, $1::int) g`, [CIRCLES],
  );
  // Each circle has PAYEES payees, a few visited far more than the rest
  // (random()^2), each payee in one everyday category, amounts $1 to ~$200.
  for (let done = 0; done < ROWS; done += 100_000) {
    await client.query(
      `with c as (select array_agg(id order by id) ids from circles where nessie_customer_id = 'bench'),
            p as (select g, floor(random() ^ 2 * $3::int)::int as payee from generate_series(1, 100000) g)
       insert into spending (occurred_at, circle_id, amount_cents, category, payee_name)
       select now() - random() * make_interval(years => $2::int),
              c.ids[1 + p.g % $1::int],
              100 + floor(random() * random() * 20000)::bigint,
              (array['groceries','pharmacy','utilities','dining','shopping','transport','healthcare','other'])[1 + p.payee % 8],
              'Payee ' || p.payee
         from p, c`, [CIRCLES, YEARS, PAYEES],
    );
  }
  for (const view of ['spending_daily', 'spending_weekly', 'spending_payee_daily']) {
    await client.query(`call refresh_continuous_aggregate('${view}', null, null)`);
  }
  await client.query('analyze spending');
  const rowCount = (await client.query<{ n: string }>('select count(*)::text n from spending')).rows[0]!.n;
  const circleId = (await client.query<{ id: string }>(
    `select id from circles where nessie_customer_id = 'bench' order by id limit 1`,
  )).rows[0]!.id;

  const queries: Query[] = [
    {
      name: 'Dashboard weekly chart (1 circle, 13 weeks)',
      raw: `select time_bucket(interval '7 days', occurred_at, 'America/New_York') as week, sum(amount_cents)
              from spending where circle_id = $1 and occurred_at > now() - interval '13 weeks' group by week`,
      agg: `select week, sum(total_cents) from spending_weekly
             where circle_id = $1 and week > now() - interval '13 weeks' group by week`,
      params: [circleId],
    },
    {
      name: 'Unusual-spending baseline (1 circle, 1 category, 90 days)',
      raw: `select round(avg(t)) from (
              select sum(amount_cents) t from spending
               where circle_id = $1 and category = 'groceries' and occurred_at >= now() - interval '90 days'
               group by time_bucket(interval '1 day', occurred_at, 'America/New_York')) d`,
      agg: `select round(avg(total_cents)) from spending_daily
             where circle_id = $1 and category = 'groceries' and day >= now() - interval '90 days'`,
      params: [circleId],
    },
    {
      name: '"Usual spending" at one payee (1 circle, 1 year)',
      raw: `select sum(amount_cents) / count(*) from spending
             where circle_id = $1 and payee_name = 'Payee 0' and occurred_at >= now() - interval '1 year'`,
      agg: `select sum(total_cents) / sum(payments) from spending_payee_daily
             where circle_id = $1 and payee_name = 'Payee 0' and day >= now() - interval '1 year'`,
      params: [circleId],
    },
    {
      name: `Weekly totals, all ${CIRCLES} circles, ${YEARS} years`,
      raw: `select time_bucket(interval '7 days', occurred_at, 'America/New_York') as week, sum(amount_cents)
              from spending group by week`,
      agg: 'select week, sum(total_cents) from spending_weekly group by week',
      params: [],
    },
  ];

  console.log('timing raw (row store) and continuous aggregates ...');
  const results = [];
  for (const q of queries) results.push({ q, raw: await time(q.raw, q.params), agg: await time(q.agg, q.params) });

  console.log('compressing every chunk ...');
  await client.query(`select compress_chunk(c, if_not_compressed => true) from show_chunks('spending') c`);
  await client.query('analyze spending');
  const stats = (await client.query<{ chunks: string; compressed: string; before: string; after: string }>(
    `select total_chunks::text chunks, number_compressed_chunks::text compressed,
            before_compression_total_bytes::text before, after_compression_total_bytes::text after
       from hypertable_columnstore_stats('spending')`,
  )).rows[0]!;
  console.log('timing raw (columnstore) ...');
  const compressed: number[] = [];
  for (const q of queries) compressed.push(await time(q.raw, q.params));

  const keys = ['dashboard', 'baseline', 'payee', 'all_circles'] as const;
  const report: PerfReport = {
    measuredAt: new Date().toISOString().slice(0, 10), version,
    rows: Number(rowCount), circles: CIRCLES, payees: PAYEES, years: YEARS, warmup: WARMUP, runs: RUNS,
    provenance: 'Generated by npm run bench:perf on a migrated throwaway schema.',
    queries: results.map((r, i) => ({
      key: keys[i]!, name: r.q.name, rawMs: r.raw, columnstoreMs: compressed[i]!,
      aggregateMs: r.agg, speedup: r.raw / r.agg,
    })),
    compression: {
      beforeMiB: Number(stats.before) / 1024 / 1024, afterMiB: Number(stats.after) / 1024 / 1024,
      ratio: Number(stats.before) / Number(stats.after),
      compressedChunks: Number(stats.compressed), totalChunks: Number(stats.chunks),
    },
  };
  await writePerfArtifacts(report);
  console.log(renderPerfReport(report));
}

main().finally(() => client.end());
