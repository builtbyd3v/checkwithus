import { readFile, writeFile } from 'node:fs/promises';
import { perfReportSchema, renderPerfReport, updateReadmePerf, type PerfReport } from '../lib/perf-report';

export async function writePerfArtifacts(input: PerfReport) {
  const report = perfReportSchema.parse(input);
  const readmeUrl = new URL('../../README.md', import.meta.url);
  const readme = updateReadmePerf(await readFile(readmeUrl, 'utf8'), report);
  await writeFile(new URL('../lib/perf-benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  await writeFile(new URL('../../docs/perf.md', import.meta.url), '# Tiger Data performance\n\n' + renderPerfReport(report));
  await writeFile(readmeUrl, readme);
}
