-- ATM cash in the spending ledger, for the "cash then gift card" scam
-- sequence (issue #17). Nessie withdrawals carry a date but no time and no
-- ATM, so the ledger row holds both: the real time of the withdrawal and the
-- Nessie ATM it came from. Null for everything that is not ATM cash.
alter table spending add column atm_id text;
