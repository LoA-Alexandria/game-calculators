-- Members may set a short display name shown on the guild roster.

alter table public.guild_memberships
  add column if not exists display_name text not null default ''
  constraint guild_memberships_display_name_len check (char_length(display_name) <= 40);

comment on column public.guild_memberships.display_name is
  'Optional in-guild display name chosen by the member.';

-- ---------------------------------------------------------------------------
-- RPC: set own display name (avoids letting members self-activate via UPDATE)
-- ---------------------------------------------------------------------------

create or replace function public.set_guild_display_name(p_guild_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := left(trim(coalesce(p_name, '')), 40);
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_guild_member(p_guild_id) then
    raise exception 'Not a guild member';
  end if;

  update public.guild_memberships
  set display_name = cleaned
  where guild_id = p_guild_id
    and user_id = uid
    and status = 'active';

  if found then
    return;
  end if;

  -- Master (or site admin) may have no membership row yet — create an active one.
  if public.is_guild_master(p_guild_id) then
    insert into public.guild_memberships (
      guild_id, user_id, status, display_name, decided_at, decided_by
    )
    values (p_guild_id, uid, 'active', cleaned, now(), uid)
    on conflict (guild_id, user_id) do update
      set display_name = excluded.display_name,
          status = 'active',
          decided_at = now(),
          decided_by = uid;
    return;
  end if;

  raise exception 'No active membership to update';
end;
$$;

revoke all on function public.set_guild_display_name(uuid, text) from public, anon;
grant execute on function public.set_guild_display_name(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Roster returns display_name (must drop — OUT row type changed)
-- ---------------------------------------------------------------------------

drop function if exists public.guild_roster(uuid);

create or replace function public.guild_roster(p_guild_id uuid)
returns table (
  user_id uuid,
  discord_user_id text,
  display_name text,
  status text,
  is_master boolean,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with gate as (
    select public.is_guild_member(p_guild_id) as allowed
  ),
  guild as (
    select * from public.guilds where id = p_guild_id
  ),
  active_members as (
    select
      m.user_id,
      ea.discord_user_id,
      m.display_name,
      m.status,
      (ea.discord_user_id is not null and ea.discord_user_id = guild.master_discord_user_id) as is_master,
      m.requested_at
    from public.guild_memberships m
    cross join guild
    left join public.editor_access ea on ea.user_id = m.user_id
    where m.guild_id = p_guild_id
      and m.status = 'active'
      and (select allowed from gate)
  ),
  master_only as (
    select
      ea.user_id,
      guild.master_discord_user_id as discord_user_id,
      ''::text as display_name,
      'active'::text as status,
      true as is_master,
      guild.created_at as requested_at
    from guild
    left join public.editor_access ea on ea.discord_user_id = guild.master_discord_user_id
    where (select allowed from gate)
      and not exists (select 1 from active_members where is_master)
  )
  select * from active_members
  union all
  select * from master_only
  order by is_master desc, requested_at asc;
$$;
