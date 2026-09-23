-- Messages: direct mail between two players, a guild chat, and a chat the two
-- guilds of an alliance share.
--
-- Direct mail goes through `send_direct_message`, which checks the block list
-- and a rate limit; the two chats are plain inserts that RLS keeps inside the
-- guild or the alliance.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'guild', 'alliance')),
  guild_id uuid references public.guilds(id) on delete cascade,
  alliance_id uuid references public.guild_alliances(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  subject text not null default '' check (char_length(subject) <= 120),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_one_target check (
    (kind = 'direct' and recipient_id is not null and guild_id is null and alliance_id is null)
    or (kind = 'guild' and guild_id is not null and recipient_id is null and alliance_id is null)
    or (kind = 'alliance' and alliance_id is not null and recipient_id is null and guild_id is null)
  ),
  constraint messages_not_self check (recipient_id is null or recipient_id <> sender_id)
);

comment on table public.messages is
  'Direct mail and the guild and alliance chats. One table, three kinds.';

create index if not exists messages_to_idx on public.messages (recipient_id, created_at desc) where kind = 'direct';
create index if not exists messages_from_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_guild_idx on public.messages (guild_id, created_at desc) where kind = 'guild';
create index if not exists messages_alliance_idx on public.messages (alliance_id, created_at desc) where kind = 'alliance';

alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
grant select, insert, update, delete on table public.messages to authenticated;

create policy "Read your own mail and the chats you belong to"
  on public.messages for select to authenticated
  using (
    (kind = 'direct' and (sender_id = auth.uid() or recipient_id = auth.uid()))
    or (kind = 'guild' and public.is_guild_member(guild_id))
    or (kind = 'alliance' and public.is_alliance_member(alliance_id))
  );

-- Direct mail is written by send_direct_message, so only the chats insert here.
create policy "Write in a chat you belong to"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      (kind = 'guild' and public.is_guild_member(guild_id))
      or (kind = 'alliance' and public.is_alliance_member(alliance_id))
    )
  );

create policy "Mark your own mail read"
  on public.messages for update to authenticated
  using (kind = 'direct' and recipient_id = auth.uid())
  with check (kind = 'direct' and recipient_id = auth.uid());

-- Your own messages, anything in a guild chat you are an officer of, and
-- admins anywhere.
create policy "Delete your own message"
  on public.messages for delete to authenticated
  using (
    sender_id = auth.uid()
    or (kind = 'guild' and public.is_guild_officer(guild_id))
    or public.current_site_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------

create table if not exists public.message_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint message_blocks_not_self check (blocker_id <> blocked_id)
);

comment on table public.message_blocks is
  'Who may not send you direct mail. Only the blocker sees their own list.';

alter table public.message_blocks enable row level security;
revoke all on table public.message_blocks from anon, authenticated;
grant select, insert, delete on table public.message_blocks to authenticated;

create policy "Read your own block list"
  on public.message_blocks for select to authenticated
  using (blocker_id = auth.uid());

create policy "Block somebody yourself"
  on public.message_blocks for insert to authenticated
  with check (blocker_id = auth.uid());

create policy "Unblock somebody yourself"
  on public.message_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- how far each reader got in a chat
-- ---------------------------------------------------------------------------

create table if not exists public.message_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('guild', 'alliance')),
  channel_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, kind, channel_id)
);

comment on table public.message_reads is
  'Last time a reader opened a guild or alliance chat, for the unread count.';

alter table public.message_reads enable row level security;
revoke all on table public.message_reads from anon, authenticated;
grant select, insert, update, delete on table public.message_reads to authenticated;

create policy "Your own read marks"
  on public.message_reads for select to authenticated
  using (user_id = auth.uid());

create policy "Keep your own read marks"
  on public.message_reads for insert to authenticated
  with check (user_id = auth.uid());

create policy "Move your own read marks"
  on public.message_reads for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Drop your own read marks"
  on public.message_reads for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- names, so a player can be found and a message can be signed
-- ---------------------------------------------------------------------------

-- Discord's name first, then whatever a guild knows them as.
create or replace function public.display_name_of(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(u.raw_user_meta_data->>'global_name', ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'user_name', ''),
    nullif((
      select m.display_name
      from public.guild_memberships m
      where m.user_id = u.id and m.display_name <> ''
      order by m.requested_at desc
      limit 1
    ), ''),
    left(u.id::text, 8)
  )
  from auth.users u
  where u.id = p_user_id
$$;

revoke all on function public.display_name_of(uuid) from public, anon;
grant execute on function public.display_name_of(uuid) to authenticated;

/** Names for the senders of the messages on screen. */
create or replace function public.message_names(p_ids uuid[])
returns table (user_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, public.display_name_of(u.id)
  from auth.users u
  where auth.uid() is not null
    and u.id = any(p_ids)
$$;

revoke all on function public.message_names(uuid[]) from public, anon;
grant execute on function public.message_names(uuid[]) to authenticated;

/** Players you can write to, by name. Anyone who blocked you drops out. */
create or replace function public.find_people(p_query text)
returns table (user_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, public.display_name_of(u.id)
  from auth.users u
  where auth.uid() is not null
    and u.id <> auth.uid()
    and public.display_name_of(u.id) ilike '%' || coalesce(p_query, '') || '%'
    and not exists (
      select 1
      from public.message_blocks b
      where b.blocker_id = u.id and b.blocked_id = auth.uid()
    )
  order by public.display_name_of(u.id)
  limit 20
$$;

revoke all on function public.find_people(text) from public, anon;
grant execute on function public.find_people(text) to authenticated;

-- ---------------------------------------------------------------------------
-- sending direct mail
-- ---------------------------------------------------------------------------

create or replace function public.send_direct_message(
  p_recipient_id uuid,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_recent integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if p_recipient_id is null or p_recipient_id = auth.uid() then
    raise exception 'Pick somebody else';
  end if;
  if coalesce(btrim(p_body), '') = '' then
    raise exception 'Write something';
  end if;
  if char_length(p_body) > 2000 then
    raise exception 'That message is too long';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_recipient_id) then
    raise exception 'No such player';
  end if;
  if exists (
    select 1 from public.message_blocks b
    where b.blocker_id = p_recipient_id and b.blocked_id = auth.uid()
  ) then
    raise exception 'That player does not take mail from you';
  end if;

  -- A plain brake on flooding: thirty letters an hour.
  select count(*) into v_recent
  from public.messages m
  where m.kind = 'direct'
    and m.sender_id = auth.uid()
    and m.created_at > now() - interval '1 hour';
  if v_recent >= 30 then
    raise exception 'Too many messages in the last hour';
  end if;

  insert into public.messages (kind, sender_id, recipient_id, subject, body)
  values ('direct', auth.uid(), p_recipient_id, left(coalesce(p_subject, ''), 120), p_body)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.send_direct_message(uuid, text, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text, text) to authenticated;
