-- Let members follow new guild messages without polling the mail room.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- A frozen guild is read-only, including chat messages.
drop policy if exists "Write in a chat you belong to" on public.messages;
create policy "Write in a chat you belong to"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      (kind = 'guild' and public.is_guild_member(guild_id) and not public.guild_is_frozen(guild_id))
      or (kind = 'alliance' and public.is_alliance_member(alliance_id))
    )
  );
