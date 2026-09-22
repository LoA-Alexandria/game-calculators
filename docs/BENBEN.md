# Benben communal pet

Benben is a communal Tamagotchi-style stone pyramid at `/benben/`. The page is
deliberately absent from the site navigation while it is being developed.

## Current implementation

- Branch: `feat/benben-community-pet`
- Local development uses `localStorage`, does not require Discord sign-in, and
  has unlimited actions.
- Production reads and writes the shared state through Supabase RPC functions.
- Signed-in members receive three care actions per UTC day.
- Care actions are feed, polish, sunbathe (`play` in stored data), and rest.
- Care animations finish before Benben shows the temporary happy expression.
- Sunbathing increments a hidden shared counter. Reaching its randomized goal
  summons a phoenix for 24 hours.
- Supabase Realtime refreshes the web page when the state or activity log
  changes.
- Character and phoenix artwork is stored as transparent WebP under `public/`.

The database objects live in
`supabase/migrations/20260913103000_create_benben.sql`. Its remote deployment
status has not been confirmed. The linked account currently receives a 403
from `supabase migration list`, so check the Dashboard migration history or use
an account with the required project privileges before pushing migrations.

## Discord integration

The recommended first Discord feature is a `/benben` application command that
shows the communal state and four buttons: Feed, Polish, Sunbathe, and Rest.
Button presses should update the same Supabase state as the web page.

This requires a Supabase Edge Function because GitHub Pages cannot securely
receive Discord interactions. The function should:

1. Verify Discord's Ed25519 request signature before reading an interaction.
2. Answer Discord's endpoint-verification ping.
3. Render `/benben` as an ephemeral or channel-visible status message.
4. Handle the four component button custom ids.
5. Use the verified Discord user id to locate the user through
   `editor_access.discord_user_id`.
6. Call a service-role-only database function that applies the same daily limit
   and state transition rules as `care_for_benben`.
7. Return an updated embed and buttons within Discord's response deadline.

Do not accept a Discord user id supplied in an unverified request, expose the
service-role key to the browser, or duplicate care rules only in TypeScript.
Keep the authoritative transition and limit checks in PostgreSQL.

The Discord application will need an interactions endpoint URL, application id,
public key, and bot token stored as Edge Function secrets. The bot token is
needed to register commands and for optional scheduled/channel posts; it is not
needed merely to verify incoming signatures.

Possible later additions:

- A daily Benben status post in a chosen channel.
- A share button or link from the web page to the Discord command.
- Phoenix-arrival announcements.
- A Discord Activity that embeds the full visual game. This is substantially
  more work than commands and buttons and is not needed for the first version.

