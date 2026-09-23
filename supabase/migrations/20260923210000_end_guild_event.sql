-- Ending an event clears everything that belonged to it.
--
-- Turning a planning event off used to leave the villages, the stock, the day
-- scores and any alliance behind, so the next match started on top of the last
-- one. One officer call now wipes the event back to its default state.

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

  -- Alliances for this event, from either side; their shared board cascades.
  delete from public.guild_alliances
  where event_id = p_event_id
    and (from_guild_id = p_guild_id or to_guild_id = p_guild_id);

  delete from public.guild_event_orders where guild_id = p_guild_id and event_id = p_event_id;
  delete from public.guild_event_camps where guild_id = p_guild_id and event_id = p_event_id;
  delete from public.guild_event_pledges where guild_id = p_guild_id and event_id = p_event_id;
  delete from public.guild_event_days where guild_id = p_guild_id and event_id = p_event_id;
  delete from public.guild_active_events where guild_id = p_guild_id and event_id = p_event_id;
end;
$$;

revoke all on function public.end_guild_event(uuid, text) from public, anon;
grant execute on function public.end_guild_event(uuid, text) to authenticated;
