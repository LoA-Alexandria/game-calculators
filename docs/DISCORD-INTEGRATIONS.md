# Discord bot integrations

The site uses its existing Discord application and Supabase Edge Functions for
formatted content sharing and Premium VIP role synchronization.

## Share news, guides, and events

In the Pop Epoch Discord server, run `/share-content` and choose News, Guide, or
Event. Add the published page title, a short summary, and its public site link.
The bot posts a category-coloured embed in the channel where the command was
used. It accepts only HTTPS links under
`loa-alexandria.github.io/game-calculators/`, disables mentions, and requires
the Discord **Manage Messages** permission. This is a manual publish step:
guides and news are currently committed static content, so the bot does not
announce drafts or every site deployment.

Deploy the updated `benben-discord` function and register the commands using
the setup in [BENBEN.md](BENBEN.md). The registration script upserts `/benben`
and `/share-content` without replacing the application's other commands.

## Premium VIP role

`sync-premium-discord-role` assigns the configured Discord role only when the
target account has an active, in-date `premium_entitlements` row and a verified
Discord id in `editor_access`. It removes the role when the entitlement is
expired, revoked, or absent. The admin claim screen invokes it immediately
after a PayPal claim is approved; it also runs when a linked member signs in,
which catches expirations and revocations the next time they return.

The current PayPal NCP flow is not a payment webhook: members submit their
PayPal transaction id and an admin approves the claim. VIP is therefore
assigned after that approval, not merely after a browser reports a purchase.
The claim queue remains the source of Premium status; role sync cannot grant
Premium by itself.

Configure these Supabase Edge Function secrets:

- `DISCORD_BOT_TOKEN`: the existing bot token, stored only in Supabase.
- `DISCORD_VIP_ROLE_ID`: the Discord VIP role id to assign.

The bot must be in guild `1534685294371274822`, have **Manage Roles**, and its
highest role must be above the VIP role. A member must have signed in to Pop
Epoch with the Discord account that should receive VIP; the function uses the
server-verified `editor_access.discord_user_id`, never a Discord id supplied
by the browser. Password-only accounts without a linked Discord identity are
left unchanged and the admin panel reports the sync failure.

## Early Supporter rewards

Admins can manually award the permanent Early Supporter status from **Admin →
Premium** to an account with active Premium. The database serializes grants and
reserves the first 20 places permanently; revoking a reward does not free its
place. The Discord sync assigns or removes two additional roles for this cohort
independently of the member's later Premium expiry:

- `DISCORD_EARLY_SUPPORTER_ROLE_ID` for Early Supporter.
- `DISCORD_TEST_VERSION_ROLE_ID` for early access to test builds.

Create both roles in Discord, allow the bot to manage them, and keep them below
the bot's highest role. Configure the ids as Supabase Edge Function secrets:

```powershell
supabase secrets set DISCORD_EARLY_SUPPORTER_ROLE_ID="<Early Supporter role id>"
supabase secrets set DISCORD_TEST_VERSION_ROLE_ID="<Test Version role id>"
supabase functions deploy sync-premium-discord-role --use-api
```

The first 20 are assigned manually, so admins should verify that a buyer is
eligible before awarding a place. Each supporter can separately opt in to
displaying a chosen name on `/early-supporters/` from `/account/`; public reads
expose only opted-in names and award dates. Polls and development previews are
hosted in the Discord channels you create for those roles.

Set the VIP role id and deploy the function after the usual Supabase setup:

```powershell
supabase secrets set DISCORD_VIP_ROLE_ID="<Discord VIP role id>"
supabase functions deploy sync-premium-discord-role --use-api
```

The function uses the normal authenticated Edge Function JWT check and checks
admin access in Supabase before it can synchronize somebody else's role.
`SUPABASE_SERVICE_ROLE_KEY` is used only server-side. Never place bot or
service-role credentials in `NEXT_PUBLIC_*` variables or the static site.
