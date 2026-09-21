-- Guild server name, optional icon path, and member-visible posts (news / planung).
-- Storage bucket guild-icons: public read, admin write.

-- ---------------------------------------------------------------------------
-- guilds: server_name + icon_path
-- ---------------------------------------------------------------------------

alter table public.guilds
  add column if not exists server_name text not null default ''
    check (char_length(server_name) <= 80);

alter table public.guilds
  add column if not exists icon_path text
    check (icon_path is null or char_length(icon_path) between 1 and 200);

comment on column public.guilds.server_name is
  'Game server label shown on the public guild card (e.g. S9 - Garden).';
comment on column public.guilds.icon_path is
  'Object path in the guild-icons bucket, e.g. {guild_id}/icon.webp.';

-- ---------------------------------------------------------------------------
-- guild_posts
-- ---------------------------------------------------------------------------

create table if not exists public.guild_posts (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  channel text not null check (channel in ('news', 'planung')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null default '' check (char_length(body) <= 8000),
  author_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.guild_posts is
  'Guild room posts. channel separates News and Planning tabs.';

create index if not exists guild_posts_guild_channel_created_idx
  on public.guild_posts (guild_id, channel, created_at desc);

alter table public.guild_posts enable row level security;
revoke all on table public.guild_posts from anon, authenticated;
grant select on table public.guild_posts to authenticated;
grant insert, update, delete on table public.guild_posts to authenticated;

create policy "Members can read guild posts"
  on public.guild_posts for select to authenticated
  using (public.is_guild_member(guild_id));

create policy "Masters and admins can create guild posts"
  on public.guild_posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_guild_master(guild_id)
  );

create policy "Masters and admins can update guild posts"
  on public.guild_posts for update to authenticated
  using (public.is_guild_master(guild_id))
  with check (public.is_guild_master(guild_id));

create policy "Masters and admins can delete guild posts"
  on public.guild_posts for delete to authenticated
  using (public.is_guild_master(guild_id));

-- ---------------------------------------------------------------------------
-- storage: guild-icons
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guild-icons',
  'guild-icons',
  true,
  524288,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (bucket is public); writes only for site admins.
drop policy if exists "Anyone can read guild icons" on storage.objects;
create policy "Anyone can read guild icons"
  on storage.objects for select
  to public
  using (bucket_id = 'guild-icons');

drop policy if exists "Admins can upload guild icons" on storage.objects;
create policy "Admins can upload guild icons"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'guild-icons'
    and public.current_site_role() = 'admin'
  );

drop policy if exists "Admins can update guild icons" on storage.objects;
create policy "Admins can update guild icons"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'guild-icons'
    and public.current_site_role() = 'admin'
  )
  with check (
    bucket_id = 'guild-icons'
    and public.current_site_role() = 'admin'
  );

drop policy if exists "Admins can delete guild icons" on storage.objects;
create policy "Admins can delete guild icons"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'guild-icons'
    and public.current_site_role() = 'admin'
  );
