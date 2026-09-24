-- A painted tile carries a colour, not only a guild of ours.
--
-- The board has to show who holds what, and the guilds on the other side have
-- no row in `guilds`. A tile gets a tone instead: 1 is the guild whose board it
-- is, 2 the guild it is allied with, and 3 to 6 are for everybody else.
-- `owner_guild_id` stays for the two sides we do know, and becomes optional.

alter table public.guild_event_hexes
  add column if not exists tone smallint not null default 1;
alter table public.guild_event_hexes
  alter column owner_guild_id drop not null;
alter table public.guild_event_hexes
  drop constraint if exists guild_event_hexes_tone_check;
alter table public.guild_event_hexes
  add constraint guild_event_hexes_tone_check check (tone between 1 and 6);

comment on column public.guild_event_hexes.tone is
  'Colour slot: 1 ours, 2 the allied guild, 3-6 the other side.';

alter table public.guild_alliance_hexes
  add column if not exists tone smallint not null default 1;
alter table public.guild_alliance_hexes
  alter column owner_guild_id drop not null;
alter table public.guild_alliance_hexes
  drop constraint if exists guild_alliance_hexes_tone_check;
alter table public.guild_alliance_hexes
  add constraint guild_alliance_hexes_tone_check check (tone between 1 and 6);

comment on column public.guild_alliance_hexes.tone is
  'Colour slot: 1 the guild reading the board, 2 its ally, 3-6 the other side.';

-- The grid was remeasured against the printed hexes, so old coordinates point
-- at the wrong tiles. Nothing was painted in a real event yet.
delete from public.guild_event_hexes where event_id = 'dawn-of-rome';
delete from public.guild_alliance_hexes;
delete from public.guild_event_settlements where event_id = 'dawn-of-rome';
delete from public.guild_alliance_settlements;
