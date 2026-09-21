-- Guilds: admin-managed roster, Discord-ID guild master, membership requests.
-- Site stays static; this is the shared store + RLS. Hiding a button is not authz.

-- ---------------------------------------------------------------------------
-- guilds
-- ---------------------------------------------------------------------------

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 48),
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  master_discord_user_id text not null check (master_discord_user_id ~ '^[0-9]{5,32}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.guilds is
  'Community guilds. Master is a Discord snowflake and may be set before that person signs in.';
comment on column public.guilds.master_discord_user_id is
  'Discord user id of the guild master. Matched to editor_access.discord_user_id after sign-in.';

create index if not exists guilds_master_discord_user_id_idx
  on public.guilds (master_discord_user_id);

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------

create table if not exists public.guild_memberships (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'active', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  primary key (guild_id, user_id)
);

comment on table public.guild_memberships is
  'Join requests and membership. At most one pending or active row per user across all guilds.';

-- One open membership (or application) per person site-wide.
create unique index if not exists guild_memberships_one_open_per_user
  on public.guild_memberships (user_id)
  where status in ('pending', 'active');

create index if not exists guild_memberships_guild_status_idx
  on public.guild_memberships (guild_id, status);

-- ---------------------------------------------------------------------------
-- helpers (security definer so policies do not recurse awkwardly)
-- ---------------------------------------------------------------------------

create or replace function public.current_discord_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select discord_user_id from public.editor_access where user_id = auth.uid()
$$;

revoke all on function public.current_discord_user_id() from public, anon;
grant execute on function public.current_discord_user_id() to authenticated;

create or replace function public.is_guild_master(p_guild_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_site_role() = 'admin'
    or exists (
      select 1
      from public.guilds g
      where g.id = p_guild_id
        and g.master_discord_user_id = public.current_discord_user_id()
    )
$$;

revoke all on function public.is_guild_master(uuid) from public, anon;
grant execute on function public.is_guild_master(uuid) to authenticated;

create or replace function public.is_guild_member(p_guild_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_guild_master(p_guild_id)
    or exists (
      select 1
      from public.guild_memberships m
      where m.guild_id = p_guild_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
$$;

revoke all on function public.is_guild_member(uuid) from public, anon;
grant execute on function public.is_guild_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: guilds
-- ---------------------------------------------------------------------------

alter table public.guilds enable row level security;
revoke all on table public.guilds from anon, authenticated;
grant select on table public.guilds to anon, authenticated;
grant insert, update, delete on table public.guilds to authenticated;

create policy "Anyone can read guilds"
  on public.guilds for select
  to anon, authenticated
  using (true);

create policy "Only admins can create guilds"
  on public.guilds for insert to authenticated
  with check (public.current_site_role() = 'admin');

create policy "Only admins can update guilds"
  on public.guilds for update to authenticated
  using (public.current_site_role() = 'admin')
  with check (public.current_site_role() = 'admin');

create policy "Only admins can delete guilds"
  on public.guilds for delete to authenticated
  using (public.current_site_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS: memberships
-- ---------------------------------------------------------------------------

alter table public.guild_memberships enable row level security;
revoke all on table public.guild_memberships from anon, authenticated;
grant select, insert, update on table public.guild_memberships to authenticated;
-- no delete grant for members; admins/masters clear via update or admin delete of guild

create policy "Members see own membership rows; masters and admins see their guild"
  on public.guild_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_guild_master(guild_id)
  );

create policy "Signed-in users may request to join (pending only, self)"
  on public.guild_memberships for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
  );

-- Applicant may re-open a rejected row to pending, or withdraw/leave to rejected.
-- Master/admin may accept or reject (and only those transitions).
create policy "Self re-apply/leave or master/admin decide"
  on public.guild_memberships for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_guild_master(guild_id)
  )
  with check (
    (
      user_id = auth.uid()
      and status in ('pending', 'rejected')
    )
    or (
      public.is_guild_master(guild_id)
      and status in ('pending', 'active', 'rejected')
    )
  );
