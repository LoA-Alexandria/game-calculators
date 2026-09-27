-- Pictures uploaded from the site, for the guides whose data can already be
-- written there.
--
-- The committed pictures under `public/` do not move. This bucket only holds
-- the ones added since, and a guide entry says which kind it means by the
-- `up/` prefix on its path — see `lib/content/guide-media.ts`.
--
-- Bucket rules follow guild-icons, with one difference: writing needs
-- `guides.draft` rather than admin, because the people who maintain guides
-- hold that and not this.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guide-media',
  'guide-media',
  true,
  -- A cut-out tile is a few kilobytes; a banner is under a hundred. Half a
  -- megabyte is generous and still stops someone parking a video here.
  524288,
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Guides are public, so their pictures are.
drop policy if exists "Anyone can read guide media" on storage.objects;
create policy "Anyone can read guide media"
  on storage.objects for select
  to public
  using (bucket_id = 'guide-media');

drop policy if exists "Editors can upload guide media" on storage.objects;
create policy "Editors can upload guide media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'guide-media' and (select public.can_draft_guides()));

drop policy if exists "Editors can replace guide media" on storage.objects;
create policy "Editors can replace guide media"
  on storage.objects for update to authenticated
  using (bucket_id = 'guide-media' and (select public.can_draft_guides()))
  with check (bucket_id = 'guide-media' and (select public.can_draft_guides()));

-- Removing a picture is how a mistaken upload gets cleaned up. It cannot take
-- a committed picture with it: those are files in the repository, not objects.
drop policy if exists "Publishers can remove guide media" on storage.objects;
create policy "Publishers can remove guide media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'guide-media' and (select public.can_publish_guides()));
