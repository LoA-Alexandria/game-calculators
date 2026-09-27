-- Dawn of Rome and Crown of the Nile are the same board with a different
-- picture: the same hexes, the same sizes, the same places, mirrored, with
-- Egyptian names. A guild plays one of them and says which here.
--
-- The painted hexes stay as they are: they are stored in the board's own
-- coordinates, which both pictures share, so switching the map moves the
-- territory with it instead of scattering it.

alter table public.guild_active_events
  add column if not exists map_variant text not null default 'dawn-of-rome';

alter table public.guild_active_events
  drop constraint if exists guild_active_events_map_variant_check;
alter table public.guild_active_events
  add constraint guild_active_events_map_variant_check
  check (map_variant in ('dawn-of-rome', 'crown-of-the-nile'));

comment on column public.guild_active_events.map_variant is
  'Which picture of the Dawn of Rome board this guild plays. Ignored by other events.';

-- The table had no update grant or policy: it was only ever inserted into and
-- deleted from. Switching the map is the first thing that changes a row.
grant update on table public.guild_active_events to authenticated;

drop policy if exists "Officers can switch the map" on public.guild_active_events;
create policy "Officers can switch the map"
  on public.guild_active_events for update to authenticated
  using (public.is_guild_officer(guild_id))
  with check (public.is_guild_officer(guild_id));
