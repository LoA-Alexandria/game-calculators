alter table public.benben_state add column instance_id text;
update public.benben_state set instance_id = 'web:community';
alter table public.benben_state alter column instance_id set not null;
alter table public.benben_state drop constraint benben_state_pkey;
alter table public.benben_state drop column singleton;
alter table public.benben_state add primary key (instance_id);

alter table public.benben_actions
  add column instance_id text not null default 'web:community';
drop index public.benben_actions_user_day_idx;
create index benben_actions_instance_user_day_idx
  on public.benben_actions (instance_id, user_id, created_at desc);
create index benben_actions_instance_recent_idx
  on public.benben_actions (instance_id, created_at desc);

drop function public.get_benben_state();
drop function public.care_for_benben(text);

create or replace function public.get_benben_state(p_instance_id text default 'web:community') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pet public.benben_state%rowtype; decay_steps integer := 0; used_today integer := 0;
begin
  select * into pet from public.benben_state where instance_id = p_instance_id;
  if not found then
    return jsonb_build_object(
      'fed', 72, 'happy', 76, 'polished', 68, 'rested', 80,
      'total_actions', 0, 'community_streak', 0, 'phoenix_active', false,
      'phoenix_leaves_at', null, 'actions_left', 3, 'updated_at', null);
  end if;
  decay_steps := greatest(0, floor(extract(epoch from (now() - pet.updated_at)) / 21600)::integer);
  if auth.uid() is not null then
    select count(*)::integer into used_today from public.benben_actions
    where instance_id = p_instance_id and user_id = auth.uid()
      and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  end if;
  return jsonb_build_object(
    'fed', greatest(0, pet.fed - decay_steps * 2), 'happy', greatest(0, pet.happy - decay_steps),
    'polished', greatest(0, pet.polished - decay_steps), 'rested', greatest(0, pet.rested - decay_steps),
    'total_actions', pet.total_actions, 'community_streak', pet.community_streak,
    'phoenix_active', coalesce(pet.phoenix_leaves_at > now(), false),
    'phoenix_leaves_at', case when pet.phoenix_leaves_at > now() then pet.phoenix_leaves_at else null end,
    'actions_left', greatest(0, 3 - used_today), 'updated_at', pet.updated_at);
end; $$;

create or replace function public.care_for_benben_instance(
  p_action text,
  p_instance_id text,
  p_user_id uuid,
  p_caretaker text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pet public.benben_state%rowtype; today date := (now() at time zone 'utc')::date;
  used_today integer; decay_steps integer;
begin
  if p_user_id is null then raise exception 'Sign in to care for Benben'; end if;
  if p_action not in ('feed', 'polish', 'play', 'rest') then raise exception 'Unknown care action'; end if;
  if p_instance_id is null or length(p_instance_id) > 160 then raise exception 'Invalid Benben instance'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_instance_id || ':' || p_user_id::text, 0));
  select count(*)::integer into used_today from public.benben_actions
    where instance_id = p_instance_id and user_id = p_user_id
      and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if used_today >= 3 then raise exception 'Daily care limit reached'; end if;

  insert into public.benben_state (instance_id) values (p_instance_id) on conflict do nothing;
  select * into pet from public.benben_state where instance_id = p_instance_id for update;
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
  update public.benben_state set fed = pet.fed, happy = pet.happy, polished = pet.polished, rested = pet.rested,
    total_actions = pet.total_actions + 1, community_streak = pet.community_streak,
    solar_charge = pet.solar_charge, solar_goal = pet.solar_goal,
    phoenix_arrived_at = pet.phoenix_arrived_at, phoenix_leaves_at = pet.phoenix_leaves_at,
    last_active_date = today, updated_at = now() where instance_id = p_instance_id;
  insert into public.benben_actions (user_id, caretaker_name, action, instance_id)
    values (p_user_id, left(coalesce(nullif(p_caretaker, ''), 'A caretaker'), 80), p_action, p_instance_id);
  return public.get_benben_state(p_instance_id);
end; $$;

create or replace function public.care_for_benben(p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare caretaker text;
begin
  if auth.uid() is null then raise exception 'Sign in to care for Benben'; end if;
  caretaker := coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', 'A caretaker');
  return public.care_for_benben_instance(p_action, 'web:community', auth.uid(), caretaker);
end; $$;

revoke all on function public.get_benben_state(text) from public;
revoke all on function public.care_for_benben(text) from public;
revoke all on function public.care_for_benben_instance(text, text, uuid, text) from public;
grant execute on function public.get_benben_state(text) to anon, authenticated;
grant execute on function public.care_for_benben(text) to authenticated;
grant execute on function public.care_for_benben_instance(text, text, uuid, text) to service_role;
