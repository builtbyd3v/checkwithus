-- Store the Guard score at the precision the hold decision used.
--
-- As a 32-bit `real`, 0.49999999 and 0.5 are the same value. The rules
-- compare the full-precision score against the 0.5 threshold, so a payment
-- could be allowed at 0.49999999 and then show a flagged-looking 0.5 in the
-- database, and an idempotent retry could not tell the two apart.

alter table payments alter column guard_score type double precision;
