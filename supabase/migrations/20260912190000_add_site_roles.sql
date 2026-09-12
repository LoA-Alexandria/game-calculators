-- Three site roles instead of one can_edit flag, and a table the Discord role
-- mapping can be edited in.
--
-- Until now verify-discord-role decided access from two role ids written into
-- its source, and wrote a boolean. Both parts move here: the mapping becomes
-- data an admin can change without a deploy, and the result is a role rather
-- than a yes/no.

-- ---------------------------------------------------------------------------
-- editor_access grows a role
-- ---------------------------------------------------------------------------

alter table public.editor_access
  add column if not exists role text
    check (role is null or role in ('admin', 'manager', 'guide_writer'));

-- Everyone who already had access keeps exactly what they had.
update public.editor_access set role = 'guide_writer' where can_edit and role is null;

-- can_edit stays for now: the deployed frontend still reads it, and the Pages
-- build is not redeployed by this migration. The function keeps both in step.
-- Drop it once no deployed frontend reads it any more.
comment on column public.editor_access.can_edit is
  'Deprecated, kept in step with role. Drop once no deployed frontend reads it.';

-- ---------------------------------------------------------------------------
-- the mapping, as data
-- ---------------------------------------------------------------------------

create table if not exists public.role_mappings (
  id uuid primary key default gen_random_uuid(),
  discord_role_id text not null unique,
  discord_role_name text not null,
  role text not null check (role in ('admin', 'manager', 'guide_writer')),
  created_at timestamptz not null default now()
);

comment on table public.role_mappings is
  'Which Discord role grants which site role. When a member holds several, the highest wins.';

-- Seeded with what the function had hardcoded, so behaviour does not change
-- the moment this is applied.
insert into public.role_mappings (discord_role_id, discord_role_name, role)
values
  ('1534890988588498944', 'Coders', 'guide_writer'),
  ('1534693394692178161', 'Builders', 'guide_writer')
on conflict (discord_role_id) do nothing;

-- ---------------------------------------------------------------------------
-- who may read and change what
-- ---------------------------------------------------------------------------

-- A policy on editor_access cannot query editor_access without recursing, so
-- the caller's own role is read through a definer function instead.
create or replace function public.current_site_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.editor_access where user_id = auth.uid()
$$;

revoke all on function public.current_site_role() from public, anon;
grant execute on function public.current_site_role() to authenticated;

alter table public.role_mappings enable row level security;
revoke all on table public.role_mappings from anon, authenticated;
grant select, insert, update, delete on table public.role_mappings to authenticated;

-- Anyone signed in may see the mapping; only an admin may change it. The
-- interface hides the controls too, but that is a convenience — this is the
-- part that actually stops a non-admin writing.
create policy "Signed-in members can read the role mapping"
  on public.role_mappings for select to authenticated
  using (true);

create policy "Only admins can change the role mapping"
  on public.role_mappings for all to authenticated
  using (public.current_site_role() = 'admin')
  with check (public.current_site_role() = 'admin');

-- Admins need the whole table for the team list; everyone else keeps the
-- existing policy that shows only their own row.
create policy "Admins can read every editor access row"
  on public.editor_access for select to authenticated
  using (public.current_site_role() = 'admin');

-- ---------------------------------------------------------------------------
-- After applying this, promote the first admin by hand — nobody can grant it
-- through the interface until one exists:
--
--   update public.editor_access set role = 'admin' where discord_user_id = '…';
-- ---------------------------------------------------------------------------
