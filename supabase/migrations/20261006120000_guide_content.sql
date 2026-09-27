-- Guide text that can be written from the site instead of committed.
--
-- The repository stays the base: every guide is still baked into the build and
-- renders without a database. A row here carries only the fields somebody has
-- changed since, and the page lays them over the baked version. So a slow or
-- absent database costs the edit, never the guide.
--
-- Draft and live are separate tables rather than two columns, because they have
-- different readers: a draft is for the people who write guides, the live text
-- is for everybody, and row level security cannot hide one column from one role.

-- What the public sees. Empty until somebody edits a guide on the site.
create table if not exists public.guide_content (
  guide_id text not null check (char_length(guide_id) between 1 and 60),
  locale text not null check (locale in ('en', 'de', 'fr')),
  -- The parts of `guideEntries.<guide_id>` this replaces. Anything absent
  -- falls back to what the build carries.
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (guide_id, locale)
);

comment on table public.guide_content is
  'Published guide text written on the site. Overlays the version baked into the build.';

-- Work in progress, readable only by the people who write guides.
create table if not exists public.guide_drafts (
  guide_id text not null check (char_length(guide_id) between 1 and 60),
  locale text not null check (locale in ('en', 'de', 'fr')),
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (guide_id, locale)
);

comment on table public.guide_drafts is
  'Unpublished guide text. Publishing copies a row into guide_content.';

create index if not exists guide_content_updated_by_idx on public.guide_content (updated_by);
create index if not exists guide_drafts_updated_by_idx on public.guide_drafts (updated_by);

-- ---------------------------------------------------------------- who may write

-- `guides.draft` in lib/auth/roles.ts: every editor role holds it.
create or replace function public.can_draft_guides()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_site_role() in ('admin', 'manager', 'guide_writer'), false)
$$;

-- `guides.publish`: admins and managers only.
create or replace function public.can_publish_guides()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_site_role() in ('admin', 'manager'), false)
$$;

revoke all on function public.can_draft_guides() from public, anon;
revoke all on function public.can_publish_guides() from public, anon;
grant execute on function public.can_draft_guides() to authenticated;
grant execute on function public.can_publish_guides() to authenticated;

-- ---------------------------------------------------------------- policies

alter table public.guide_content enable row level security;
alter table public.guide_drafts enable row level security;

revoke all on table public.guide_content from anon, authenticated;
revoke all on table public.guide_drafts from anon, authenticated;
grant select on table public.guide_content to anon, authenticated;
grant select, insert, update, delete on table public.guide_drafts to authenticated;
grant insert, update, delete on table public.guide_content to authenticated;

-- Guides are public, so the published text is readable without signing in.
create policy "Anyone reads published guide text"
  on public.guide_content for select to anon, authenticated
  using (true);

create policy "Publishers write guide text"
  on public.guide_content for insert to authenticated
  with check (public.can_publish_guides());

create policy "Publishers change guide text"
  on public.guide_content for update to authenticated
  using (public.can_publish_guides())
  with check (public.can_publish_guides());

-- Taking a row away puts the guide back to what the build carries.
create policy "Publishers revert guide text"
  on public.guide_content for delete to authenticated
  using (public.can_publish_guides());

create policy "Editors read drafts"
  on public.guide_drafts for select to authenticated
  using (public.can_draft_guides());

create policy "Editors write drafts"
  on public.guide_drafts for insert to authenticated
  with check (public.can_draft_guides());

create policy "Editors change drafts"
  on public.guide_drafts for update to authenticated
  using (public.can_draft_guides())
  with check (public.can_draft_guides());

create policy "Editors drop drafts"
  on public.guide_drafts for delete to authenticated
  using (public.can_draft_guides());

-- ---------------------------------------------------------------- publishing

-- One step, so a draft cannot be half published: the draft becomes the live
-- text and is cleared. Runs as definer because the caller may hold
-- `guides.publish` without write access to both tables in the same statement.
create or replace function public.publish_guide(p_guide_id text, p_locale text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  body jsonb;
begin
  if not public.can_publish_guides() then
    raise exception 'Only a manager or an admin can publish a guide'
      using errcode = 'insufficient_privilege';
  end if;

  select payload into body
  from public.guide_drafts
  where guide_id = p_guide_id and locale = p_locale;

  if body is null then
    raise exception 'There is no draft for % in %', p_guide_id, p_locale
      using errcode = 'no_data_found';
  end if;

  insert into public.guide_content (guide_id, locale, payload, updated_by, updated_at)
  values (p_guide_id, p_locale, body, auth.uid(), now())
  on conflict (guide_id, locale)
  do update set payload = excluded.payload, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  delete from public.guide_drafts where guide_id = p_guide_id and locale = p_locale;
end;
$$;

revoke all on function public.publish_guide(text, text) from public, anon;
grant execute on function public.publish_guide(text, text) to authenticated;

comment on function public.publish_guide(text, text) is
  'Moves a guide draft into the published text, in one step.';
