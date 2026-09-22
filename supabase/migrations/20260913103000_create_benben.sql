create table public.benben_state (
  singleton boolean primary key default true check (singleton),
  fed smallint not null default 72 check (fed between 0 and 100),
  happy smallint not null default 76 check (happy between 0 and 100),
  polished smallint not null default 68 check (polished between 0 and 100),
  rested smallint not null default 80 check (rested between 0 and 100),
  total_actions bigint not null default 0,
  community_streak integer not null default 0,
  solar_charge integer not null default 0 check (solar_charge >= 0),
  solar_goal integer not null default 30 check (solar_goal between 25 and 35),
  phoenix_arrived_at timestamptz,
  phoenix_leaves_at timestamptz,
  last_active_date date,
  updated_at timestamptz not null default now()
);

insert into public.benben_state (singleton) values (true) on conflict do nothing;

create table public.benben_actions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  caretaker_name text not null,
  action text not null check (action in ('feed', 'polish', 'play', 'rest')),
  created_at timestamptz not null default now()
);
create index benben_actions_user_day_idx on public.benben_actions (user_id, created_at desc);

alter table public.benben_state enable row level security;
alter table public.benben_actions enable row level security;
revoke all on public.benben_state, public.benben_actions from anon, authenticated;
grant select on public.benben_state, public.benben_actions to anon, authenticated;
create policy "Everyone can see Benben" on public.benben_state for select to anon, authenticated using (true);
create policy "Everyone can see recent Benben care" on public.benben_actions for select to anon, authenticated using (true);

create or replace function public.get_benben_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pet public.benben_state%rowtype; decay_steps integer; used_today integer := 0;
begin
  select * into pet from public.benben_state where singleton;
  decay_steps := greatest(0, floor(extract(epoch from (now() - pet.updated_at)) / 21600)::integer);
  if auth.uid() is not null then
    select count(*)::integer into used_today from public.benben_actions
    where user_id = auth.uid() and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  end if;
  return jsonb_build_object(
    'fed', greatest(0, pet.fed - decay_steps * 2), 'happy', greatest(0, pet.happy - decay_steps),
    'polished', greatest(0, pet.polished - decay_steps), 'rested', greatest(0, pet.rested - decay_steps),
    'total_actions', pet.total_actions, 'community_streak', pet.community_streak,
    'phoenix_active', coalesce(pet.phoenix_leaves_at > now(), false),
    'phoenix_leaves_at', case when pet.phoenix_leaves_at > now() then pet.phoenix_leaves_at else null end,
    'actions_left', greatest(0, 3 - used_today), 'updated_at', pet.updated_at);
end; $$;

create or replace function public.care_for_benben(p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pet public.benben_state%rowtype; today date := (now() at time zone 'utc')::date;
  used_today integer; decay_steps integer; caretaker text;
begin
  if auth.uid() is null then raise exception 'Sign in to care for Benben'; end if;
  if p_action not in ('feed', 'polish', 'play', 'rest') then raise exception 'Unknown care action'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select count(*)::integer into used_today from public.benben_actions
    where user_id = auth.uid() and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if used_today >= 3 then raise exception 'Daily care limit reached'; end if;

  select * into pet from public.benben_state where singleton for update;
  decay_steps := greatest(0, floor(extract(epoch from (now() - pet.updated_at)) / 21600)::integer);
  pet.fed := greatest(0, pet.fed - decay_steps * 2); pet.happy := greatest(0, pet.happy - decay_steps);
  pet.polished := greatest(0, pet.polished - decay_steps); pet.rested := greatest(0, pet.rested - decay_steps);
  if pet.phoenix_leaves_at is not null and pet.phoenix_leaves_at <= now() then
    pet.phoenix_arrived_at := null; pet.phoenix_leaves_at := null;
  end if;
  if p_action = 'feed' then pet.fed := least(100, pet.fed + 14); pet.rested := least(100, pet.rested + 2);
  elsif p_action = 'polish' then pet.polished := least(100, pet.polished + 15); pet.happy := least(100, pet.happy + 2);
  elsif p_action = 'play' then
    pet.happy := least(100, pet.happy + 14); pet.rested := greatest(0, pet.rested - 4); pet.fed := greatest(0, pet.fed - 2);
    if pet.phoenix_leaves_at is null then
      pet.solar_charge := pet.solar_charge + 1;
      if pet.solar_charge >= pet.solar_goal then
        pet.phoenix_arrived_at := now(); pet.phoenix_leaves_at := now() + interval '24 hours';
        pet.solar_charge := 0; pet.solar_goal := 25 + floor(random() * 11)::integer;
      end if;
    end if;
  else pet.rested := least(100, pet.rested + 15); pet.fed := greatest(0, pet.fed - 2); end if;

  if pet.last_active_date is null then pet.community_streak := 1;
  elsif pet.last_active_date = today - 1 then pet.community_streak := pet.community_streak + 1;
  elsif pet.last_active_date < today - 1 then pet.community_streak := 1; end if;
  caretaker := coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', 'A caretaker');
  update public.benben_state set fed = pet.fed, happy = pet.happy, polished = pet.polished, rested = pet.rested,
    total_actions = pet.total_actions + 1, community_streak = pet.community_streak,
    solar_charge = pet.solar_charge, solar_goal = pet.solar_goal,
    phoenix_arrived_at = pet.phoenix_arrived_at, phoenix_leaves_at = pet.phoenix_leaves_at,
    last_active_date = today, updated_at = now() where singleton;
  insert into public.benben_actions (user_id, caretaker_name, action) values (auth.uid(), left(caretaker, 80), p_action);
  return public.get_benben_state();
end; $$;

revoke all on function public.get_benben_state() from public;
revoke all on function public.care_for_benben(text) from public;
grant execute on function public.get_benben_state() to anon, authenticated;
grant execute on function public.care_for_benben(text) to authenticated;
grant all on public.benben_state, public.benben_actions to service_role;
grant usage, select on sequence public.benben_actions_id_seq to service_role;
alter publication supabase_realtime add table public.benben_state;
alter publication supabase_realtime add table public.benben_actions;
