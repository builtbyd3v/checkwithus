-- Money into spending (#13): family top-ups and benefit deposits.
--
-- Nessie never updates stored balances, so, like spending and the vault, the
-- money that comes in is our own ledger. Balance = opening - spending - vault
-- + credits. Only 'sent' credits count: a top-up send whose outcome is
-- unknown stays 'sending', does not count, and is never retried, so it cannot
-- move twice. The idempotency key makes a retried tap answer with the first one.
create table ledger_credits (
  id uuid primary key default uuidv7(),
  circle_id uuid not null references circles (id) on delete cascade,
  kind text not null check (kind in ('top_up', 'deposit')),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents % 100 = 0),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  -- The family member whose Nessie account paid for a top-up.
  member_id uuid references circle_members (id) on delete set null,
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  nessie_id text,
  failure text check (length(failure) <= 500),
  occurred_at timestamptz not null default now(),
  unique (circle_id, idempotency_key)
);

-- A family member's own Nessie account, the source of their top-ups. Created on first use.
alter table circle_members add column nessie_account_id text unique;
