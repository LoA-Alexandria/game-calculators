-- Guild trade: who owns which pieces of an event furniture set, and the gifts
-- planned for a trading day.
--
-- Replaces a shared spreadsheet where every member edited every other member's
-- column and each trading day was a copy of a "Template" sheet. Here a member
-- ticks only their own boxes, a day is a row, and the counters fall out of the
-- gifts rather than being retyped.

-- What one member has: a finished piece (part = ''), or a part of one.
create table if not exists public.guild_trade_marks (
  guild_id uuid not null references public.guilds(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  set_id text not null check (char_length(set_id) between 1 and 40),
  item_id text not null check (char_length(item_id) between 1 and 60),
  -- '' is the piece itself; otherwise the part letter, 'A' to 'H'.
  part text not null default '' check (part = '' or part ~ '^[A-H]$'),
  updated_at timestamptz not null default now(),
  primary key (guild_id, member_id, set_id, item_id, part)
);

comment on table public.guild_trade_marks is
  'One tick per member: a finished furniture piece, or a part of one they are holding.';

create index if not exists guild_trade_marks_set_idx
  on public.guild_trade_marks (guild_id, set_id);

-- One trading day per set. `trade_on` is the day the gifts go out.
create table if not exists public.guild_trade_days (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete cascade,
  set_id text not null check (char_length(set_id) between 1 and 40),
  trade_on date not null,
  status text not null default 'stop' check (status in ('stop', 'pending', 'go')),
  note text not null default '' check (char_length(note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, set_id, trade_on)
);

comment on table public.guild_trade_days is
  'A trading day: the date the gifts go out, and whether the guild has agreed to run it.';

-- One gift: this member sends this part to that member.
create table if not exists public.guild_trade_rows (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.guild_trade_days(id) on delete cascade,
  -- Carried so a policy can check the guild without joining the day.
  guild_id uuid not null references public.guilds(id) on delete cascade,
  from_member uuid not null references auth.users(id) on delete cascade,
  to_member uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 60),
  part text not null default '' check (part = '' or part ~ '^[A-H]$'),
  done boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint guild_trade_rows_not_self check (from_member <> to_member),
  unique (day_id, from_member, to_member, item_id, part)
);

comment on table public.guild_trade_rows is
  'One planned gift on a trading day: who sends which part to whom.';

create index if not exists guild_trade_rows_day_idx
  on public.guild_trade_rows (day_id);

-- ---------------------------------------------------------------- policies

alter table public.guild_trade_marks enable row level security;
alter table public.guild_trade_days enable row level security;
alter table public.guild_trade_rows enable row level security;

revoke all on table public.guild_trade_marks from anon, authenticated;
revoke all on table public.guild_trade_days from anon, authenticated;
revoke all on table public.guild_trade_rows from anon, authenticated;
grant select, insert, update, delete on table public.guild_trade_marks to authenticated;
grant select, insert, update, delete on table public.guild_trade_days to authenticated;
grant select, insert, update, delete on table public.guild_trade_rows to authenticated;

-- Everyone in the guild sees the whole board: that is the point of it.
create policy "Members can read trade marks"
  on public.guild_trade_marks for select to authenticated
  using (public.is_guild_member(guild_id));

-- A member ticks their own boxes and nobody else's. This is the one place the
-- spreadsheet could not be trusted, and the reason the table has a member_id
-- in its key rather than a column per player.
create policy "Members tick their own boxes"
  on public.guild_trade_marks for insert to authenticated
  with check (public.is_guild_member(guild_id) and member_id = auth.uid());

create policy "Members change their own boxes"
  on public.guild_trade_marks for update to authenticated
  using (public.is_guild_member(guild_id) and member_id = auth.uid())
  with check (public.is_guild_member(guild_id) and member_id = auth.uid());

create policy "Members clear their own boxes"
  on public.guild_trade_marks for delete to authenticated
  using (public.is_guild_member(guild_id) and member_id = auth.uid());

-- The plan is the guild's, so any member may open a day and write it.
create policy "Members can read trade days"
  on public.guild_trade_days for select to authenticated
  using (public.is_guild_member(guild_id));

create policy "Members can open a trade day"
  on public.guild_trade_days for insert to authenticated
  with check (public.is_guild_member(guild_id) and created_by = auth.uid());

create policy "Members can change a trade day"
  on public.guild_trade_days for update to authenticated
  using (public.is_guild_member(guild_id))
  with check (public.is_guild_member(guild_id));

create policy "Officers can remove a trade day"
  on public.guild_trade_days for delete to authenticated
  using (public.is_guild_officer(guild_id));

create policy "Members can read trade rows"
  on public.guild_trade_rows for select to authenticated
  using (public.is_guild_member(guild_id));

create policy "Members can plan a gift"
  on public.guild_trade_rows for insert to authenticated
  with check (
    public.is_guild_member(guild_id)
    and created_by = auth.uid()
    and exists (
      select 1 from public.guild_trade_days day
      where day.id = day_id and day.guild_id = guild_trade_rows.guild_id
    )
  );

create policy "Members can change a gift"
  on public.guild_trade_rows for update to authenticated
  using (public.is_guild_member(guild_id))
  with check (public.is_guild_member(guild_id));

create policy "Members can drop a gift"
  on public.guild_trade_rows for delete to authenticated
  using (public.is_guild_member(guild_id));

-- A guild whose owner has let Premium lapse is frozen: it stays readable and
-- nothing in it can be written. These three tables join that rule under the
-- same trigger name the freeze migration uses, and they each carry a guild_id,
-- which is what the guard reads.
do $$
declare
  t text;
begin
  foreach t in array array['guild_trade_marks', 'guild_trade_days', 'guild_trade_rows'] loop
    execute format('drop trigger if exists guard_frozen_guild on public.%I', t);
    execute format(
      'create trigger guard_frozen_guild
         before insert or update or delete on public.%I
         for each row execute function public.guard_guild_write()', t);
  end loop;
end;
$$;
