-- Server-owned roles and per-payment approval quorum. Existing family members
-- retain their authority; new invite joins explicitly start as viewers.
alter table circle_members add column role text not null default 'approver'
  check (role in ('approver', 'viewer'));
alter table circles add column two_approvals_over_cents bigint not null default 100000
  check (two_approvals_over_cents >= 0);
alter table payments add column approvals_required integer not null default 1
  check (approvals_required in (1, 2));
create table payment_votes (
  payment_id uuid not null references payments(id) on delete cascade,
  member_id uuid not null references circle_members(id) on delete cascade,
  decision text not null check (decision in ('approve', 'deny')),
  via text not null check (via in ('app', 'dashboard', 'ciba')),
  created_at timestamptz not null default clock_timestamp(),
  primary key (payment_id, member_id)
);
create table allowances (
  id uuid primary key default uuidv7(),
  circle_id uuid not null references circles(id) on delete cascade,
  payee_id uuid references payees(id) on delete cascade,
  category text,
  max_amount_cents bigint not null check (max_amount_cents > 0),
  expires_at timestamptz not null,
  granted_by uuid references circle_members(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((payee_id is null) <> (category is null))
);
create index allowances_by_circle on allowances(circle_id) where revoked_at is null;
alter table payments add column allowance_id uuid references allowances(id) on delete set null;
