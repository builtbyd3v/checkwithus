import benchmark from '../lib/perf-benchmark.json';
import { perfReportSchema } from '../lib/perf-report';
import { writePerfArtifacts } from './write-perf-report';

writePerfArtifacts(perfReportSchema.parse(benchmark)).then(() => {
  console.log('Updated docs/perf.md and README from recorded benchmark JSON; no database requests made.');
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Could not render benchmark artifacts');
  process.exitCode = 1;
});
