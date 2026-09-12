# Discord authentication and guide publishing

## Current implementation

The site remains a static GitHub Pages export, while Supabase provides the
trusted server-side boundary:

- Supabase Auth performs Discord OAuth.
- The frontend requests `identify` and `guilds.members.read`.
- `verify-discord-role` checks the member against guild `1534685294371274822`.
- Coders (`1534890988588498944`) and Builders (`1534693394692178161`) receive
  guide-writer access.
- The function cross-checks the Discord identity against the signed-in
  Supabase identity before writing `editor_access`.
- Row Level Security lets each member read only their own access record.

The browser uses editor access to show or hide the guide editor. Future write
policies must independently check the same server-maintained access table;
hiding a button is not authorization.

The old browser-only demo accounts and admin page have been removed. Never add
passwords, Discord access tokens, service-role keys, or database credentials to
the static application.

## Guide editor boundary

`/guides/new/` is a frontend editor. It currently supports structured sections,
image previews, local draft saving, and JSON export. It does not yet publish or
upload anything. Data remains on the editor's device unless they explicitly
copy the JSON.

The shared wiki phase should add:

1. `wiki_pages` with slug, title, summary, status, author, and timestamps.
2. `wiki_revisions` with immutable content snapshots and editor identity.
3. Optional Storage buckets for uploaded images.
4. Public read policies for published pages.
5. Editor write policies requiring a current `editor_access.can_edit` row.
6. Draft, preview, publish, unpublish, and revision-restore operations.

Every write must be protected by database policies or an authenticated Edge
Function. Do not trust a role value supplied by browser code.

## Setup

Follow [`SUPABASE-SETUP.md`](SUPABASE-SETUP.md) to configure GitHub variables,
apply the migration, and deploy the Discord role-verification function.
