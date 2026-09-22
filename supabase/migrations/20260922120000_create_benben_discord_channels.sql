create table public.benben_discord_channels (
  guild_id text not null,
  channel_id text not null,
  message_id text,
  updated_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

alter table public.benben_discord_channels enable row level security;
revoke all on public.benben_discord_channels from anon, authenticated;
grant all on public.benben_discord_channels to service_role;

comment on table public.benben_discord_channels is
  'Discord channel status-message ids used by the Benben Edge Function. Service role only.';
