-- Say which guild is setting its village, instead of guessing from the caller.
--
-- `is_guild_master` is true for a site admin at every guild, so an admin (or
-- anyone who is an officer of both sides) always matched the first branch and
-- kept writing the offering guild's village. The guild is now an argument, and
-- the caller has to be an officer of exactly that guild.

drop function if exists public.set_alliance_base(uuid, smallint);

create or replace function public.set_alliance_base(
  p_alliance_id uuid,
  p_slot smallint,
  p_guild_id uuid
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

  if p_guild_id not in (v_row.from_guild_id, v_row.to_guild_id) then
    raise exception 'That guild is not part of this alliance';
  end if;

  if not public.is_guild_officer(p_guild_id) then
    raise exception 'Only an officer of that guild can set its village';
  end if;

  if p_guild_id = v_row.from_guild_id then
    if v_row.to_slot = p_slot then
      raise exception 'The allied guild holds that village';
    end if;
    update public.guild_alliances set from_slot = p_slot where id = p_alliance_id;
  else
    if v_row.from_slot = p_slot then
      raise exception 'The allied guild holds that village';
    end if;
    update public.guild_alliances set to_slot = p_slot where id = p_alliance_id;
  end if;

  -- A village a guild holds is never a target as well.
  delete from public.guild_alliance_camps
  where alliance_id = p_alliance_id
    and slot = p_slot;
end;
$$;

revoke all on function public.set_alliance_base(uuid, smallint, uuid) from public, anon;
grant execute on function public.set_alliance_base(uuid, smallint, uuid) to authenticated;
