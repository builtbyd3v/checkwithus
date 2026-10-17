-- One ledger row per Nessie record, enforced properly.
--
-- 002's unique index on spending (nessie_id, occurred_at) does not do this:
-- Timescale requires the partitioning column in every unique index on a
-- hypertable, so the same Nessie record at two different timestamps would
-- pass. An ordinary table keyed on nessie_id alone does enforce it. Ledger
-- writers claim the id here first, in the same transaction, and only add the
-- spending row if the claim was new.

create table spending_nessie_records (
  nessie_id text primary key,
  circle_id uuid not null references circles (id) on delete cascade,
  recorded_at timestamptz not null default now()
);

drop index spending_one_row_per_nessie_record;
