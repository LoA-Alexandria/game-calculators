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

The role check currently grants access for:

- Coders: `1534890988588498944`
- Builders: `1534693394692178161`

The guild is `1534685294371274822`. Update the function and deploy it again if any of these IDs change.
