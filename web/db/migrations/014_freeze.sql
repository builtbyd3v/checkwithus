-- Freeze: one tap moves the spending balance to a vault account (issue #18).
--
-- While `frozen`, every new payment is held. Nessie never updates balances,
-- so the vault's balance is our own ledger of transfers, like spending.
-- A transfer counts as moved unless it definitely failed: a send whose outcome
-- is unknown stays 'sending' and is never retried, so it cannot move twice.
-- Every freeze and unfreeze writes a row, even for $0, so the newest row is
-- always the latest tap and a retry can answer with it.
alter table circles add column frozen boolean not null default false;
alter table circles add column vault_account_id text unique;

create table vault_transfers (
  id uuid primary key default uuidv7(),
  circle_id uuid not null references circles (id) on delete cascade,
  direction text not null check (direction in ('freeze', 'unfreeze')),
  amount_cents bigint not null check (amount_cents >= 0 and amount_cents % 100 = 0),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  nessie_id text,
  failure text check (length(failure) <= 500),
  created_at timestamptz not null default now()
);
create index vault_transfers_by_circle on vault_transfers (circle_id, id desc);
