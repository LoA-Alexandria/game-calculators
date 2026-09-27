-- Publishing an empty draft puts a guide back to the built version.
--
-- Until now a field edited back to the committed text left no draft at all, so
-- there was nothing to publish and the live row kept its old value: taking a
-- letter out of a name looked saved and changed nothing on the page. The
-- editors now write an empty payload for that case, and an empty payload means
-- "there is nothing left to lay over the build", so the live row goes away.
--
-- A guide with no draft row still raises. Only a draft that exists and says
-- nothing reverts, which keeps a stray publish from clearing someone's work.

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

  if jsonb_typeof(body) <> 'object' or body = '{}'::jsonb then
    delete from public.guide_content where guide_id = p_guide_id and locale = p_locale;
  else
    insert into public.guide_content (guide_id, locale, payload, updated_by, updated_at)
    values (p_guide_id, p_locale, body, auth.uid(), now())
    on conflict (guide_id, locale)
    do update set payload = excluded.payload, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  end if;

  delete from public.guide_drafts where guide_id = p_guide_id and locale = p_locale;
end;
$$;

comment on function public.publish_guide(text, text) is
  'Moves a guide draft into the published text. An empty draft reverts the guide to the built version.';
