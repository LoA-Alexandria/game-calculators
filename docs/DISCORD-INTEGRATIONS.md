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

Set the VIP role id and deploy the function after the usual Supabase setup:

```powershell
supabase secrets set DISCORD_VIP_ROLE_ID="<Discord VIP role id>"
supabase functions deploy sync-premium-discord-role --use-api
```

The function uses the normal authenticated Edge Function JWT check and checks
admin access in Supabase before it can synchronize somebody else's role.
`SUPABASE_SERVICE_ROLE_KEY` is used only server-side. Never place bot or
service-role credentials in `NEXT_PUBLIC_*` variables or the static site.
