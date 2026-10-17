-- Original bill due date is retained even when the family pays it early.
alter table payments add column bill_due_date date;
alter table payments add constraint bill_due_date_only_for_bills
  check (bill_due_date is null or payee_kind = 'biller');
