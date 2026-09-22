-- Siege camps for Trials of Odin: which camp is ours, which enemy camp to hit
-- first, and how many Draupnir Rings and Military Tokens (Horns) to spend where.
--
-- One row per camp position and siege day, so a guild plans each siege on its
-- own. Officers write; every active member reads. Nothing here crosses guilds.

create table if not exists public.guild_event_camps (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_id text not null check (event_id in (
    'trials-of-odin',
    'dawn-of-rome',
    'heart-of-gold',
    'spring-returns'
  )),
  day_index smallint not null check (day_index between 1 and 7),
  -- Position on the map, 1..6; Trials of Odin has five camps around Asgard.
  slot smallint not null check (slot between 1 and 6),
  name text not null default '' check (char_length(name) <= 60),
  server_name text not null default '' check (char_length(server_name) <= 40),
  is_ours boolean not null default false,
  -- 0 means no order yet; 1 is hit first.
  priority smallint not null default 0 check (priority between 0 and 6),
  -- What the map shows above the camp, in percent.
  progress smallint not null default 100 check (progress between 0 and 100),
  rings integer not null default 0 check (rings between 0 and 9999),
  horns integer not null default 0 check (horns between 0 and 999999),
  note text not null default '' check (char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (guild_id, event_id, day_index, slot)
);

comment on table public.guild_event_camps is
  'Per-siege camp plan: our camp, target order, and the rings and horns to spend on each enemy camp.';

create index if not exists guild_event_camps_day_idx
  on public.guild_event_camps (guild_id, event_id, day_index);

alter table public.guild_event_camps enable row level security;
revoke all on table public.guild_event_camps from anon, authenticated;
grant select, insert, update, delete on table public.guild_event_camps to authenticated;

create policy "Members can read guild event camps"
  on public.guild_event_camps for select to authenticated
  using (public.is_guild_member(guild_id));

create policy "Officers can insert guild event camps"
  on public.guild_event_camps for insert to authenticated
  with check (public.is_guild_officer(guild_id));

create policy "Officers can update guild event camps"
  on public.guild_event_camps for update to authenticated
  using (public.is_guild_officer(guild_id))
  with check (public.is_guild_officer(guild_id));

create policy "Officers can delete guild event camps"
  on public.guild_event_camps for delete to authenticated
  using (public.is_guild_officer(guild_id));
