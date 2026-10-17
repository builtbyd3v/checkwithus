import { describe, expect, it } from 'vitest';
import recorded from './perf-benchmark.json';
import { benchmarkSummary, perfReportSchema, updateReadmePerf } from './perf-report';

const report = perfReportSchema.parse(recorded);
describe('benchmark publication', () => {
  it('updates only the marked README block and preserves credits and setup', () => {
    const original = '# Setup\nKeep this.\n<!-- PERF:START -->\nstale numbers\n<!-- PERF:END -->\n# Credits\nKeep these too.\n';
    const updated = updateReadmePerf(original, report);
    expect(updated.startsWith('# Setup\nKeep this.\n')).toBe(true);
    expect(updated.endsWith('# Credits\nKeep these too.\n')).toBe(true);
    expect(updated).not.toContain('stale numbers');
    expect(updated).toContain('2077.43');
    expect(benchmarkSummary(report)).toContain('13.8x faster');
  });

  it('refuses missing or ambiguous markers instead of overwriting unrelated text', () => {
    expect(() => updateReadmePerf('# Credits', report)).toThrow('marker pair');
    expect(() => updateReadmePerf('<!-- PERF:START --><!-- PERF:START --><!-- PERF:END -->', report)).toThrow('marker pair');
  });

  it('rejects invalid metrics that would produce misleading speed or compression claims', () => {
    expect(perfReportSchema.safeParse({ ...recorded, compression: { ...recorded.compression, totalChunks: 1 } }).success).toBe(false);
    expect(perfReportSchema.safeParse({ ...recorded, queries: recorded.queries.map((q) => ({ ...q, aggregateMs: 0 })) }).success).toBe(false);
    expect(perfReportSchema.safeParse({ ...recorded, queries: recorded.queries.map((q) => ({ ...q, key: 'dashboard' })) }).success).toBe(false);
  });
});
