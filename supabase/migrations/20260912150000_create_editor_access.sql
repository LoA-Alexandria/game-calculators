create table public.editor_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text unique not null,
  can_edit boolean not null default false,
  checked_at timestamptz not null default now()
);

alter table public.editor_access enable row level security;

revoke all on table public.editor_access from anon, authenticated;
grant select on table public.editor_access to authenticated;

create policy "Members can read their own editor access"
on public.editor_access
for select
to authenticated
using ((select auth.uid()) = user_id);
