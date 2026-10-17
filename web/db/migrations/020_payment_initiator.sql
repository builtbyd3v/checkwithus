-- Who asked for a payment: the older adult's phone, or the family's bill-pay
-- agent (#19), which signs in as its own Auth0 machine client. The rules and
-- holds are the same for both; this only says who asked.
alter table payments add column initiated_by text not null default 'device'
  check (initiated_by in ('device', 'agent'));
