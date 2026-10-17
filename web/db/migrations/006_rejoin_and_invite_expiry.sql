-- Two fixes from review.
--
-- 1. Re-joining. A BEFORE INSERT trigger runs before ON CONFLICT is
--    considered, so a member of a full circle who used the invite again was
--    told "circle_full" instead of being a no-op. Someone already in the
--    circle now passes the size check, and the insert's ON CONFLICT DO NOTHING
--    absorbs the duplicate. The row lock still serializes concurrent joins.
create or replace function enforce_circle_size() returns trigger language plpgsql as $$
begin
  perform 1 from circles where id = new.circle_id for update;
  if exists (
    select 1 from circle_members
     where circle_id = new.circle_id and auth0_sub = new.auth0_sub
  ) then
    return new;
  end if;
  if (select count(*) from circle_members where circle_id = new.circle_id) >= 3 then
    raise exception 'circle_full' using hint = 'A family circle has at most three people.';
  end if;
  return new;
end
$$;

-- 2. Invite codes expire, and are now hashed with a server-side key (see
--    lib/auth/tokens.ts). Codes hashed the old way can never match again, so
--    clear them rather than leave dead hashes behind.
alter table circles add column invite_expires_at timestamptz;
update circles set invite_code_hash = null where invite_code_hash is not null;
delete from pairing_codes;
