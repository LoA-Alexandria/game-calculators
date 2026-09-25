-- Profiles (username for password accounts), monthly Premium entitlements,
-- PayPal claim queue, and one guild-create request per Premium member.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username ~ '^[a-zA-Z0-9_]{3,24}$'
  )
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

comment on table public.profiles is
  'Display username for email/password accounts. Discord users may also set one.';

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

create policy "Anyone signed in can read profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "Members can insert their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Members can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- premium entitlements (30-day windows)
-- ---------------------------------------------------------------------------

create table public.premium_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source text not null default 'manual'
    check (source in ('paypal_ncp', 'manual')),
  paypal_txn_id text,
  note text,
  updated_at timestamptz not null default now()
);

comment on table public.premium_entitlements is
  'Active Premium when status = active and expires_at > now(). Renew by extending expires_at.';

alter table public.premium_entitlements enable row level security;
revoke all on table public.premium_entitlements from anon, authenticated;
-- SELECT for every member (own row / admin list). INSERT/UPDATE/DELETE are
-- still limited to admins by RLS; without these grants admin upserts fail with
-- "permission denied for table" before policies run.
grant select, insert, update, delete on table public.premium_entitlements to authenticated;

create policy "Members can read their own premium row"
  on public.premium_entitlements for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.current_site_role() = 'admin'
  );

create policy "Only admins can write premium entitlements"
  on public.premium_entitlements for all to authenticated
  using (public.current_site_role() = 'admin')
  with check (public.current_site_role() = 'admin');

create or replace function public.has_active_premium(target uuid default auth.uid())
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

revoke all on function public.has_active_premium(uuid) from public, anon;
grant execute on function public.has_active_premium(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- premium claims (PayPal NCP transaction ids waiting for admin approval)
-- ---------------------------------------------------------------------------

create table public.premium_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paypal_txn_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create unique index premium_claims_txn_unique
  on public.premium_claims (paypal_txn_id)
  where status in ('pending', 'approved');

comment on table public.premium_claims is
  'Member-submitted PayPal transaction ids. Admin approval extends premium_entitlements by 30 days.';

alter table public.premium_claims enable row level security;
revoke all on table public.premium_claims from anon, authenticated;
grant select, insert, update on table public.premium_claims to authenticated;

create policy "Members can read their own claims; admins read all"
  on public.premium_claims for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.current_site_role() = 'admin'
  );

create policy "Members can insert their own pending claims"
  on public.premium_claims for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
  );

create policy "Only admins can update claims"
  on public.premium_claims for update to authenticated
  using (public.current_site_role() = 'admin')
  with check (public.current_site_role() = 'admin');

-- ---------------------------------------------------------------------------
-- guild create requests (one per Premium member lifetime until rejected)
-- ---------------------------------------------------------------------------

create table public.guild_create_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  server_name text not null default '',
  description text not null default '',
  master_discord_user_id text not null
    check (master_discord_user_id ~ '^[0-9]{5,32}$'),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_guild_id uuid references public.guilds(id) on delete set null
);

-- At most one open or approved request per user (rejected frees the slot).
create unique index guild_create_requests_one_open
  on public.guild_create_requests (user_id)
  where status in ('pending', 'approved');

comment on table public.guild_create_requests is
  'Premium perk: request creation of one guild. Admin approves and creates the guild.';

alter table public.guild_create_requests enable row level security;
revoke all on table public.guild_create_requests from anon, authenticated;
grant select, insert, update on table public.guild_create_requests to authenticated;

create policy "Members can read their own guild create requests; admins read all"
  on public.guild_create_requests for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.current_site_role() = 'admin'
  );

create policy "Premium members can insert one pending guild create request"
  on public.guild_create_requests for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and public.has_active_premium(auth.uid())
  );

create policy "Only admins can update guild create requests"
  on public.guild_create_requests for update to authenticated
  using (public.current_site_role() = 'admin')
  with check (public.current_site_role() = 'admin');
