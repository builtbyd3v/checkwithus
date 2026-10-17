-- Two more continuous aggregates on the spending hypertable (#6).
--
-- spending_weekly: weekly totals per circle and category, built on top of
-- spending_daily (a hierarchical continuous aggregate). It rolls up about 7
-- daily rows per week instead of re-reading raw payments. Powers the
-- dashboard's weekly chart, which used to bucket daily rows in JavaScript.
--
-- spending_payee_daily: daily totals per circle and payee, the baseline for
-- "6x her usual" at one payee. It reads the raw hypertable, because
-- spending_daily is grouped by category and has no payee to roll up.
--
-- Both are real-time (materialized_only = false), like spending_daily, so a
-- payment made a second ago already counts. Same fixed zone as 003.
--
-- 002 already set the columnstore (compression) policy on spending, so
-- nothing to add for that here.

-- 7-day buckets start on Mondays (the default origin, 2000-01-03, is one).
create materialized view spending_weekly
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  circle_id,
  category,
  time_bucket(interval '7 days', day, 'America/New_York') as week,
  sum(total_cents)::bigint as total_cents,
  sum(payments)::integer as payments
from spending_daily
group by circle_id, category, week
with no data;

select add_continuous_aggregate_policy(
  'spending_weekly',
  start_offset => interval '120 days',
  end_offset => interval '1 day',
  schedule_interval => interval '1 hour'
);

create materialized view spending_payee_daily
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  circle_id,
  payee_name,
  time_bucket(interval '1 day', occurred_at, 'America/New_York') as day,
  sum(amount_cents)::bigint as total_cents,
  count(*)::integer as payments
from spending
group by circle_id, payee_name, day
with no data;

select add_continuous_aggregate_policy(
  'spending_payee_daily',
  start_offset => interval '120 days',
  end_offset => interval '1 hour',
  schedule_interval => interval '30 minutes'
);
