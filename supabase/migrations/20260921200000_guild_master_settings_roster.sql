-- Masters may edit name / server / icon; members may see the active roster.
-- Slug and master Discord ID stay admin-only via trigger.

-- ---------------------------------------------------------------------------
-- guild updates: admins or guild masters
-- ---------------------------------------------------------------------------

drop policy if exists "Only admins can update guilds" on public.guilds;

create policy "Admins or masters can update guilds"
  on public.guilds for update to authenticated
  using (
    public.current_site_role() = 'admin'
    or public.is_guild_master(id)
  )
  with check (
    public.current_site_role() = 'admin'
    or public.is_guild_master(id)
  );

create or replace function public.guilds_guard_protected_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_site_role() = 'admin' then
    return new;
  end if;
  if new.slug is distinct from old.slug
     or new.master_discord_user_id is distinct from old.master_discord_user_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Only site admins can change slug, master, or ownership fields';
  end if;
  return new;
end;
$$;

drop trigger if exists guilds_guard_protected_columns on public.guilds;
create trigger guilds_guard_protected_columns
  before update on public.guilds
  for each row
  execute function public.guilds_guard_protected_columns();

-- ---------------------------------------------------------------------------
-- memberships: active members see the roster of their guild
-- ---------------------------------------------------------------------------

drop policy if exists "Members see own membership rows; masters and admins see their guild"
  on public.guild_memberships;

create policy "Own rows, or whole guild when member/master"
  on public.guild_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_guild_member(guild_id)
  );

-- ---------------------------------------------------------------------------
-- roster helper (includes master even without a membership row)
-- ---------------------------------------------------------------------------

create or replace function public.guild_roster(p_guild_id uuid)
returns table (
  user_id uuid,
  discord_user_id text,
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

revoke all on function public.guild_roster(uuid) from public, anon;
grant execute on function public.guild_roster(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- storage: masters may manage their guild folder
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can upload guild icons" on storage.objects;
drop policy if exists "Admins can update guild icons" on storage.objects;
drop policy if exists "Admins can delete guild icons" on storage.objects;

create policy "Admins or masters can upload guild icons"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'guild-icons'
    and (
      public.current_site_role() = 'admin'
      or public.is_guild_master((split_part(name, '/', 1))::uuid)
    )
  );

create policy "Admins or masters can update guild icons"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'guild-icons'
    and (
      public.current_site_role() = 'admin'
      or public.is_guild_master((split_part(name, '/', 1))::uuid)
    )
  )
  with check (
    bucket_id = 'guild-icons'
    and (
      public.current_site_role() = 'admin'
      or public.is_guild_master((split_part(name, '/', 1))::uuid)
    )
  );

create policy "Admins or masters can delete guild icons"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'guild-icons'
    and (
      public.current_site_role() = 'admin'
      or public.is_guild_master((split_part(name, '/', 1))::uuid)
    )
  );
