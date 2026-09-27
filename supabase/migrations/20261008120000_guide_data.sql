-- Structured guide data written on the site: the rosters and item tables that
-- live in `lib/data/*.json`, not just the prose.
--
-- Same shape as guide_content, and for the same reason: the repository stays
-- the base, a row here carries a replacement, and the page falls back to what
-- was built whenever the row is missing, unreadable, or the wrong shape. The
-- difference is that a malformed payload here could break a page rather than
-- blank a paragraph, so the browser validates every payload against the shape
-- it expects and ignores anything that does not fit.
--
-- Pictures are not part of this. An entry may still only name a file that is
-- committed under `public/`; uploading one from the site needs Storage and is
-- its own change.

create table if not exists public.guide_data (
  guide_id text primary key check (char_length(guide_id) between 1 and 60),
  -- The whole data file, as the editor exports it.
  payload jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.guide_data is
  'Published structured guide data written on the site. Replaces the file baked into the build.';

create table if not exists public.guide_data_drafts (
  guide_id text primary key check (char_length(guide_id) between 1 and 60),
  payload jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.guide_data_drafts is
  'Unpublished structured guide data. Publishing copies a row into guide_data.';

create index if not exists guide_data_updated_by_idx on public.guide_data (updated_by);
create index if not exists guide_data_drafts_updated_by_idx on public.guide_data_drafts (updated_by);

alter table public.guide_data enable row level security;
alter table public.guide_data_drafts enable row level security;

revoke all on table public.guide_data from anon, authenticated;
revoke all on table public.guide_data_drafts from anon, authenticated;
grant select on table public.guide_data to anon, authenticated;
grant insert, update, delete on table public.guide_data to authenticated;
grant select, insert, update, delete on table public.guide_data_drafts to authenticated;

create policy "Anyone reads published guide data"
  on public.guide_data for select to anon, authenticated
  using (true);

create policy "Publishers write guide data"
  on public.guide_data for insert to authenticated
  with check ((select public.can_publish_guides()));

create policy "Publishers change guide data"
  on public.guide_data for update to authenticated
  using ((select public.can_publish_guides()))
  with check ((select public.can_publish_guides()));

create policy "Publishers revert guide data"
  on public.guide_data for delete to authenticated
  using ((select public.can_publish_guides()));

create policy "Editors read data drafts"
  on public.guide_data_drafts for select to authenticated
  using ((select public.can_draft_guides()));

create policy "Editors write data drafts"
  on public.guide_data_drafts for insert to authenticated
  with check ((select public.can_draft_guides()));

create policy "Editors change data drafts"
  on public.guide_data_drafts for update to authenticated
  using ((select public.can_draft_guides()))
  with check ((select public.can_draft_guides()));

create policy "Editors drop data drafts"
  on public.guide_data_drafts for delete to authenticated
  using ((select public.can_draft_guides()));

-- One step, so a draft cannot be half published.
create or replace function public.publish_guide_data(p_guide_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  body jsonb;
begin
  if not public.can_publish_guides() then
    raise exception 'Only a manager or an admin can publish guide data'
      using errcode = 'insufficient_privilege';
  end if;

  select payload into body from public.guide_data_drafts where guide_id = p_guide_id;
  if body is null then
    raise exception 'There is no data draft for %', p_guide_id
      using errcode = 'no_data_found';
  end if;

  insert into public.guide_data (guide_id, payload, updated_by, updated_at)
  values (p_guide_id, body, auth.uid(), now())
  on conflict (guide_id)
  do update set payload = excluded.payload, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  delete from public.guide_data_drafts where guide_id = p_guide_id;
end;
$$;

revoke all on function public.publish_guide_data(text) from public, anon;
grant execute on function public.publish_guide_data(text) to authenticated;

comment on function public.publish_guide_data(text) is
  'Moves a structured guide data draft into the published data, in one step.';
