-- Officers + guild planning events (active set, day scores, end-invest pledges).

-- ---------------------------------------------------------------------------
-- membership role
-- ---------------------------------------------------------------------------

alter table public.guild_memberships
  add column if not exists role text not null default 'member'
  constraint guild_memberships_role_check check (role in ('member', 'officer'));

comment on column public.guild_memberships.role is
  'member or officer. Guild master is identified via guilds.master_discord_user_id.';

create or replace function public.is_guild_officer(p_guild_id uuid)
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
        and m.role = 'officer'
    )
$$;

revoke all on function public.is_guild_officer(uuid) from public, anon;
grant execute on function public.is_guild_officer(uuid) to authenticated;

-- Masters promote / demote officers without letting them self-elevate via UPDATE.
create or replace function public.set_guild_member_role(
  p_guild_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role not in ('member', 'officer') then
    raise exception 'Invalid role';
  end if;
  if not public.is_guild_master(p_guild_id) then
    raise exception 'Only the guild master can change roles';
  end if;
  if p_user_id = auth.uid() and not (
    public.current_site_role() = 'admin'
  ) then
    -- Masters may demote themselves from officer if they somehow have a row,
    -- but promotion of self is meaningless; allow either for simplicity when master.
    null;
  end if;

  update public.guild_memberships
  set role = p_role
  where guild_id = p_guild_id
    and user_id = p_user_id
    and status = 'active';

  if not found then
    raise exception 'No active membership for that user';
  end if;
end;
$$;

revoke all on function public.set_guild_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_guild_member_role(uuid, uuid, text) to authenticated;

-- Posts: officers may write
drop policy if exists "Masters and admins can create guild posts" on public.guild_posts;
drop policy if exists "Masters and admins can update guild posts" on public.guild_posts;
drop policy if exists "Masters and admins can delete guild posts" on public.guild_posts;

create policy "Officers can create guild posts"
  on public.guild_posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_guild_officer(guild_id)
  );

create policy "Officers can update guild posts"
  on public.guild_posts for update to authenticated
  using (public.is_guild_officer(guild_id))
  with check (public.is_guild_officer(guild_id));

create policy "Officers can delete guild posts"
  on public.guild_posts for delete to authenticated
  using (public.is_guild_officer(guild_id));

-- Join decisions: officers may accept / decline
drop policy if exists "Self re-apply/leave or master/admin decide" on public.guild_memberships;

create policy "Self re-apply/leave or officer decide"
  on public.guild_memberships for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_guild_officer(guild_id)
  )
  with check (
    (
      user_id = auth.uid()
      and status in ('pending', 'rejected')
    )
    or (
      public.is_guild_officer(guild_id)
      and status in ('pending', 'active', 'rejected')
    )
  );

-- ---------------------------------------------------------------------------
-- active events
-- ---------------------------------------------------------------------------

create table if not exists public.guild_active_events (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_id text not null check (event_id in (
    'trials-of-odin',
    'dawn-of-rome',
    'heart-of-gold',
    'spring-returns'
  )),
  activated_at timestamptz not null default now(),
  activated_by uuid references auth.users(id) on delete set null,
  primary key (guild_id, event_id)
);

comment on table public.guild_active_events is
  'Which planning events a guild has turned on.';

alter table public.guild_active_events enable row level security;
revoke all on table public.guild_active_events from anon, authenticated;
grant select, insert, delete on table public.guild_active_events to authenticated;

create policy "Members can read active guild events"
  on public.guild_active_events for select to authenticated
  using (public.is_guild_member(guild_id));

create policy "Officers can activate guild events"
  on public.guild_active_events for insert to authenticated
  with check (public.is_guild_officer(guild_id));

create policy "Officers can deactivate guild events"
  on public.guild_active_events for delete to authenticated
  using (public.is_guild_officer(guild_id));

-- ---------------------------------------------------------------------------
-- event days (scores + call note)
-- ---------------------------------------------------------------------------

create table if not exists public.guild_event_days (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_id text not null check (event_id in (
    'trials-of-odin',
    'dawn-of-rome',
    'heart-of-gold',
    'spring-returns'
  )),
  day_index smallint not null check (day_index between 1 and 7),
  our_score bigint not null default 0 check (our_score >= 0),
  enemy_score bigint not null default 0 check (enemy_score >= 0),
  result text not null default 'pending' check (result in ('pending', 'won', 'lost')),
  call_note text not null default '' check (char_length(call_note) <= 280),
  updated_at timestamptz not null default now(),
  unique (guild_id, event_id, day_index)
);

comment on table public.guild_event_days is
  'Per-day live scores and win/loss for an active guild planning event.';

create index if not exists guild_event_days_guild_event_idx
  on public.guild_event_days (guild_id, event_id);

alter table public.guild_event_days enable row level security;
revoke all on table public.guild_event_days from anon, authenticated;
grant select, insert, update on table public.guild_event_days to authenticated;

create policy "Members can read guild event days"
  on public.guild_event_days for select to authenticated
  using (public.is_guild_member(guild_id));

create policy "Officers can insert guild event days"
  on public.guild_event_days for insert to authenticated
  with check (public.is_guild_officer(guild_id));

create policy "Officers can update guild event days"
  on public.guild_event_days for update to authenticated
  using (public.is_guild_officer(guild_id))
  with check (public.is_guild_officer(guild_id));

-- ---------------------------------------------------------------------------
-- end-invest pledges
-- ---------------------------------------------------------------------------

create table if not exists public.guild_event_pledges (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_id text not null check (event_id in (
    'trials-of-odin',
    'dawn-of-rome',
    'heart-of-gold',
    'spring-returns'
  )),
  day_index smallint not null check (day_index between 1 and 7),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null default 0 check (amount >= 0),
  status text not null default 'waiting' check (status in ('ready', 'waiting', 'spent')),
  updated_at timestamptz not null default now(),
  primary key (guild_id, event_id, day_index, user_id)
);

comment on table public.guild_event_pledges is
  'How many points a member can still dump near day end.';

create index if not exists guild_event_pledges_day_idx
  on public.guild_event_pledges (guild_id, event_id, day_index);

alter table public.guild_event_pledges enable row level security;
revoke all on table public.guild_event_pledges from anon, authenticated;
grant select, insert, update, delete on table public.guild_event_pledges to authenticated;

create policy "Members can read guild event pledges"
  on public.guild_event_pledges for select to authenticated
  using (public.is_guild_member(guild_id));

create policy "Members upsert own pledges"
  on public.guild_event_pledges for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_guild_member(guild_id)
  );

create policy "Members update own pledges; officers may update any"
  on public.guild_event_pledges for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_guild_officer(guild_id)
  )
  with check (
    user_id = auth.uid()
    or public.is_guild_officer(guild_id)
  );

create policy "Members delete own pledges"
  on public.guild_event_pledges for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_guild_officer(guild_id)
  );

-- ---------------------------------------------------------------------------
-- roster: include is_officer
-- ---------------------------------------------------------------------------

drop function if exists public.guild_roster(uuid);

create or replace function public.guild_roster(p_guild_id uuid)
returns table (
  user_id uuid,
  discord_user_id text,
  display_name text,
  status text,
  is_master boolean,
  is_officer boolean,
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
      (m.role = 'officer') as is_officer,
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
      false as is_officer,
      guild.created_at as requested_at
    from guild
    left join public.editor_access ea on ea.discord_user_id = guild.master_discord_user_id
    where (select allowed from gate)
      and not exists (select 1 from active_members where is_master)
  )
  select * from active_members
  union all
  select * from master_only
  order by is_master desc, is_officer desc, requested_at asc;
$$;

revoke all on function public.guild_roster(uuid) from public, anon;
grant execute on function public.guild_roster(uuid) to authenticated;
