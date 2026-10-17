-- Auth0 CIBA: one push request per family member per held payment.
--
-- When a payment is held, each member gets an Auth0 Guardian push. Their
-- answer is learned by polling Auth0, which serverless functions can only do
-- when a request arrives, so `poll_after` is the shared clock: a poll first
-- claims the row by pushing poll_after forward, so however many requests
-- arrive at once, Auth0 is asked at most once per interval (rule 8).

create table ciba_requests (
  id uuid primary key default uuidv7(),
  payment_id uuid not null references payments (id) on delete cascade,
  member_id uuid not null references circle_members (id) on delete cascade,
  -- Null when the push could not be started (e.g. member not enrolled in Guardian).
  auth_req_id text unique,
  state text not null default 'pending'
    check (state in ('pending', 'approved', 'denied', 'expired', 'superseded', 'failed')),
  poll_after timestamptz not null default now(),
  interval_seconds integer not null default 5 check (interval_seconds between 1 and 60),
  expires_at timestamptz not null,
  last_error text check (length(last_error) <= 500),
  created_at timestamptz not null default now(),
  unique (payment_id, member_id),
  check (state = 'failed' or auth_req_id is not null)
);
create index ciba_requests_pending on ciba_requests (payment_id, poll_after) where state = 'pending';
