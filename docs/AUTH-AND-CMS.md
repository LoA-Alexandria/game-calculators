# Discord authentication and guide publishing

## Current implementation

The site remains a static GitHub Pages export, while Supabase provides the
trusted server-side boundary:

- Supabase Auth performs Discord OAuth.
- The frontend requests `identify` and `guilds.members.read`.
- `verify-discord-role` checks the member against guild `1534685294371274822`.
- The function then reads `role_mappings` and writes the highest matching site
  role to `editor_access.role`. Rank is `guide_writer < manager < admin`.
- Coders (`1534890988588498944`) and Builders (`1534693394692178161`) are
  seeded as `guide_writer`. Admins change the mapping at `/admin/`; those Discord
  role ids are not hardcoded in the function.
- The function cross-checks the Discord identity against the signed-in
  Supabase identity before writing `editor_access`.
- Row Level Security lets each member read only their own access record;
  admins can read every row. Signed-in members can read `role_mappings`; only
  admins can change it.

Site roles and UI permissions live in `lib/auth/roles.ts`. The Edge Function
keeps the same rank table. The browser uses the stored role to show or hide
editors and the admin link (`roles.assign`). Future write policies must
independently check the server-maintained access table; hiding a button is not
authorization.

`editor_access.can_edit` is kept in step with `role` (`true` when a role is
present) so older frontends keep working. New code should read `role`.

The admin panel at `/admin/` is gated in the interface by `roles.assign`.
Writes are enforced by RLS, not by that gate.

Never add passwords, Discord access tokens, service-role keys, or database
credentials to the static application.

Setup, the first-admin mapping, and deploy order are in
[`SUPABASE-SETUP.md`](SUPABASE-SETUP.md).

## Guide editor boundary

`/guides/new/` is a frontend editor. It currently supports structured sections,
image previews, local draft saving, and a snippet to commit into the
dictionaries and navigation — the same pattern as news and the overview
schedule editor (`events.write`). Existing
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
