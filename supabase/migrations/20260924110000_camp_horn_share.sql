-- Rings and horns are planned per camp now, not per member.
--
-- An officer gives each target a share of the guild's Draupnir Rings and says
-- where the Military Tokens (Horns) go, so nobody has to type how much they
-- carry. The per-member columns stay put; only attacks are still assigned.

alter table public.guild_event_camps
  add column if not exists horn_share smallint not null default 0,
  add column if not exists ring_focus boolean not null default false;

alter table public.guild_event_camps
  drop constraint if exists guild_event_camps_horn_share_check;
alter table public.guild_event_camps
  add constraint guild_event_camps_horn_share_check check (horn_share between 0 and 100);

comment on column public.guild_event_camps.horn_share is
  'Share of the guild''s rings to spend on this camp, in percent.';
comment on column public.guild_event_camps.ring_focus is
  'Horns go here. Set on every target, they are spread over all of them.';

alter table public.guild_alliance_camps
  add column if not exists horn_share smallint not null default 0,
  add column if not exists ring_focus boolean not null default false;

alter table public.guild_alliance_camps
  drop constraint if exists guild_alliance_camps_horn_share_check;
alter table public.guild_alliance_camps
  add constraint guild_alliance_camps_horn_share_check check (horn_share between 0 and 100);

comment on column public.guild_alliance_camps.horn_share is
  'Share of the allied rings to spend on this camp, in percent.';
comment on column public.guild_alliance_camps.ring_focus is
  'Horns go here. Set on every target, they are spread over all of them.';
