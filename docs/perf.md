# Tiger Data performance

Measured 2026-10-17 on Tiger Cloud (TimescaleDB 2.30.2, PostgreSQL 18.6) with 1,000,000 synthetic rows in `spending` (200 circles, 40 payees each, 3 years).
Method: server time (planning + execution) from `explain (analyze, timing off)`, median of 21 warm runs after 3 warm-ups; continuous aggregates fully materialized first (`refresh_continuous_aggregate(..., null, null)`).
Reproduce: `npm run bench:perf` in `web/` (script `web/scripts/perf-bench.ts`), against a throwaway `wt_*` schema only.

| Query | Raw, row store (ms) | Raw, columnstore (ms) | Continuous aggregate (ms) | Aggregate vs row store |
| --- | ---: | ---: | ---: | ---: |
| Dashboard weekly chart (1 circle, 13 weeks) | 2.61 | 2.75 | 1.10 | 2.4x faster |
| Unusual-spending baseline (1 circle, 1 category, 90 days) | 2.57 | 3.00 | 1.18 | 2.2x faster |
| "Her usual" at one payee (1 circle, 1 year) | 7.92 | 8.55 | 2.65 | 3.0x faster |
| Weekly totals, all 200 circles, 3 years | 2077.43 | 1517.67 | 150.23 | 13.8x faster |

Aggregate times are a best case: everything was materialized, while in production the current week is computed live from raw rows. The queries are simplified versions of the dashboard and rules queries.

Compression (columnstore, segment by circle): 163.3 MB to 50.3 MB, **3.2x smaller** (158 of 158 chunks).
