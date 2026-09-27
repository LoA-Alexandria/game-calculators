-- Guild-create requests: say who will own the guild, and keep the server as a
-- number and a name so the displayed label is always assembled the same way.
--
-- Two things were impossible before:
--   * asking for a guild on your own account without typing your own Discord
--     id (a password account has none at all), and
--   * naming the future master by account name instead of a snowflake.
-- `owner_kind` records which of the two a row means; `owner_user_id` is the
-- authoritative answer for 'self', and `master_handle` carries the typed name
-- when no snowflake was given. An admin still fills the snowflake in when the
-- guild is created, because `guilds.master_discord_user_id` stays required.

alter table public.guild_create_requests
  add column if not exists owner_kind text not null default 'other',
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists master_handle text not null default '',
  add column if not exists server_number text not null default '';

comment on column public.guild_create_requests.owner_kind is
  'self = the requester becomes master (owner_user_id), other = somebody they named.';
comment on column public.guild_create_requests.master_handle is
  'Discord name or site account name, used when no Discord snowflake was given.';
comment on column public.guild_create_requests.server_number is
  'Server number on its own; the label is assembled with server_name for display.';

alter table public.guild_create_requests
  drop constraint if exists guild_create_requests_owner_kind_check;
alter table public.guild_create_requests
  add constraint guild_create_requests_owner_kind_check
  check (owner_kind in ('self', 'other'));

-- Optional now: a self request from a password account has no snowflake.
alter table public.guild_create_requests
  alter column master_discord_user_id drop not null;

alter table public.guild_create_requests
  drop constraint if exists guild_create_requests_master_discord_user_id_check;
alter table public.guild_create_requests
  add constraint guild_create_requests_master_discord_user_id_check
  check (master_discord_user_id is null or master_discord_user_id ~ '^[0-9]{5,32}$');

-- Somebody else must be named somehow; for yourself the row points at you.
alter table public.guild_create_requests
  drop constraint if exists guild_create_requests_owner_named;
alter table public.guild_create_requests
  add constraint guild_create_requests_owner_named check (
    case owner_kind
      when 'self' then owner_user_id is not null
      else master_discord_user_id is not null or char_length(btrim(master_handle)) > 0
    end
  );

alter table public.guild_create_requests
  drop constraint if exists guild_create_requests_server_number_format;
alter table public.guild_create_requests
  add constraint guild_create_requests_server_number_format
  check (server_number = '' or server_number ~ '^[0-9]{1,6}$');

-- A request for your own account may only point at you. The one-open-request
-- index on (user_id) already stops a second guild while one is pending or
-- approved, which is what keeps a new Premium month from buying another.
drop policy if exists "Premium members can insert one pending guild create request"
  on public.guild_create_requests;

create policy "Premium members can insert one pending guild create request"
  on public.guild_create_requests for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and public.has_active_premium(auth.uid())
    and (owner_kind <> 'self' or owner_user_id = (select auth.uid()))
  );
