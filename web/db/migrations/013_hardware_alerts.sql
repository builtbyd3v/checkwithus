-- Independent of pending policy migrations 011/012. Reuse devices and alerts.
alter table devices add column device_type text not null default 'phone'
  check (device_type in ('phone', 'esp32'));
alter table devices add column last_alert_at timestamptz;
alter table circles add column assistance_contact_phone text
  check (assistance_contact_phone is null or assistance_contact_phone ~ '^\+[1-9][0-9]{7,14}$');

alter table alerts drop constraint alerts_kind_check;
alter table alerts add constraint alerts_kind_check
  check (kind in ('bank_during_call', 'ask_family', 'purchase_review_requested'));
alter table alerts add column device_id uuid references devices(id) on delete set null;
alter table alerts add column event_id uuid;
alter table alerts add column device_label text;
alter table alerts add column occurred_at timestamptz;
alter table alerts add column resolved_at timestamptz;
alter table alerts add column resolved_by uuid references circle_members(id) on delete set null;
create unique index alerts_device_event on alerts(device_id, event_id) where event_id is not null;
create index alerts_open_hardware on alerts(circle_id, created_at desc)
  where kind = 'purchase_review_requested' and resolved_at is null;

-- A durable in-app notification for each member linked at the time of the press.
-- Access still requires current circle membership; deleting a member removes
-- their notifications. New members can see the circle's open requests too.
create table alert_recipients (
  alert_id uuid not null references alerts(id) on delete cascade,
  member_id uuid not null references circle_members(id) on delete cascade,
  primary key (alert_id, member_id)
);
