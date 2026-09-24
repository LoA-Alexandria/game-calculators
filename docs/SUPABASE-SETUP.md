# Supabase and Discord setup

The frontend uses Discord login through Supabase. A Supabase Edge Function checks membership in the Pop Epoch server and grants wiki-editor access to members with either the Coders or Builders role.

## Public site configuration

In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add:

- `NEXT_PUBLIC_SUPABASE_URL`: `https://puaggqclhyzckitetsfc.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's `sb_publishable_…` key

For local development, copy `.env.example` to `.env.local` and fill in the same values. These values identify the Supabase project but do not bypass database security.

## Authentication URLs

In Supabase **Authentication → URL Configuration**, set:

- Site URL: `https://loa-alexandria.github.io/game-calculators/`
- Additional redirect URL: `http://localhost:3000/**`

The Discord provider must request `identify` and `guilds.members.read`; the frontend supplies these scopes during sign-in.

## Database and function

Install the Supabase CLI, log in, and link this repository to project `puaggqclhyzckitetsfc`. Then apply the checked-in migration and deploy the function:

```sh
supabase link --project-ref puaggqclhyzckitetsfc
supabase db push
supabase functions deploy verify-discord-role --use-api
```

Supabase automatically provides the function with its project URL, anon key, and service-role key. Do not commit those secrets.

The guild is `1534685294371274822` and stays in the function.

`supabase db push` applies every checked-in migration. The guild ones, in order:

- `20260922190000_guild_event_camps.sql` — the villages of a siege day.
- `20260922210000_guild_event_orders.sql` — who an officer sends where.
- `20260922230000_guild_alliances.sql` — alliances and the board two guilds share.
- `20260923120000_guild_alliance_bases.sql` — the village each allied guild holds.
- `20260923180000_alliance_base_side.sql` — that function takes the guild it sets.
- `20260923210000_end_guild_event.sql` — `end_guild_event` clears an event.
- `20260924110000_camp_horn_share.sql` — a camp's horn share and ring spread.
- `20260924150000_messages.sql` — mail, the two chats, blocks and read marks.
- `20260925120000_guild_posts_i18n.sql` — guild news source + i18n columns.
- `20260925200000_guild_rome_territory.sql` — Dawn of Rome hex paint and settlements.
- `20260926120000_rome_tile_tones.sql` — a painted tile carries a colour; clears
  the tiles painted on the old grid.
- `20260926180000_rome_flat_top_grid.sql` — clears the paint again after the
  tiles turned out to be flat-top.

They only add tables, columns, functions and policies, so applying them changes
nothing until a guild fills a board in, offers an alliance, ends an event or
writes a message.

Which Discord role grants which site role is **no longer in the function**: it
lives in the `role_mappings` table and is edited at `/admin/` by an admin. The
migration seeds it with the two roles that used to be hardcoded (Coders and
Builders, both `guide_writer`), so applying it changes nothing on its own.

A member holding several mapped roles gets the highest one, ranked
`guide_writer < manager < admin`. The same rule is in `lib/auth/roles.ts`; keep
the two in step.

### The first admin

The function rewrites `role` from the member's Discord roles on every sign-in,
so `admin` has to come from a Discord role as well. Setting `role = 'admin'` on
`editor_access` by hand does not stick: it is overwritten the next time that
member signs in. That is intended — whoever loses the Discord role loses the
site role with it.

Nobody can add a mapping at `/admin/` until an admin exists, so add the first
one once in the Supabase SQL editor. It runs as the table owner, so row level
security does not stop it:

```sql
insert into public.role_mappings (discord_role_id, discord_role_name, role)
values ('<discord role id>', 'Admin', 'admin');
```

Pick a Discord role only admins hold. To copy its id, turn on **Developer Mode**
in Discord (**User Settings → Advanced**), open **Server Settings → Roles**, and
choose **Copy Role ID** from the role's menu. Members with that role become admin
the next time they sign out and back in.

### Deploying this change

Apply the migration first, then deploy the function — the function reads
`role_mappings`, which the migration creates. Pages redeploys on its own when
the pull request merges, and that frontend reads `role`, so do both right after
merging:

```sh
supabase db push
supabase functions deploy verify-discord-role --use-api
supabase functions deploy translate-guild-post --use-api
```

Optional: set a contact email so MyMemory raises the free daily character quota
for guild-news translation:

```sh
supabase secrets set MYMEMORY_EMAIL=you@example.com
```

`--use-api` bundles the function on Supabase's side, so Docker is not needed.

If `db push` stops at `20260912150000_create_editor_access.sql` because
`editor_access` already exists, the table was created before migrations were
tracked, and nothing after it has been applied. Check with
`supabase migration list`, mark that one as applied, and push again:

```sh
supabase migration repair --status applied 20260912150000
supabase db push
```

The old `can_edit` column is kept in step by the function so the currently
deployed frontend keeps working until Pages redeploys. It can be dropped once no
deployed frontend reads it.
