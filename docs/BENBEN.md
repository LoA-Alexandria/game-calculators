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

The browser-first integration lives in the `benben-discord` Supabase Edge
Function:

1. A member runs `/benben` in Discord.
2. Discord receives an ephemeral **Open Benben** link containing a signed,
   six-hour launch token for that server channel. Each server channel has its
   own Benben instance; a command in a new channel starts a fresh one.
3. The page stores the token in `sessionStorage`, removes it from the visible
   address, and otherwise behaves like a normal Benben page.
4. A signed-in member's care action is sent to the Edge Function. The function
   validates both the Supabase user session and launch token, then calls the
   existing `care_for_benben` RPC as that user. PostgreSQL therefore remains
   authoritative for action limits and state changes.
5. The bot creates or edits one reusable Benben status message in the originating
   Discord channel. The message includes a fresh **Open Benben** link, so another
   member can continue from Discord without running the command again.

The channel and reusable message id are stored service-role-only in
`benben_discord_channels`. An invalid or expired launch token cannot choose a
channel. Bot credentials and the Supabase service-role key never reach the
browser. If Discord posting fails after a valid care action, the care remains
saved and the page shows a warning.

The standard `/benben/` URL remains a separate, shared web-community Benben.
Benben can be installed in additional Discord servers; the site's editor roles
remain specific to the Pop Epoch server.

### One-time setup

Apply the migrations, then set these Edge Function secrets:

```sh
supabase db push
supabase secrets set \
  DISCORD_APPLICATION_PUBLIC_KEY="<Discord application's public key>" \
  DISCORD_BOT_TOKEN="<Discord bot token>" \
  BENBEN_LAUNCH_SECRET="<a long random secret>" \
  BENBEN_SITE_URL="https://loa-alexandria.github.io/game-calculators/benben/"
supabase functions deploy benben-discord --no-verify-jwt --use-api
```

`--no-verify-jwt` is required because Discord interactions do not carry a
Supabase JWT. The function still verifies Discord's Ed25519 signature for
interactions and explicitly validates Supabase sessions for browser requests.

In the Discord Developer Portal, set the application's **Interactions Endpoint
URL** to:

```text
https://puaggqclhyzckitetsfc.supabase.co/functions/v1/benben-discord
```

Invite the application's bot to the server with `bot` and
`applications.commands` scopes. It needs **View Channel**, **Send Messages**,
**Embed Links**, and **Read Message History** in channels where Benben is used.

Register the server command from a terminal without saving credentials in a
file:

```sh
DISCORD_APPLICATION_ID="<application id>" \
DISCORD_BOT_TOKEN="<bot token>" \
npm run discord:register-benben
```

Guild command registration is used so `/benben` appears immediately in the Pop
Epoch server. To register it in another server, add
`DISCORD_GUILD_ID="<that server id>"` before the command. Re-running the
registration script updates/adds the command.

### Launch checklist

- [ ] Merge and publish the site branch so
  `https://loa-alexandria.github.io/game-calculators/benben/` is live.
- [ ] In the Supabase Dashboard, confirm that both Benben migrations are shown
  as applied. If they are not, from the repository run `supabase db push`.
- [ ] In the Discord Developer Portal for the same application used for Discord
  sign-in, create/enable its bot. Copy the **Application ID** and **Public Key**
  from **General Information**, then reset and copy the bot token from **Bot**.
- [ ] Invite the bot to the Pop Epoch server with the `bot` and
  `applications.commands` scopes. Give it **View Channel**, **Send Messages**,
  **Embed Links**, and **Read Message History** in the test channel.
- [ ] Generate a private launch secret, for example with
  `openssl rand -base64 48`. Do not add it or the bot token to GitHub or
  `.env.local`.
- [ ] Set the four Edge Function settings (`DISCORD_APPLICATION_PUBLIC_KEY`,
  `DISCORD_BOT_TOKEN`, `BENBEN_LAUNCH_SECRET`, and `BENBEN_SITE_URL`) and deploy
  with `supabase functions deploy benben-discord --no-verify-jwt --use-api`.
- [ ] Set the Discord application's **Interactions Endpoint URL** to the
  `benben-discord` function URL shown above. Discord verifies it immediately;
  do not save the setting until that check succeeds.
- [ ] Run the registration command with the Application ID and bot token to add
  `/benben` to the Pop Epoch server.
- [ ] In a test channel, run `/benben`, click **Open Benben**, sign in, and make
  one care action. Confirm that one Benben card appears in that channel and is
  edited after another action.
- [ ] Repeat in a second channel: it should begin at Benben's fresh default
  stats and create a separate status card.

For another server, invite the same bot there and register the command again
with that server's id. Its channels automatically receive independent Benbens;
no additional database setup is needed.

Possible later additions:

- A daily Benben status post in a chosen channel.
- A share button or link from the web page to the Discord command.
- Phoenix-arrival announcements.
- A Discord Activity that embeds the full visual game. This is substantially
  more work than commands and buttons and is not needed for the first version.
