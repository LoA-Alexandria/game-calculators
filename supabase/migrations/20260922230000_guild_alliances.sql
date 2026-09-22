-- Alliances between two guilds for one event, plus the siege board they share.
--
-- An officer of one guild offers; an officer of the invited guild accepts. Only
-- while the alliance is accepted may either side read or write the shared plan,
-- and nothing here opens a guild's own board to the partner.

create table if not exists public.guild_alliances (
  id uuid primary key default gen_random_uuid(),
  event_id text not null check (event_id in (
    'trials-of-odin',
    'dawn-of-rome',
    'heart-of-gold',
    'spring-returns'
  )),
  from_guild_id uuid not null references public.guilds(id) on delete cascade,
  to_guild_id uuid not null references public.guilds(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  note text not null default '' check (char_length(note) <= 280),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  constraint guild_alliances_two_guilds check (from_guild_id <> to_guild_id)
);

comment on table public.guild_alliances is
  'An alliance offer between two guilds for one planning event. Accepted alliances share a siege board.';

-- One live offer or alliance per pair and event, whichever guild asked first.
create unique index if not exists guild_alliances_pair_idx
  on public.guild_alliances (
    event_id,
    least(from_guild_id, to_guild_id),
    greatest(from_guild_id, to_guild_id)
  )
  where status <> 'declined';

create index if not exists guild_alliances_from_idx on public.guild_alliances (from_guild_id, event_id);
create index if not exists guild_alliances_to_idx on public.guild_alliances (to_guild_id, event_id);

alter table public.guild_alliances enable row level security;
revoke all on table public.guild_alliances from anon, authenticated;
grant select, insert, delete on table public.guild_alliances to authenticated;

-- Both sides see the offer; the answer goes through respond_to_guild_alliance.
create policy "Both guilds can read their alliances"
  on public.guild_alliances for select to authenticated
  using (
    public.is_guild_member(from_guild_id)
    or public.is_guild_member(to_guild_id)
  );

create policy "Officers can offer an alliance"
  on public.guild_alliances for insert to authenticated
  with check (
    created_by = auth.uid()
    and status = 'pending'
    and public.is_guild_officer(from_guild_id)
  );

-- Withdrawing an offer or ending an alliance drops the shared board with it.
create policy "Officers of either guild can end an alliance"
  on public.guild_alliances for delete to authenticated
  using (
    public.is_guild_officer(from_guild_id)
    or public.is_guild_officer(to_guild_id)
  );

-- Only the invited guild answers, so nobody accepts their own offer.
create or replace function public.respond_to_guild_alliance(
  p_alliance_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to_guild uuid;
begin
  if p_status not in ('accepted', 'declined') then
    raise exception 'Invalid alliance answer';
  end if;

  select to_guild_id into v_to_guild
  from public.guild_alliances
  where id = p_alliance_id
    and status = 'pending';

  if v_to_guild is null then
    raise exception 'No open alliance offer';
  end if;

  if not public.is_guild_officer(v_to_guild) then
    raise exception 'Only an officer of the invited guild can answer';
  end if;

  update public.guild_alliances
  set status = p_status,
      decided_at = now(),
      decided_by = auth.uid()
  where id = p_alliance_id;
end;
$$;

revoke all on function public.respond_to_guild_alliance(uuid, text) from public, anon;
grant execute on function public.respond_to_guild_alliance(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- who may touch the shared board
-- ---------------------------------------------------------------------------

create or replace function public.is_alliance_member(p_alliance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guild_alliances a
    where a.id = p_alliance_id
      and a.status = 'accepted'
      and (
        public.is_guild_member(a.from_guild_id)
        or public.is_guild_member(a.to_guild_id)
      )
  )
$$;

revoke all on function public.is_alliance_member(uuid) from public, anon;
grant execute on function public.is_alliance_member(uuid) to authenticated;

create or replace function public.is_alliance_officer(p_alliance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guild_alliances a
    where a.id = p_alliance_id
      and a.status = 'accepted'
      and (
        public.is_guild_officer(a.from_guild_id)
        or public.is_guild_officer(a.to_guild_id)
      )
  )
$$;

revoke all on function public.is_alliance_officer(uuid) from public, anon;
grant execute on function public.is_alliance_officer(uuid) to authenticated;

-- Both guilds' active members in one list, so the shared board can name them.
create or replace function public.alliance_roster(p_alliance_id uuid)
returns table (
  user_id uuid,
  discord_user_id text,
  display_name text,
  status text,
  is_master boolean,
  is_officer boolean,
  requested_at timestamptz,
  guild_id uuid,
  guild_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select public.is_alliance_member(p_alliance_id) as ok
  ),
  sides as (
    select g.id, g.name, g.master_discord_user_id
    from public.guild_alliances a
    join public.guilds g on g.id in (a.from_guild_id, a.to_guild_id)
    where a.id = p_alliance_id
      and a.status = 'accepted'
      and (select ok from allowed)
  )
  select
    m.user_id,
    ea.discord_user_id,
    m.display_name,
    m.status,
    (ea.discord_user_id is not null and ea.discord_user_id = sides.master_discord_user_id) as is_master,
    (m.role = 'officer') as is_officer,
    m.requested_at,
    sides.id as guild_id,
    sides.name as guild_name
  from sides
  join public.guild_memberships m on m.guild_id = sides.id and m.status = 'active'
  left join public.editor_access ea on ea.user_id = m.user_id
  order by sides.name asc, is_master desc, is_officer desc, m.requested_at asc;
$$;

revoke all on function public.alliance_roster(uuid) from public, anon;
grant execute on function public.alliance_roster(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- the shared siege board
-- ---------------------------------------------------------------------------

create table if not exists public.guild_alliance_camps (
  alliance_id uuid not null references public.guild_alliances(id) on delete cascade,
  day_index smallint not null check (day_index between 1 and 7),
  slot smallint not null check (slot between 1 and 6),
  name text not null default '' check (char_length(name) <= 60),
  server_name text not null default '' check (char_length(server_name) <= 40),
  -- Both allied guilds hold a camp, so more than one may be friendly here.
  is_ours boolean not null default false,
  priority smallint not null default 0 check (priority between 0 and 6),
  note text not null default '' check (char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (alliance_id, day_index, slot)
);

comment on table public.guild_alliance_camps is
  'Shared camp plan of two allied guilds: friendly camps and the order the rest fall in.';

alter table public.guild_alliance_camps enable row level security;
revoke all on table public.guild_alliance_camps from anon, authenticated;
grant select, insert, update, delete on table public.guild_alliance_camps to authenticated;

create policy "Allied members can read the shared camps"
  on public.guild_alliance_camps for select to authenticated
  using (public.is_alliance_member(alliance_id));

create policy "Allied officers can insert shared camps"
  on public.guild_alliance_camps for insert to authenticated
  with check (public.is_alliance_officer(alliance_id));

create policy "Allied officers can update shared camps"
  on public.guild_alliance_camps for update to authenticated
  using (public.is_alliance_officer(alliance_id))
  with check (public.is_alliance_officer(alliance_id));

create policy "Allied officers can delete shared camps"
  on public.guild_alliance_camps for delete to authenticated
  using (public.is_alliance_officer(alliance_id));

create table if not exists public.guild_alliance_orders (
  alliance_id uuid not null references public.guild_alliances(id) on delete cascade,
  day_index smallint not null check (day_index between 1 and 7),
  user_id uuid not null references auth.users(id) on delete cascade,
  rings integer not null default 0 check (rings between 0 and 9999),
  horns integer not null default 0 check (horns between 0 and 999999),
  rings_target smallint not null default 0 check (rings_target between 0 and 6),
  horns_target smallint not null default 0 check (horns_target between 0 and 6),
  attack_target smallint not null default 0 check (attack_target between 0 and 6),
  updated_at timestamptz not null default now(),
  primary key (alliance_id, day_index, user_id)
);

comment on table public.guild_alliance_orders is
  'Rings, horns and attacks each allied member brings to a shared siege day.';

alter table public.guild_alliance_orders enable row level security;
revoke all on table public.guild_alliance_orders from anon, authenticated;
grant select, insert, update, delete on table public.guild_alliance_orders to authenticated;

create policy "Allied members can read the shared orders"
  on public.guild_alliance_orders for select to authenticated
  using (public.is_alliance_member(alliance_id));

create policy "Allied members insert own orders; officers any"
  on public.guild_alliance_orders for insert to authenticated
  with check (
    (user_id = auth.uid() and public.is_alliance_member(alliance_id))
    or public.is_alliance_officer(alliance_id)
  );

create policy "Allied members update own orders; officers any"
  on public.guild_alliance_orders for update to authenticated
  using (user_id = auth.uid() or public.is_alliance_officer(alliance_id))
  with check (
    (user_id = auth.uid() and public.is_alliance_member(alliance_id))
    or public.is_alliance_officer(alliance_id)
  );

create policy "Allied members delete own orders; officers any"
  on public.guild_alliance_orders for delete to authenticated
  using (user_id = auth.uid() or public.is_alliance_officer(alliance_id));
