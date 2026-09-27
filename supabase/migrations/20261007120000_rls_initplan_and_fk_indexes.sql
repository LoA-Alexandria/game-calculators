-- Two findings from the Supabase database linter, both about speed, neither
-- about who is allowed to do what.
--
-- 1. Thirty policies call `auth.uid()` directly. Postgres then calls it once
--    per row instead of once per query. Wrapped in a sub-select it becomes an
--    InitPlan and runs once. `auth.uid()` is stable, so the two forms return
--    the same thing; only the number of calls changes. On a board with 459
--    painted hexes that is 459 calls saved per read.
--
-- 2. Twenty-eight foreign keys have no index that covers them. Deleting a
--    guild or a user makes Postgres scan every referencing table to check the
--    constraint.
--
-- Both are rewritten from the catalogue rather than typed out, because a list
-- of thirty policies and twenty-eight indexes is exactly where a typo hides.
-- The policy rewrite then checks itself: it keeps a copy of every definition
-- from before and fails the migration if any of them changed by more than the
-- wrapper.

set local search_path = public;

-- ------------------------------------------------------------- 1. policies

create temporary table policy_before on commit drop as
  select tablename, policyname, qual, with_check
  from pg_policies
  where schemaname = 'public';

do $$
declare
  p record;
  new_qual text;
  new_check text;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%auth.uid()%' or coalesce(with_check, '') like '%auth.uid()%')
  loop
    -- Unwrap first, then wrap every call once. In that order the rewrite is
    -- repeatable: running it a second time changes nothing.
    new_qual := p.qual;
    new_check := p.with_check;
    if new_qual is not null then
      new_qual := replace(new_qual, '( SELECT auth.uid() AS uid)', 'auth.uid()');
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
    end if;
    if new_check is not null then
      new_check := replace(new_check, '( SELECT auth.uid() AS uid)', 'auth.uid()');
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
    end if;

    -- A SELECT or DELETE policy has no WITH CHECK and an INSERT policy has no
    -- USING; passing one it does not have is an error, so each is optional.
    execute format(
      'alter policy %I on public.%I%s%s',
      p.policyname,
      p.tablename,
      case when new_qual is null then '' else format(' using (%s)', new_qual) end,
      case when new_check is null then '' else format(' with check (%s)', new_check) end
    );
  end loop;
end;
$$;

-- The rewrite must not have changed a single rule. Normalising the wrapper
-- away has to give back exactly what was there before, for every policy.
do $$
declare
  changed int;
  gone int;
begin
  select count(*) into changed
  from pg_policies now
  join policy_before was
    on was.tablename = now.tablename and was.policyname = now.policyname
  where now.schemaname = 'public'
    and (
      replace(coalesce(now.qual, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()')
        is distinct from replace(coalesce(was.qual, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()')
      or replace(coalesce(now.with_check, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()')
        is distinct from replace(coalesce(was.with_check, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()')
    );
  if changed > 0 then
    raise exception 'The rewrite changed % policies by more than the wrapper', changed;
  end if;

  select count(*) into gone
  from policy_before was
  where not exists (
    select 1 from pg_policies now
    where now.schemaname = 'public'
      and now.tablename = was.tablename and now.policyname = was.policyname
  );
  if gone > 0 then
    raise exception '% policies went missing', gone;
  end if;
end;
$$;

-- ------------------------------------------------------------- 2. indexes

-- An index covers a foreign key when its leading columns are the key's
-- columns, in order. Anything else still needs a scan.
do $$
declare
  c record;
  cols text;
  name text;
begin
  for c in
    select con.conname, cl.relname as table_name, con.conkey, con.conrelid
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where con.contype = 'f'
      and ns.nspname = 'public'
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = con.conrelid
          and (
            select array_agg(i.indkey[k] order by k)
            from generate_series(0, array_length(con.conkey, 1) - 1) as k
          ) = con.conkey
      )
  loop
    select string_agg(quote_ident(att.attname), ', ' order by key.ord)
      into cols
    from unnest(c.conkey) with ordinality as key(attnum, ord)
    join pg_attribute att on att.attrelid = c.conrelid and att.attnum = key.attnum;

    name := left(c.conname || '_idx', 63);
    execute format('create index if not exists %I on public.%I (%s)', name, c.table_name, cols);
  end loop;
end;
$$;

-- Four indexes the linter reports as never used are deliberately kept: they
-- cover lookups the site does rarely (a guild by its master's Discord id, a
-- member's own messages) and "never used yet" on a young database is not the
-- same as "never needed".
