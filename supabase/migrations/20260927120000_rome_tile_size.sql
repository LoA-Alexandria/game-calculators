-- The tiles were measured again, and they are smaller than the last guess.
--
-- 48 x 35.5 px, columns 36 apart, tile (0, 0) centred at (9, 16): read off the
-- printed lines with the grid drawn back over the picture. Old coordinates mean
-- other places on this grid, so the paint goes one last time.

delete from public.guild_event_hexes where event_id = 'dawn-of-rome';
delete from public.guild_alliance_hexes;
