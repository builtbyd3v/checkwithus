-- Two fixes from the security audit.
--
-- 1. Guardian answers in a safe order. Auth0 does not say WHEN someone tapped
--    Deny, so answers cannot be sorted by true answer time. Instead, an
--    approval only takes effect once every other member's still-open push
--    has been checked after it arrived; a Deny seen by then wins.
--    last_polled_at records when Auth0 last told us a request's state.
alter table ciba_requests add column last_polled_at timestamptz;

-- 2. Unknown bank outcomes stay unknown for long enough. sent_at is when the
--    payment was actually handed to Nessie (not when it was claimed, and not
--    bumped by later notes). A payment whose outcome is unknown is only
--    declared failed well after this, so a slow write that commits late is
--    found and recorded rather than followed by a second payment.
alter table payments add column sent_at timestamptz;
