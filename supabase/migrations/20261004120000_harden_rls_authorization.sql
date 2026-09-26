-- Tighten the remaining client-facing authorization paths found in the
-- 2026-09 security review. Keep the site static; enforce shared-data rules in
-- Postgres rather than relying on hidden controls in the browser.

-- ---------------------------------------------------------------------------
-- Premium status: members may inspect only themselves; admins retain the
-- existing entitlement-management visibility.
-- ---------------------------------------------------------------------------

create or replace function public.has_active_premium(target uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if target is distinct from auth.uid()
    and public.current_site_role() is distinct from 'admin' then
    raise exception 'Not allowed to inspect another account''s Premium status'
      using errcode = '42501';
  end if;

  return exists (
    select 1
    from public.premium_entitlements
    where user_id = target
      and status = 'active'
      and expires_at > now()
  );
end;
$$;

revoke all on function public.has_active_premium(uuid) from public, anon;
grant execute on function public.has_active_premium(uuid) to authenticated;

-- Internal callers such as guild_is_frozen() must be able to evaluate another
-- account's entitlement. Keep that capability owner-only instead of exposing
-- the unrestricted helper as an RPC to authenticated users.
create or replace function public.has_active_premium_internal(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.premium_entitlements
    where user_id = target
      and status = 'active'
      and expires_at > now()
  );
$$;

revoke all on function public.has_active_premium_internal(uuid) from public, anon, authenticated;

-- Keep the existing public guild-freeze behavior while switching its internal
-- entitlement reads to the owner-only helper above.
create or replace function public.guild_is_frozen(p_guild_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guilds g
    where g.id = p_guild_id
      and g.owner_user_id is not null
      and not public.has_active_premium_internal(g.owner_user_id)
  );
$$;

create or replace function public.frozen_guild_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.guilds g
  where g.owner_user_id is not null
    and not public.has_active_premium_internal(g.owner_user_id)
$$;

-- The planner is no longer shipped with the public static export. The
-- authenticated Edge Function signs short-lived reads from this private
-- bucket after checking the caller's entitlement.
insert into storage.buckets (id, name, public)
values ('premium-tools', 'premium-tools', false)
on conflict (id) do update
set public = false,
    file_size_limit = 262144,
    allowed_mime_types = array['text/html']::text[];

update storage.buckets
set file_size_limit = 262144,
    allowed_mime_types = array['text/html']::text[]
where id = 'premium-tools';

-- ---------------------------------------------------------------------------
-- Guild membership role: browser flows may manage membership lifecycle fields
-- but only set_guild_member_role() may write role. That function is SECURITY
-- DEFINER and independently checks guild-master authority.
-- ---------------------------------------------------------------------------

-- Inactive legacy requests cannot legitimately hold officer status. Clear any
-- such value before closing the client write path.
update public.guild_memberships
set role = 'member'
where status in ('pending', 'rejected')
  and role <> 'member';

revoke insert, update on table public.guild_memberships from authenticated;
grant insert (guild_id, user_id, status, request_note)
  on table public.guild_memberships to authenticated;
grant update (status, requested_at, decided_at, decided_by, request_note)
  on table public.guild_memberships to authenticated;

drop policy if exists "Signed-in users may request to join (pending only, self)"
  on public.guild_memberships;
create policy "Signed-in users may request to join (pending only, self)"
  on public.guild_memberships for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and role = 'member'
  );

drop policy if exists "Self re-apply/leave or officer decide"
  on public.guild_memberships;
drop policy if exists "Self re-apply/leave or master/admin decide"
  on public.guild_memberships;
create policy "Self re-apply/leave or officer decide"
  on public.guild_memberships for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_guild_officer(guild_id)
  )
  with check (
    (
      user_id = auth.uid()
      and status in ('pending', 'rejected')
    )
    or (
      public.is_guild_officer(guild_id)
      and status in ('pending', 'active', 'rejected')
    )
  );

-- ---------------------------------------------------------------------------
-- Direct mail: recipients may update read_at only. Preserve the row-level
-- recipient check while withdrawing the prior table-wide UPDATE grant.
-- ---------------------------------------------------------------------------

revoke update on table public.messages from authenticated;
grant update (read_at) on table public.messages to authenticated;
