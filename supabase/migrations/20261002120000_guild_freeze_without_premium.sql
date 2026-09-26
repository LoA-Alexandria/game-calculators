-- A guild whose Premium has run out is frozen: still visible, but nothing in
-- it can be written any more.
--
-- Hiding buttons is not authorization, and there are more than forty write
-- policies across the guild tables. Rather than rewrite each of them, the rule
-- is a trigger: one function, attached to every table that hangs off a guild.
-- Reads are untouched, so members keep seeing their posts, roster and plans.
--
-- Leaving is the one exception. A member may always walk out, frozen or not.

create or replace function public.guild_is_frozen(p_guild_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guilds g
    where g.id = p_guild_id
      and g.owner_user_id is not null
      and not public.has_active_premium(g.owner_user_id)
  );
$$;

comment on function public.guild_is_frozen(uuid) is
  'True when the account holding this listing has no active Premium. Admin-created guilds (no owner) never freeze.';

revoke all on function public.guild_is_frozen(uuid) from public;
grant execute on function public.guild_is_frozen(uuid) to anon, authenticated;

/** Every frozen guild at once, so a list page asks one question, not thirty. */
create or replace function public.frozen_guild_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.guilds g
  where g.owner_user_id is not null
    and not public.has_active_premium(g.owner_user_id)
$$;

revoke all on function public.frozen_guild_ids() from public;
grant execute on function public.frozen_guild_ids() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- the guard
-- ---------------------------------------------------------------------------

create or replace function public.guard_guild_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec       record;
  row_json  jsonb;
  target    uuid;
  partner   uuid;
begin
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;

  -- Admins keep working on a frozen guild; that is how it gets unstuck.
  if public.current_site_role() = 'admin' then
    return rec;
  end if;

  row_json := to_jsonb(rec);

  -- Walking out is always allowed: your own row, on its way to rejected.
  if tg_table_name = 'guild_memberships'
     and (row_json ->> 'user_id')::uuid = auth.uid()
     and (tg_op = 'DELETE' or row_json ->> 'status' = 'rejected')
  then
    return rec;
  end if;

  -- The listing's own account may still hand the guild on or take it down.
  if tg_table_name = 'guilds' and public.owns_guild_listing((row_json ->> 'id')::uuid) then
    return rec;
  end if;

  target := coalesce(
    (row_json ->> 'guild_id')::uuid,
    (row_json ->> 'owner_guild_id')::uuid,
    (row_json ->> 'from_guild_id')::uuid,
    (row_json ->> 'id')::uuid
  );
  partner := (row_json ->> 'to_guild_id')::uuid;

  -- A shared board is frozen when either side is.
  if row_json ? 'alliance_id' then
    select a.from_guild_id, a.to_guild_id into target, partner
    from public.guild_alliances a
    where a.id = (row_json ->> 'alliance_id')::uuid;
  end if;

  if (target is not null and public.guild_is_frozen(target))
     or (partner is not null and public.guild_is_frozen(partner))
  then
    raise exception 'This guild is frozen because its Premium has run out'
      using errcode = 'insufficient_privilege';
  end if;

  return rec;
end;
$$;

comment on function public.guard_guild_write() is
  'Blocks writes to a frozen guild. Reads are untouched; leaving a guild always passes.';

-- ---------------------------------------------------------------------------
-- attach it
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  guild_tables text[] := array[
    'guild_memberships',
    'guild_posts',
    'guild_active_events',
    'guild_event_days',
    'guild_event_pledges',
    'guild_event_camps',
    'guild_event_orders',
    'guild_event_hexes',
    'guild_event_settlements',
    'guild_alliances',
    'guild_alliance_camps',
    'guild_alliance_orders',
    'guild_alliance_hexes',
    'guild_alliance_settlements'
  ];
begin
  foreach t in array guild_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop trigger if exists guard_frozen_guild on public.%I', t);
    execute format(
      'create trigger guard_frozen_guild
         before insert or update or delete on public.%I
         for each row execute function public.guard_guild_write()', t);
  end loop;
end;
$$;

-- `guilds` itself: only an update is guarded. A delete is how the owner takes
-- a frozen listing down, and an insert is admin-only anyway.
drop trigger if exists guard_frozen_guild on public.guilds;
create trigger guard_frozen_guild
  before update on public.guilds
  for each row execute function public.guard_guild_write();
