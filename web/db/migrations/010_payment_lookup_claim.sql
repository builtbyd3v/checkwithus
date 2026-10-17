-- A read may confirm a recently sent payment, but phone polling must not
-- turn into four Nessie GETs on every request. Claim one lookup per payment.
alter table payments add column next_lookup_at timestamptz not null default now();

-- Migration 009 added sent_at after the first payment rows could exist.
-- Treat their last state change as the send time so an unknown outcome cannot
-- be declared failed immediately after this migration.
update payments set sent_at = updated_at
 where status = 'paying' and sent_at is null;
