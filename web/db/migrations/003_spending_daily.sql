-- Daily spending per circle and category, as a continuous aggregate.
--
-- Two readers:
--   - the hold rules' "unusual spending" baseline (lib/rules.ts), which asks
--     what this person typically spends in a category on a day they spend
--   - the family dashboard's charts
-- Both would otherwise re-sum months of raw rows on every request.
--
-- materialized_only = false makes it a real-time aggregate: buckets not yet
-- materialized are computed from the raw table at query time, so a payment
-- made a second ago already shows on the dashboard.
--
-- Days are bucketed in America/New_York (SwampHacks is in Gainesville); a
-- continuous aggregate takes one fixed zone.

create materialized view spending_daily
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  circle_id,
  category,
  time_bucket(interval '1 day', occurred_at, 'America/New_York') as day,
  sum(amount_cents)::bigint as total_cents,
  count(*)::integer as payments
from spending
group by circle_id, category, day
with no data;

select add_continuous_aggregate_policy(
  'spending_daily',
  start_offset => interval '120 days',
  end_offset => interval '1 hour',
  schedule_interval => interval '30 minutes'
);
