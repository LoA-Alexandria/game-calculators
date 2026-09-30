-- Admin-assigned Early Supporter cohort and voluntary public credit.
-- The first 20 assignments are reserved permanently; revoking a reward does
-- not reopen its place for a later member.

create table public.early_supporters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  show_on_credits boolean not null default false,
  display_name text,
  constraint early_supporters_display_name_length check (
    display_name is null or char_length(btrim(display_name)) between 1 and 40
  ),
  constraint early_supporters_credit_requires_name check (
    not show_on_credits or display_name is not null
  )
);

comment on table public.early_supporters is
  'The manually awarded, permanently capped first-20 Premium Early Supporter cohort. Public credit is opt-in.';

alter table public.early_supporters enable row level security;
revoke all on table public.early_supporters from anon, authenticated;
grant select (display_name, granted_at) on table public.early_supporters to anon;
grant select (id, user_id, granted_at, granted_by, revoked_at, show_on_credits, display_name)
  on table public.early_supporters to authenticated;
grant insert (user_id) on table public.early_supporters to authenticated;
grant update (revoked_at, show_on_credits, display_name)
  on table public.early_supporters to authenticated;

create policy "Public may read opted-in Early Supporter credits"
  on public.early_supporters for select to anon
  using (show_on_credits and revoked_at is null);

create policy "Members read their Early Supporter status; admins read all"
  on public.early_supporters for select to authenticated
  using (user_id = auth.uid() or public.current_site_role() = 'admin');

create policy "Admins may grant Early Supporters"
  on public.early_supporters for insert to authenticated
  with check (public.current_site_role() = 'admin');

create policy "Members manage only their public credit; admins manage grants"
  on public.early_supporters for update to authenticated
  using (user_id = auth.uid() or public.current_site_role() = 'admin')
  with check (
    (user_id = auth.uid() and revoked_at is null)
    or public.current_site_role() = 'admin'
  );

create or replace function public.limit_early_supporter_grants()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.user_id is not null and new.user_id is null then
      -- Keep the cohort place but remove the deleted account's public credit.
      new.revoked_at := coalesce(new.revoked_at, now());
      new.show_on_credits := false;
      new.display_name := null;
      return new;
    end if;
    if public.current_site_role() is distinct from 'admin'
      and new.revoked_at is distinct from old.revoked_at then
      raise exception 'Only administrators may revoke or restore Early Supporter status'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Serialize concurrent admin assignments so the cohort cannot exceed 20.
  perform pg_advisory_xact_lock(hashtextextended('early-supporter-cohort', 0));

  if new.user_id is null then
    raise exception 'An account is required for an Early Supporter grant';
  end if;
  if public.current_site_role() is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if not public.has_active_premium(new.user_id) then
    raise exception 'An active Premium entitlement is required for Early Supporter status';
  end if;
  if (select count(*) from public.early_supporters) >= 20 then
    raise exception 'All 20 Early Supporter places have been assigned';
  end if;

  new.granted_at := now();
  new.granted_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.limit_early_supporter_grants() from public, anon, authenticated;

create trigger early_supporters_limit_grants
  before insert or update on public.early_supporters
  for each row execute function public.limit_early_supporter_grants();
