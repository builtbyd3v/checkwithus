import { z } from 'zod';

export const perfReportSchema = z.object({
  measuredAt: z.iso.date(), version: z.string().min(1), provenance: z.string().min(1),
  rows: z.number().int().positive(), circles: z.number().int().positive(), payees: z.number().int().positive(), years: z.number().int().positive(),
  warmup: z.number().int().nonnegative(), runs: z.number().int().positive(),
  queries: z.array(z.object({
    key: z.enum(['dashboard', 'baseline', 'payee', 'all_circles']), name: z.string().min(1),
    rawMs: z.number().positive(), columnstoreMs: z.number().positive(), aggregateMs: z.number().positive(), speedup: z.number().positive(),
  })).length(4).refine((rows) => new Set(rows.map((row) => row.key)).size === 4, 'Each benchmark query must appear once'),
  compression: z.object({
    beforeMiB: z.number().positive(), afterMiB: z.number().positive(), ratio: z.number().positive(),
    compressedChunks: z.number().int().nonnegative(), totalChunks: z.number().int().positive(),
  }).refine((c) => c.compressedChunks <= c.totalChunks, 'Compressed chunks exceed total'),
});
export type PerfReport = z.infer<typeof perfReportSchema>;

export function benchmarkSummary(report: PerfReport) {
  const all = report.queries.find((query) => query.key === 'all_circles')!;
  return `Benchmark on ${report.rows.toLocaleString('en-US')} synthetic payments: weekly totals for all circles ${all.speedup.toFixed(1)}x faster from the aggregate (${all.aggregateMs.toFixed(0)} ms vs ${Math.round(all.rawMs).toLocaleString('en-US')} ms), history ${report.compression.ratio.toFixed(1)}x smaller compressed. Measured ${report.measuredAt}.`;
}

export function renderPerfReport(report: PerfReport) {
  const table = [
    '| Query | Raw, row store (ms) | Raw, columnstore (ms) | Continuous aggregate (ms) | Aggregate vs row store |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...report.queries.map((q) => `| ${q.name} | ${q.rawMs.toFixed(2)} | ${q.columnstoreMs.toFixed(2)} | ${q.aggregateMs.toFixed(2)} | ${q.speedup.toFixed(1)}x faster |`),
  ].join('\n');
  const c = report.compression;
  return `Measured ${report.measuredAt} on Tiger Cloud (TimescaleDB ${report.version}) with ${report.rows.toLocaleString('en-US')} synthetic rows in \`spending\` (${report.circles} circles, ${report.payees} payees each, ${report.years} years).
Method: server time (planning + execution) from \`explain (analyze, timing off)\`, median of ${report.runs} warm runs after ${report.warmup} warm-ups; continuous aggregates fully materialized first.

${table}

Compression (columnstore, segment by circle): ${c.beforeMiB.toFixed(1)} MiB to ${c.afterMiB.toFixed(1)} MiB, **${c.ratio.toFixed(1)}x smaller** (${c.compressedChunks} of ${c.totalChunks} chunks).

Aggregate times are a best case: everything was materialized, while in production the current week is computed live from raw rows. The queries are simplified versions of the dashboard and rules queries.

Data source: \`web/lib/perf-benchmark.json\`. ${report.provenance}
Reproduce measurements: \`npm run bench:perf\` in \`web/\`, against a migrated throwaway \`wt_*\` schema only. Re-render these recorded results without a database: \`npm run perf:report\`.
`;
}

export function updateReadmePerf(readme: string, report: PerfReport) {
  const start = '<!-- PERF:START -->';
  const end = '<!-- PERF:END -->';
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(start) > readme.indexOf(end)) {
    throw new Error('README must contain exactly one ordered PERF marker pair');
  }
  return readme.slice(0, readme.indexOf(start) + start.length) + '\n' + renderPerfReport(report) + '\n' + readme.slice(readme.indexOf(end));
}
