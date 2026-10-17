-- Core tables: circles, family, devices, payees, payments.
--
-- Money is integer cents in bigint columns everywhere (hard rule #2).
-- Ids are uuidv7 (built into PostgreSQL 18): time-ordered, so new rows index
-- at the end instead of at random positions.

-- One protected older adult, and the rules their family set.
create table circles (
  id uuid primary key default uuidv7(),
  protected_name text not null check (length(protected_name) between 1 and 80),
  time_zone text not null default 'America/New_York',
  nessie_customer_id text not null,
  nessie_account_id text not null unique,
  -- Nessie never updates balances, so the live balance is this minus our ledger.
  opening_balance_cents bigint not null check (opening_balance_cents >= 0),
  hold_over_cents bigint not null default 30000 check (hold_over_cents >= 0),
  -- CIBA caps a request's lifetime at 300 seconds, so the timeout never exceeds it.
  approval_timeout_seconds integer not null default 300
    check (approval_timeout_seconds between 30 and 300),
  -- App groups the phone keeps locked with Screen Time. iOS hands apps opaque
  -- tokens, never bundle ids, so the server stores groups and the phone maps
  -- them to its own selection.
  locked_app_groups text[] not null default array['remote_access', 'crypto', 'gift_cards']
    check (locked_app_groups <@ array['remote_access', 'crypto', 'gift_cards', 'wire_transfer']),
  invite_code_hash text unique,
  created_at timestamptz not null default now()
);

-- Up to three family members per circle. First to answer decides.
create table circle_members (
  id uuid primary key default uuidv7(),
  circle_id uuid not null references circles (id) on delete cascade,
  auth0_sub text not null,
  display_name text not null check (length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (circle_id, auth0_sub)
);
create index circle_members_by_sub on circle_members (auth0_sub);

-- At most three. Locking the circle row first serializes concurrent joins, so
-- two people accepting an invite at the same moment cannot make it four.
create function enforce_circle_size() returns trigger language plpgsql as $$
begin
  perform 1 from circles where id = new.circle_id for update;
  if (select count(*) from circle_members where circle_id = new.circle_id) >= 3 then
    raise exception 'circle_full' using hint = 'A family circle has at most three people.';
  end if;
  return new;
end
$$;
create trigger circle_members_at_most_three
  before insert on circle_members
  for each row execute function enforce_circle_size();

-- The older adult's phone. It never logs in; it holds a bearer token we
-- issued at pairing. Only the token's SHA-256 is stored.
create table devices (
  id uuid primary key default uuidv7(),
  circle_id uuid not null references circles (id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'iPhone' check (length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

-- One-time codes a family member shows to pair the older adult's phone.
create table pairing_codes (
  code_hash text primary key,
  circle_id uuid not null references circles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Who the family has said is fine to pay. Paying anyone else holds.
create table payees (
  id uuid primary key default uuidv7(),
  circle_id uuid not null references circles (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  normalized_name text not null,
  kind text not null check (kind in ('merchant', 'person', 'biller')),
  category text not null,
  created_at timestamptz not null default now(),
  unique (circle_id, kind, normalized_name)
);

-- Nessie merchants we have created, so each is made once. Merchants are
-- global to our Nessie key, not per circle.
create table nessie_merchants (
  normalized_name text not null,
  category text not null,
  name text not null,
  nessie_merchant_id text not null unique,
  primary key (normalized_name, category)
);

-- Every payment the phone asked to make, and what became of it.
--
--   held -> approved | denied   first family answer, before expires_at
--   held -> expired             nobody answered in time: blocked
--   approved -> paying          claimed for sending to Nessie (exactly once)
--   paying -> paid | failed
--
-- Payments the rules allow are created as `approved` (decided_via 'rules').
create table payments (
  id uuid primary key default uuidv7(),
  circle_id uuid not null references circles (id) on delete cascade,
  idempotency_key text not null check (length(idempotency_key) between 8 and 100),
  amount_cents bigint not null check (amount_cents > 0),
  payee_name text not null check (length(payee_name) between 1 and 80),
  payee_kind text not null check (payee_kind in ('merchant', 'person', 'biller')),
  category text not null,
  on_call boolean not null,
  payee_known boolean not null,
  -- The on-device Guard's suggestion. Advisory: it can add a hold, never lift one.
  guard_score real check (guard_score between 0 and 1),
  guard_model_version text check (length(guard_model_version) <= 64),
  -- checkwith-1's explanation for the family, written on the phone.
  explanation text check (length(explanation) <= 2000),
  hold_reasons text[] not null default '{}',
  status text not null
    check (status in ('held', 'approved', 'denied', 'expired', 'paying', 'paid', 'failed')),
  expires_at timestamptz,
  decided_by uuid references circle_members (id) on delete set null,
  decided_via text check (decided_via in ('rules', 'app', 'ciba', 'dashboard', 'timeout')),
  decided_at timestamptz,
  nessie_kind text check (nessie_kind in ('purchase', 'withdrawal', 'bill')),
  nessie_id text,
  failure text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (circle_id, idempotency_key),
  -- A held payment always has a deadline; that is what makes "no answer = blocked" work.
  check (status <> 'held' or expires_at is not null),
  -- A paid payment always points at its Nessie record.
  check (status <> 'paid' or nessie_id is not null)
);
create index payments_by_circle on payments (circle_id, created_at desc);
create index payments_held on payments (circle_id, expires_at) where status = 'held';

-- "Bank while on a call" and "Ask my family", from the older adult's phone.
create table alerts (
  id uuid primary key default uuidv7(),
  circle_id uuid not null references circles (id) on delete cascade,
  kind text not null check (kind in ('bank_during_call', 'ask_family')),
  detail text check (length(detail) <= 500),
  created_at timestamptz not null default now()
);
create index alerts_by_circle on alerts (circle_id, created_at desc);
