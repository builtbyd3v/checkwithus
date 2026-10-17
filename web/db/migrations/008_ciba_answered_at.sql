-- When a family member's Guardian answer arrived.
--
-- Auth0 hands out a CIBA answer once. If applying it to the payment fails
-- (say, a transient database error), the answer must not be lost: it stays
-- recorded here, and every later poll re-applies unapplied answers to
-- still-held payments in the order they arrived, so the first answer still
-- wins.

alter table ciba_requests add column answered_at timestamptz;
update ciba_requests set answered_at = now() where state in ('approved', 'denied');
