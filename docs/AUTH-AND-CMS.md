# Authentication and guide publishing

## Current implementation

The site remains a static GitHub Pages export, while Supabase provides the
trusted server-side boundary:

- Supabase Auth supports Discord OAuth and username/password accounts.
- Discord sign-in requests `identify` and `guilds.members.read`.
- Password sign-up stores a username in `profiles` (3–24 letters,
  numbers, or underscores). Members never enter an email; the client maps
  the username to a private synthetic address for Supabase Auth only.
- `verify-discord-role` checks Discord members against guild
  `1534685294371274822`, reads `role_mappings`, and writes the highest
  matching site role to `editor_access.role`. Rank is
  `guide_writer < manager < admin`. Password-only accounts do not get a
  Discord role check unless they later link Discord.
- Coders (`1534890988588498944`) and Builders (`1534693394692178161`) are
  seeded as `guide_writer`. Admins change the mapping at `/admin/`; those Discord
  role ids are not hardcoded in the function.
- The function cross-checks the Discord identity against the signed-in
  Supabase identity before writing `editor_access`.
- Row Level Security lets each member read only their own access record;
  admins can read every row. Signed-in members can read `role_mappings`; only
  admins can change it.

### Premium

Premium is an entitlement in `premium_entitlements`, not a site role and not a
PayPal subscription webhook. Members pay via the PayPal NCP link on `/premium/`,
submit a claim with their transaction id (`premium_claims`), and an admin
approves the claim to extend `expires_at` by 30 days. Active Premium unlocks
tools marked `premium: true` in `lib/navigation.ts` and allows one
`guild_create_requests` row (pending or approved). Rejected guild requests
free the slot. One open row is the whole rule: a renewed month does not buy a
second guild while the first is still pending or approved.

A request says who the guild is for. `owner_kind: 'self'` points at the
requester through `owner_user_id`; `'other'` names somebody else, by Discord
snowflake in `master_discord_user_id` or by account name in `master_handle`
when no snowflake was given. An empty name means the requester, so the form
cannot leave a guild ownerless. `guilds.master_discord_user_id` is still
required, so the admin queue asks for the snowflake before it creates the
guild — a password account has none of its own. The server is stored in two
parts (`server_number`, `server_name`) and joined by `formatGuildServer` into
the one label the guild carries, `S12 Garden`.

**A guild freezes when its Premium runs out.** `guild_is_frozen` asks whether
the account in `guilds.owner_user_id` still has Premium; admin-created guilds
(no owner) never freeze. Reads are untouched — the guild, its posts, its roster
and its plans all stay visible — but every write is refused.

That rule is a trigger, not forty edited policies: `guard_guild_write` is
attached to each guild-scoped table (and to `guilds` on update only, so the
owner can still delete a frozen listing). Two things always pass: a site
admin, who is how a frozen guild gets unstuck, and a member's own membership
row on its way to `rejected` — **leaving a guild always works**, frozen or
not. The client mirrors this with `guildRoomPowers` in `lib/content/guilds.ts`
and a banner in the room; the trigger is what actually enforces it.

`frozen_guild_ids()` lists every frozen guild in one call for the guild list.

Admins can also grant Lifetime Premium from the Premium tab on `/admin/`. That
writes the same table with `source: 'manual'`, `note: 'lifetime'`, and
`expires_at` set to `2099-01-01` (see `lifetimePremiumExpiry` in
`lib/content/premium.ts`). No schema flag is required: `isPremiumActive` and
RLS `has_active_premium` already treat any active row with a future expiry as
Premium. Admins can revoke Lifetime from the same tab; that sets
`status: 'revoked'` and clears the lifetime note. The member sees the change
after the next session reload (`refreshSession` / page refresh); a full
re-login is not required.

`authenticated` needs table grants for `select, insert, update, delete` on
`premium_entitlements`; RLS still blocks non-admin writes. If claim approval
fails with `permission denied for table premium_entitlements`, apply
`20260929120000_premium_entitlements_write_grants.sql` via `supabase db push`.

Site roles and UI permissions live in `lib/auth/roles.ts`. The Edge Function
keeps the same rank table. The browser uses the stored role to show or hide
editors and the admin link (`roles.assign`). Future write policies must
independently check the server-maintained access table; hiding a button is not
authorization.

`editor_access.can_edit` is kept in step with `role` (`true` when a role is
present) so older frontends keep working. New code should read `role`.

The admin panel at `/admin/` is gated in the interface by `roles.assign`.
Writes are enforced by RLS, not by that gate.

Never commit passwords, Discord access tokens, service-role keys, or database
credentials into the static application.

Setup, the first-admin mapping, and deploy order are in
[`SUPABASE-SETUP.md`](SUPABASE-SETUP.md).

## Guide editor boundary

`/guides/new/` is a frontend editor. It currently supports structured sections,
image previews, local draft saving, and a snippet to commit into the
dictionaries and navigation — the same pattern as news. Existing
guides can be edited or removed from the guide page and the Guides index.
It does not yet publish to a shared wiki table. Data remains on the editor's
device unless they copy the snippet and commit it.

The shared wiki phase should add:

1. `wiki_pages` with slug, title, summary, status, author, and timestamps.
2. `wiki_revisions` with immutable content snapshots and editor identity.
3. Optional Storage buckets for uploaded images.
4. Public read policies for published pages.
5. Editor write policies requiring a current `editor_access` row whose role
   includes the matching permission. Do not rely on the deprecated `can_edit`
   column for new policies.
6. Draft, preview, publish, unpublish, and revision-restore operations.

Every write must be protected by database policies or an authenticated Edge
Function. Do not trust a role value supplied by browser code.
