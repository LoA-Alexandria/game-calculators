-- Each allied guild holds one village on the shared map.
--
-- The offering guild has to pick its village before it may ask, and the guild
-- that accepts has to pick its own before the shared plan can be used. Both
-- live on the alliance itself, because a village does not move between sieges.

alter table public.guild_alliances
  add column if not exists from_slot smallint,
  add column if not exists to_slot smallint;

comment on column public.guild_alliances.from_slot is
  'Village the offering guild holds, 1..6 on the event map.';
comment on column public.guild_alliances.to_slot is
  'Village the invited guild holds; null until it has picked one.';

alter table public.guild_alliances
  drop constraint if exists guild_alliances_from_slot_check;
alter table public.guild_alliances
  add constraint guild_alliances_from_slot_check
  check (from_slot is null or from_slot between 1 and 6);

alter table public.guild_alliances
  drop constraint if exists guild_alliances_to_slot_check;
alter table public.guild_alliances
  add constraint guild_alliances_to_slot_check
  check (to_slot is null or to_slot between 1 and 6);

-- Two guilds never hold the same village.
alter table public.guild_alliances
  drop constraint if exists guild_alliances_two_villages;
alter table public.guild_alliances
  add constraint guild_alliances_two_villages
  check (from_slot is null or to_slot is null or from_slot <> to_slot);

-- An offer now carries the village the asking guild holds.
drop policy if exists "Officers can offer an alliance" on public.guild_alliances;

create policy "Officers can offer an alliance"
  on public.guild_alliances for insert to authenticated
  with check (
    created_by = auth.uid()
    and status = 'pending'
    and from_slot is not null
    and to_slot is null
    and public.is_guild_officer(from_guild_id)
  );

-- Each guild sets its own village, never the other's, and never on top of it.
create or replace function public.set_alliance_base(
  p_alliance_id uuid,
  p_slot smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.guild_alliances;
begin
  if p_slot is null or p_slot < 1 or p_slot > 6 then
    raise exception 'Invalid village';
  end if;

  select * into v_row from public.guild_alliances where id = p_alliance_id;
  if not found then
    raise exception 'No such alliance';
  end if;

  if public.is_guild_officer(v_row.from_guild_id) then
    if v_row.to_slot = p_slot then
      raise exception 'The allied guild holds that village';
    end if;
    update public.guild_alliances set from_slot = p_slot where id = p_alliance_id;
  elsif public.is_guild_officer(v_row.to_guild_id) then
    if v_row.from_slot = p_slot then
      raise exception 'The allied guild holds that village';
    end if;
    update public.guild_alliances set to_slot = p_slot where id = p_alliance_id;
  else
    raise exception 'Only an officer of one of the two guilds can set its village';
  end if;

  -- A village a guild holds is never a target as well.
  delete from public.guild_alliance_camps
  where alliance_id = p_alliance_id
    and slot = p_slot;
end;
$$;

revoke all on function public.set_alliance_base(uuid, smallint) from public, anon;
grant execute on function public.set_alliance_base(uuid, smallint) to authenticated;

-- The shared board only holds the camps both guilds attack, so no row there
-- belongs to a guild any more.
drop policy if exists "Allied officers can insert shared camps" on public.guild_alliance_camps;
drop policy if exists "Allied officers can update shared camps" on public.guild_alliance_camps;

create policy "Allied officers can insert shared camps"
  on public.guild_alliance_camps for insert to authenticated
  with check (
    public.is_alliance_officer(alliance_id)
    and not exists (
      select 1
      from public.guild_alliances a
      where a.id = alliance_id
        and slot in (a.from_slot, a.to_slot)
    )
  );

create policy "Allied officers can update shared camps"
  on public.guild_alliance_camps for update to authenticated
  using (public.is_alliance_officer(alliance_id))
  with check (
    public.is_alliance_officer(alliance_id)
    and not exists (
      select 1
      from public.guild_alliances a
      where a.id = alliance_id
        and slot in (a.from_slot, a.to_slot)
    )
  );
