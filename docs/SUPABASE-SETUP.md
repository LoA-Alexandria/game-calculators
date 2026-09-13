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
supabase functions deploy verify-discord-role
```

Supabase automatically provides the function with its project URL, anon key, and service-role key. Do not commit those secrets.

The guild is `1534685294371274822` and stays in the function.

Which Discord role grants which site role is **no longer in the function**: it
lives in the `role_mappings` table and is edited at `/admin/` by an admin. The
migration seeds it with the two roles that used to be hardcoded (Coders and
Builders, both `guide_writer`), so applying it changes nothing on its own.

A member holding several mapped roles gets the highest one, ranked
`guide_writer < manager < admin`. The same rule is in `lib/auth/roles.ts`; keep
the two in step.

### The first admin

Nobody can grant `admin` through the interface until an admin exists, so promote
one by hand once after applying the migration:

```sql
update public.editor_access set role = 'admin' where discord_user_id = '<your discord id>';
```

### Deploying this change

Apply the migration and redeploy the function together — the function writes
`role`, which the migration adds:

```sh
supabase db push
supabase functions deploy verify-discord-role
```

The old `can_edit` column is kept in step by the function so the currently
deployed frontend keeps working until Pages redeploys. It can be dropped once no
deployed frontend reads it.
