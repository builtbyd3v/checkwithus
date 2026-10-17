-- The spending ledger, as a Tiger Data hypertable.
--
-- Nessie never updates account balances, so this table is the ledger of
-- record: every completed payment and all seeded history land here.
-- Partitioned by time into weekly chunks; older chunks move to the
-- columnstore, which compresses them and makes the dashboard's range scans
-- over months of history cheap.

create table spending (
  occurred_at timestamptz not null,
  circle_id uuid not null references circles (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  category text not null,
  payee_name text not null,
  -- Set for payments made through checkwith.us; null for seeded history.
  payment_id uuid,
  nessie_id text
);

select create_hypertable('spending', by_range('occurred_at', interval '7 days'));

create index spending_by_circle on spending (circle_id, occurred_at desc);

-- One ledger row per Nessie record, so re-running the seed or retrying a
-- payment cannot double-count. Unique indexes on a hypertable must include
-- the partitioning column.
create unique index spending_one_row_per_nessie_record
  on spending (nessie_id, occurred_at) where nessie_id is not null;

-- Segment by circle so one family's history compresses together and a
-- dashboard query for one circle reads only that circle's segments.
alter table spending set (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby = 'circle_id',
  timescaledb.orderby = 'occurred_at desc'
);

call add_columnstore_policy('spending', after => interval '30 days');
