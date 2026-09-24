-- The map's hexes are flat-top, so the tile coordinates changed again.
--
-- The first grid was pointy-top: the painted tiles were the right size but
-- turned thirty degrees against the printed ones. Their coordinates mean
-- something else on the new grid, so the paint goes.

delete from public.guild_event_hexes where event_id = 'dawn-of-rome';
delete from public.guild_alliance_hexes;
