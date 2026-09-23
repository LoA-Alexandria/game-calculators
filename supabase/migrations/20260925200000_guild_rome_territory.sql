-- Dawn of Rome territory: sparse painted hexes and capturable neutral settlements.
--
-- Hundreds of hexes stay off the wire until someone paints them. Settlements are
-- the white-label cities and villages on the map — neutral until a guild claims
-- them (owner_guild_id null). The six outer bases stay in guild_event_camps.

-- ---------------------------------------------------------------------------
-- guild board
-- ---------------------------------------------------------------------------

create table if not exists public.guild_event_hexes (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_id text not null check (event_id in (
    'trials-of-odin',
    'dawn-of-rome',
    'heart-of-gold',
    'spring-returns'
  )),
  day_index smallint not null check (day_index between 1 and 7),
  q smallint not null check (q between -128 and 128),
  r smallint not null check (r between -128 and 128),
  owner_guild_id uuid not null references public.guilds(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (guild_id, event_id, day_index, q, r)
);

comment on table public.guild_event_hexes is
  'Sparse painted hexes on a guild siege day. Clear a hex by deleting its row.';

create index if not exists guild_event_hexes_day_idx
  on public.guild_event_hexes (guild_id, event_id, day_index);

alter table public.guild_event_hexes enable row level security;
revoke all on table public.guild_event_hexes from anon, authenticated;
grant select, insert, update, delete on table public.guild_event_hexes to authenticated;

create policy "Members can read guild event hexes"
  on public.guild_event_hexes for select to authenticated
  using (public.is_guild_member(guild_id));

create policy "Officers can insert guild event hexes"
  on public.guild_event_hexes for insert to authenticated
  with check (public.is_guild_officer(guild_id));

create policy "Officers can update guild event hexes"
  on public.guild_event_hexes for update to authenticated
  using (public.is_guild_officer(guild_id))
  with check (public.is_guild_officer(guild_id));

create policy "Officers can delete guild event hexes"
  on public.guild_event_hexes for delete to authenticated
  using (public.is_guild_officer(guild_id));

create table if not exists public.guild_event_settlements (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_id text not null check (event_id in (
    'trials-of-odin',
    'dawn-of-rome',
    'heart-of-gold',
    'spring-returns'
  )),
  day_index smallint not null check (day_index between 1 and 7),
  settlement_id text not null check (char_length(settlement_id) between 1 and 40),
  -- null = still neutral; a guild id means that guild holds it.
  owner_guild_id uuid references public.guilds(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (guild_id, event_id, day_index, settlement_id)
);

comment on table public.guild_event_settlements is
  'Capturable neutral settlements on a guild siege day. Null owner is neutral.';

create index if not exists guild_event_settlements_day_idx
  on public.guild_event_settlements (guild_id, event_id, day_index);

alter table public.guild_event_settlements enable row level security;
revoke all on table public.guild_event_settlements from anon, authenticated;
grant select, insert, update, delete on table public.guild_event_settlements to authenticated;

create policy "Members can read guild event settlements"
  on public.guild_event_settlements for select to authenticated
  using (public.is_guild_member(guild_id));

create policy "Officers can insert guild event settlements"
  on public.guild_event_settlements for insert to authenticated
  with check (public.is_guild_officer(guild_id));

create policy "Officers can update guild event settlements"
  on public.guild_event_settlements for update to authenticated
  using (public.is_guild_officer(guild_id))
  with check (public.is_guild_officer(guild_id));

create policy "Officers can delete guild event settlements"
  on public.guild_event_settlements for delete to authenticated
  using (public.is_guild_officer(guild_id));

-- ---------------------------------------------------------------------------
-- shared alliance board
-- ---------------------------------------------------------------------------

create table if not exists public.guild_alliance_hexes (
  alliance_id uuid not null references public.guild_alliances(id) on delete cascade,
  day_index smallint not null check (day_index between 1 and 7),
  q smallint not null check (q between -128 and 128),
  r smallint not null check (r between -128 and 128),
  owner_guild_id uuid not null references public.guilds(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (alliance_id, day_index, q, r)
);

comment on table public.guild_alliance_hexes is
  'Sparse painted hexes on a shared alliance siege day.';

alter table public.guild_alliance_hexes enable row level security;
revoke all on table public.guild_alliance_hexes from anon, authenticated;
grant select, insert, update, delete on table public.guild_alliance_hexes to authenticated;

create policy "Allied members can read shared hexes"
  on public.guild_alliance_hexes for select to authenticated
  using (public.is_alliance_member(alliance_id));

create policy "Allied officers can insert shared hexes"
  on public.guild_alliance_hexes for insert to authenticated
  with check (public.is_alliance_officer(alliance_id));

create policy "Allied officers can update shared hexes"
  on public.guild_alliance_hexes for update to authenticated
  using (public.is_alliance_officer(alliance_id))
  with check (public.is_alliance_officer(alliance_id));

create policy "Allied officers can delete shared hexes"
  on public.guild_alliance_hexes for delete to authenticated
  using (public.is_alliance_officer(alliance_id));

create table if not exists public.guild_alliance_settlements (
  alliance_id uuid not null references public.guild_alliances(id) on delete cascade,
  day_index smallint not null check (day_index between 1 and 7),
  settlement_id text not null check (char_length(settlement_id) between 1 and 40),
  owner_guild_id uuid references public.guilds(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (alliance_id, day_index, settlement_id)
);

comment on table public.guild_alliance_settlements is
  'Capturable settlements on a shared alliance siege day. Null owner is neutral.';

alter table public.guild_alliance_settlements enable row level security;
revoke all on table public.guild_alliance_settlements from anon, authenticated;
grant select, insert, update, delete on table public.guild_alliance_settlements to authenticated;

create policy "Allied members can read shared settlements"
  on public.guild_alliance_settlements for select to authenticated
  using (public.is_alliance_member(alliance_id));

create policy "Allied officers can insert shared settlements"
  on public.guild_alliance_settlements for insert to authenticated
  with check (public.is_alliance_officer(alliance_id));

create policy "Allied officers can update shared settlements"
  on public.guild_alliance_settlements for update to authenticated
  using (public.is_alliance_officer(alliance_id))
  with check (public.is_alliance_officer(alliance_id));

create policy "Allied officers can delete shared settlements"
  on public.guild_alliance_settlements for delete to authenticated
  using (public.is_alliance_officer(alliance_id));

-- ---------------------------------------------------------------------------
-- ending an event also clears territory
-- ---------------------------------------------------------------------------

create or replace function public.end_guild_event(
  p_guild_id uuid,
  p_event_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_id not in ('trials-of-odin', 'dawn-of-rome', 'heart-of-gold', 'spring-returns') then
    raise exception 'Unknown event';
  end if;

  if not public.is_guild_officer(p_guild_id) then
    raise exception 'Only an officer can end an event';
  end if;

  delete from public.guild_alliances
  where event_id = p_event_id
    and (from_guild_id = p_guild_id or to_guild_id = p_guild_id);

  delete from public.guild_event_settlements where guild_id = p_guild_id and event_id = p_event_id;
  delete from public.guild_event_hexes where guild_id = p_guild_id and event_id = p_event_id;
  delete from public.guild_event_orders where guild_id = p_guild_id and event_id = p_event_id;
  delete from public.guild_event_camps where guild_id = p_guild_id and event_id = p_event_id;
  delete from public.guild_event_pledges where guild_id = p_guild_id and event_id = p_event_id;
  delete from public.guild_event_days where guild_id = p_guild_id and event_id = p_event_id;
  delete from public.guild_active_events where guild_id = p_guild_id and event_id = p_event_id;
end;
$$;

revoke all on function public.end_guild_event(uuid, text) from public, anon;
grant execute on function public.end_guild_event(uuid, text) to authenticated;
