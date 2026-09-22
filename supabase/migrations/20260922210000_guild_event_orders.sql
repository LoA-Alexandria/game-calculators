-- What each member brings to a siege and where the officers send it.
--
-- Members write how many Draupnir Rings and Military Tokens (Horns) they still
-- have. Officers point those, and the member's normal attacks, at one camp or
-- at every camp (target 0). One row per member and siege day.

create table if not exists public.guild_event_orders (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  event_id text not null check (event_id in (
    'trials-of-odin',
    'dawn-of-rome',
    'heart-of-gold',
    'spring-returns'
  )),
  day_index smallint not null check (day_index between 1 and 7),
  user_id uuid not null references auth.users(id) on delete cascade,
  rings integer not null default 0 check (rings between 0 and 9999),
  horns integer not null default 0 check (horns between 0 and 999999),
  -- 0 means every camp / free choice; otherwise the camp slot on the map.
  rings_target smallint not null default 0 check (rings_target between 0 and 6),
  horns_target smallint not null default 0 check (horns_target between 0 and 6),
  attack_target smallint not null default 0 check (attack_target between 0 and 6),
  updated_at timestamptz not null default now(),
  primary key (guild_id, event_id, day_index, user_id)
);

comment on table public.guild_event_orders is
  'Rings and horns a member has for a siege, and the camps an officer sends them and the member''s attacks to.';

create index if not exists guild_event_orders_day_idx
  on public.guild_event_orders (guild_id, event_id, day_index);

alter table public.guild_event_orders enable row level security;
revoke all on table public.guild_event_orders from anon, authenticated;
grant select, insert, update, delete on table public.guild_event_orders to authenticated;

create policy "Members can read guild event orders"
  on public.guild_event_orders for select to authenticated
  using (public.is_guild_member(guild_id));

-- A member opens their own row; officers may open one for anybody in the guild.
create policy "Members insert own orders; officers any"
  on public.guild_event_orders for insert to authenticated
  with check (
    (user_id = auth.uid() and public.is_guild_member(guild_id))
    or public.is_guild_officer(guild_id)
  );

create policy "Members update own orders; officers any"
  on public.guild_event_orders for update to authenticated
  using (user_id = auth.uid() or public.is_guild_officer(guild_id))
  with check (user_id = auth.uid() or public.is_guild_officer(guild_id));

create policy "Members delete own orders; officers any"
  on public.guild_event_orders for delete to authenticated
  using (user_id = auth.uid() or public.is_guild_officer(guild_id));
