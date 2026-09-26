-- The account page: your Premium, and the guild your Premium registered.
--
-- A guild has two people in it. The *master* is a Discord snowflake and runs
-- the room. The *registrant* is the account whose Premium slot the listing
-- occupies -- usually the same person, but not when the guild was asked for on
-- somebody else's behalf. `guilds.owner_user_id` is the registrant, which is
-- who may hand the master role on or take the listing down again.

alter table public.guilds
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

comment on column public.guilds.owner_user_id is
  'Account whose Premium slot holds this listing. Null for admin-created guilds.';

create index if not exists guilds_owner_user_id_idx
  on public.guilds (owner_user_id)
  where owner_user_id is not null;

-- Guilds that already came out of a request belong to whoever asked for them.
update public.guilds g
set owner_user_id = r.user_id
from public.guild_create_requests r
where r.created_guild_id = g.id
  and r.status = 'approved'
  and g.owner_user_id is null;

-- ---------------------------------------------------------------------------
-- renewal preference
-- ---------------------------------------------------------------------------

-- Nothing is charged automatically: payment runs through the PayPal button and
-- an admin approves the claim. This flag is the member's answer to "should
-- Premium keep running?", and it is what the reminder before expiry reads.
alter table public.premium_entitlements
  add column if not exists auto_renew boolean not null default false;

comment on column public.premium_entitlements.auto_renew is
  'Member wants Premium to continue; drives the renewal reminder, not a charge.';

create or replace function public.set_premium_auto_renew(p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.premium_entitlements
  set auto_renew = p_on,
      updated_at = now()
  where user_id = auth.uid();

  if not found then
    raise exception 'No Premium entitlement for this account'
      using errcode = 'no_data_found';
  end if;

  return p_on;
end;
$$;

revoke all on function public.set_premium_auto_renew(boolean) from public, anon;
grant execute on function public.set_premium_auto_renew(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- the registrant's two powers over their listing
-- ---------------------------------------------------------------------------

create or replace function public.owns_guild_listing(p_guild_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_site_role() = 'admin'
    or exists (
      select 1 from public.guilds g
      where g.id = p_guild_id
        and g.owner_user_id = auth.uid()
    )
$$;

revoke all on function public.owns_guild_listing(uuid) from public, anon;
grant execute on function public.owns_guild_listing(uuid) to authenticated;

/**
 * Hand the guild master role to another Discord account.
 * The listing stays on the registrant's Premium slot either way.
 */
create or replace function public.set_guild_master(p_guild_id uuid, p_discord_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.owns_guild_listing(p_guild_id) then
    raise exception 'Only the account that registered this guild may change its master'
      using errcode = 'insufficient_privilege';
  end if;

  if p_discord_user_id !~ '^[0-9]{5,32}$' then
    raise exception 'A Discord user id is 5 to 32 digits'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.guilds
  set master_discord_user_id = p_discord_user_id
  where id = p_guild_id;
end;
$$;

revoke all on function public.set_guild_master(uuid, text) from public, anon;
grant execute on function public.set_guild_master(uuid, text) to authenticated;

/**
 * Take the listing down. The guild's rows go with it (every guild table
 * cascades from `guilds`), and the request that created it is marked rejected
 * so the Premium slot is free for another guild.
 */
create or replace function public.delete_own_guild(p_guild_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.owns_guild_listing(p_guild_id) then
    raise exception 'Only the account that registered this guild may delete it'
      using errcode = 'insufficient_privilege';
  end if;

  update public.guild_create_requests
  set status = 'rejected',
      reviewed_at = now()
  where created_guild_id = p_guild_id
    and status in ('pending', 'approved');

  delete from public.guilds where id = p_guild_id;
end;
$$;

revoke all on function public.delete_own_guild(uuid) from public, anon;
grant execute on function public.delete_own_guild(uuid) to authenticated;
