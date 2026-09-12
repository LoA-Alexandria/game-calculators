# Discord login, roles, and the guide editor — integration guide

This document is for whoever builds the backend. The interface is finished and
the data shapes are fixed; what is missing is everything that enforces them.

---

## 1. Read this first

**There is no security in the current build.** The site is exported as static
files (`output: "export"` in `next.config.ts`). Nothing on GitHub Pages can
verify a password, so the sign-in screen checks a list that ships to the browser
in plain text, and the resulting "session" is a localStorage entry the visitor
can write themselves.

Concretely, today anyone can:

- read the demo passwords in the JavaScript bundle;
- open devtools and set `popepoch-demo-session` to `{"role":"admin",…}`;
- open `/admin/` and `/guides/new/` directly.

None of that matters yet, because those screens cannot change anything anyone
else sees. It starts mattering the moment a real write endpoint exists.

**So: the first real endpoint and the removal of the demo must land together.**

### Blocking architectural decision

GitHub Pages cannot host the server side. It serves static files, so it cannot
keep a Discord client secret, cannot answer an OAuth callback, and cannot set a
signed cookie. Something else has to.

**That decision is already made, on another branch.** `feat/discord-wiki-auth`
(commit `c6d8110`, unmerged at the time of writing) keeps the site on Pages and
puts the server side in **Supabase**. It is real, working code, not a mock:

```text
lib/supabase/client.ts                                  browser client
app/components/AuthControls.tsx                         sign-in UI
supabase/functions/verify-discord-role/index.ts         Edge Function
supabase/migrations/…_create_editor_access.sql          editor_access table + RLS
docs/SUPABASE-SETUP.md                                  setup steps
.env.example                                            NEXT_PUBLIC_SUPABASE_*
```

What that branch already does well, and should not be redone:

- Discord sign-in through Supabase Auth, with the guild id and editor role ids
  in the Edge Function.
- It **cross-checks the Discord user id against the Supabase identity** before
  trusting the roles, which stops a borrowed provider token from granting
  access. Keep this check.
- `editor_access` has row-level security on, `revoke all` from `anon` and
  `authenticated`, and a policy letting each user read only their own row.
- CORS restricted to the Pages origin and `localhost:3000`.

### Where this branch and that one disagree

| | `feat/discord-wiki-auth` | what the admin screens here assume |
| --- | --- | --- |
| Model | one `can_edit` boolean | three roles: `admin`, `manager`, `guide_writer` |
| Role mapping | guild and role ids **hardcoded in the Edge Function** | rows in a table, edited in the admin panel |
| Sign-in | real Supabase Discord OAuth | a mock that must be deleted |

Reconciling them is the next piece of work, and it is mostly that branch's
model growing rather than this one's:

1. Replace `editor_access.can_edit` with `role text not null` (or add a
   `member_roles` table) so the three roles fit.
2. Move the hardcoded `EDITOR_ROLE_IDS` out of the function into a
   `role_mappings` table, and have the function read it. Without that step the
   admin panel cannot assign anything — it would be editing rows nothing reads.
3. Apply `highestRole()` from `lib/auth/roles.ts` when a member holds several
   mapped Discord roles.
4. Delete the mock: `lib/auth/demo.ts` and the sign-in card, replaced by
   `AuthControls.tsx`.

The rest of this document describes the target shape. Read it as *what the
interface expects*, not as a proposal to start over — where it says "a session
endpoint", Supabase Auth already provides one.

---

## 2. What already exists

```text
lib/auth/roles.ts                   roles, permissions, the rank rule — the contract
lib/auth/demo.ts                    DEMO DATA. Delete this file. Its types are the API shapes.
app/components/AuthProvider.tsx     session + mapping state; swap its two stores for fetches
app/components/SignInGate.tsx       sign-in card and <PermissionGate>
app/admin/page.tsx                  role mapping, team, permission matrix, integration notes
app/admin/layout.tsx                noindex metadata
app/guides/new/page.tsx             guide editor with image picker and JSON export
app/guides/new/layout.tsx           noindex metadata
```

`lib/auth/roles.ts` is the important one. It is deliberately free of any
UI or demo code so the server can import it unchanged.

```ts
ROLES            = ["admin", "manager", "guide_writer"]
PERMISSIONS      = ["guides.draft", "guides.publish", "news.write",
                    "media.upload", "roles.assign", "members.manage",
                    "settings.manage"]
ROLE_PERMISSIONS = { admin: all, manager: […], guide_writer: […] }
ROLE_RANK        = { guide_writer: 1, manager: 2, admin: 3 }
can(role, permission)
highestRole(roles)
```

**`highestRole` matters.** A Discord member often holds several mapped roles at
once. Without a fixed rule their effective role depends on the order Discord
happens to return roles in, which makes permissions flaky and very hard to
debug. Use `highestRole` on the server too.

### The UI only hides things

`<PermissionGate permission="…">` and `allows("…")` decide what to render. They
are conveniences for the reader, not a boundary — the page and its code are
already in the browser. **Check every write again on the server.** A hidden
button is not a locked door.

---

## 3. Discord setup

> **With Supabase** you do not build this flow yourself. The Discord provider
> is configured under *Authentication → Providers* in the Supabase dashboard,
> the client secret lives there, and the callback is Supabase's own. The scopes
> and the guild id still matter, and `feat/discord-wiki-auth` already sets them.
> Read this section for *what* has to happen and why, not as steps to type.

1. <https://discord.com/developers/applications> → **New Application**.
2. **OAuth2** → add a redirect URL: `https://<your-host>/api/auth/callback`.
3. Note the **Client ID** and **Client Secret**. The secret is server-side only
   — never in `NEXT_PUBLIC_*`, never in the repo.
4. Scopes: `identify` (who they are) and `guilds.members.read` (their roles in
   your guild). Do **not** ask for `email` unless you actually need it.
5. Note your **Guild ID** (right-click the server → Copy server ID; needs
   developer mode in Discord's advanced settings).

Environment variables:

```sh
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...      # server only
DISCORD_GUILD_ID=...
SESSION_SECRET=...             # 32+ random bytes, for signing the cookie
DATABASE_URL=...
```

### The flow

```text
/api/auth/login     → redirect to Discord authorize URL, with a random `state`
                      stored in a short-lived httpOnly cookie
/api/auth/callback  → verify `state`, exchange `code` for a token,
                      GET /users/@me                     → id, username, avatar
                      GET /users/@me/guilds/{guild}/member → roles: string[]
                      map those role IDs through role_mappings,
                      role = highestRole(matches)  →  null means no access
                      upsert the member, set a signed session cookie
/api/auth/logout    → clear the cookie
/api/session        → return the `Session` shape, or 401
```

Cookie: `httpOnly`, `Secure`, `SameSite=Lax`, and a sensible `Max-Age`. Store
the user id and role inside it — signed, not encrypted-only, so it cannot be
edited. **(B)** Cross-origin needs `SameSite=None; Secure` and a CORS allowlist,
or a bearer token in `Authorization` instead of a cookie.

### Re-check roles, do not trust the cookie forever

Someone losing their Discord role should lose site access. Either keep the
session short (a few hours) and re-read roles on renewal, or re-read them on
every permission-sensitive request. Decide and write it down.

---

## 4. Database

> **With Supabase**, `members` below and the existing `editor_access` table are
> the same thing under two names. Grow `editor_access` rather than adding a
> second table, keep its row-level security, and add a policy so `admin` may
> read every row — the team list in the panel needs that.

Names are suggestions; the columns are what the interface needs. `package.json`
already has a `db:generate` script for `drizzle-kit`, which suggests Drizzle was
the intent — nothing here depends on that choice.

```sql
-- who may do what
CREATE TABLE members (
  id            TEXT PRIMARY KEY,       -- Discord user id (snowflake)
  name          TEXT NOT NULL,          -- display name at last sign-in
  discord_tag   TEXT NOT NULL,
  role          TEXT NOT NULL,          -- 'admin' | 'manager' | 'guide_writer'
  last_seen     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- edited by the admin panel's "Roles & Discord" tab
CREATE TABLE role_mappings (
  id                 TEXT PRIMARY KEY,
  discord_role_name  TEXT NOT NULL,     -- for humans; may drift from Discord
  discord_role_id    TEXT NOT NULL UNIQUE,  -- what the matching uses
  role               TEXT NOT NULL
);

-- one row per guide, language-independent
CREATE TABLE guides (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,   -- /guides/<slug>/
  status        TEXT NOT NULL,          -- 'draft' | 'published'
  author_id     TEXT NOT NULL REFERENCES members(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ
);

-- one row per guide per language
CREATE TABLE guide_translations (
  guide_id   TEXT NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  locale     TEXT NOT NULL,             -- 'en' | 'de' | 'fr'
  title      TEXT NOT NULL,
  summary    TEXT NOT NULL,
  intro      TEXT NOT NULL,
  sections   JSONB NOT NULL,            -- [{ heading, body: string[] }]
  note       TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (guide_id, locale)
);

CREATE TABLE media (
  id          TEXT PRIMARY KEY,
  guide_id    TEXT REFERENCES guides(id) ON DELETE SET NULL,
  url         TEXT NOT NULL,
  alt         TEXT NOT NULL DEFAULT '',
  width       INTEGER,
  height      INTEGER,
  bytes       INTEGER NOT NULL,
  mime        TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES members(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Why translations are a separate table.** The site ships English, German, and
French, and a guide that exists in only one of them would render as a blank page
in the others. Decide the fallback rule and make it explicit — showing the
English text with a "not translated yet" note is friendlier than an empty page.
See [`CONTENT-AND-LANGUAGES.md`](CONTENT-AND-LANGUAGES.md).

---

## 5. Endpoints the interface expects

> **With Supabase** most of these are not hand-written routes. Reads go through
> PostgREST with row-level security doing the authorisation, and only the
> operations that need a secret or a privileged write — verifying Discord roles,
> changing someone's role, accepting an upload — become Edge Functions. The
> table still tells you which permission guards which operation.

Permissions in the right column come from `ROLE_PERMISSIONS`.

| Method and path | Body / result | Required permission |
| --- | --- | --- |
| `GET /api/session` | `Session` or 401 | — |
| `GET /api/members` | `Member[]` | `members.manage` |
| `PATCH /api/members/:id` | `{ role }` | `members.manage` |
| `GET /api/role-mappings` | `RoleMapping[]` | — (needed to resolve a login) |
| `POST /api/role-mappings` | `{ discordRoleName, discordRoleId, role }` | `roles.assign` |
| `DELETE /api/role-mappings/:id` | — | `roles.assign` |
| `GET /api/guides?status=` | guide list | `guides.draft` for drafts |
| `POST /api/guides` | the editor's export payload | `guides.draft` |
| `PUT /api/guides/:id` | same payload | `guides.draft` (own) / `guides.publish` |
| `POST /api/guides/:id/publish` | — | `guides.publish` |
| `POST /api/media` | `multipart/form-data` → `{ id, url, width, height }` | `media.upload` |

The `Session`, `Member`, and `RoleMapping` types are in `lib/auth/demo.ts`.
**Move them to `lib/auth/types.ts` when you delete that file** — the components
import them and expect exactly those fields.

### The guide payload

Press **Export** in the editor to see it live. It is:

```json
{
  "slug": "water-supply",
  "title": "…",
  "summary": "…",
  "intro": "…",
  "sections": [{ "heading": "…", "body": ["paragraph", "paragraph"] }],
  "note": "…",
  "images": [{ "name": "field.png", "size": 21943, "type": "image/png" }]
}
```

`images` currently lists only what the writer picked, because nothing is
uploaded. Once `POST /api/media` exists, upload first and replace the entries
with `{ id, url, alt }`.

### Image upload — do not skip the checks

An upload endpoint that accepts anything is the most common way a site like this
gets taken over. At minimum:

- allow-list the MIME types you actually want (`image/png`, `image/jpeg`,
  `image/webp`, `image/gif`) and **verify the file's magic bytes**, not the
  `Content-Type` header or the extension;
- cap the size (2–5 MB is plenty for a guide) and reject early;
- re-encode server-side (sharp) rather than storing the original — this strips
  EXIF and neutralises anything hidden in the file;
- generate your own filename; never use the uploaded one in a path;
- serve from a separate domain or a storage bucket, never from the app origin
  with an inline `Content-Disposition`;
- require `media.upload` and record `uploaded_by`.

`sharp` is already an installed dependency (Next pulls it in), so re-encoding
costs nothing extra.

---

## 6. Swapping the demo out

The interface needs three changes, all inside `app/components/AuthProvider.tsx`.

1. **Session.** Replace the `sessionStore` external store with a fetch of
   `/api/session`. `signIn` becomes a redirect to `/api/auth/login`, `signOut` a
   `POST /api/auth/logout`. The `Session` shape stays as it is, minus `demo`.
2. **Mappings.** Replace `mappingStore` with `GET /api/role-mappings`, and make
   `setMappings`/`resetMappings` call the POST and DELETE endpoints.
3. **Delete `lib/auth/demo.ts`**, move the types out first, and remove
   `SignInCard`'s credential list plus the demo warnings in
   `app/admin/page.tsx` and `app/guides/new/page.tsx`.

Then delete `SESSION_STORAGE_KEY`, `MAPPINGS_STORAGE_KEY`, and
`GUIDE_DRAFT_STORAGE_KEY` from `lib/site.ts`.

### Checklist before the first real write endpoint

- [ ] `lib/auth/demo.ts` deleted, types moved
- [ ] Demo warnings removed from the admin and editor screens
- [ ] Session cookie signed, `httpOnly`, `Secure`, `SameSite` set
- [ ] `state` verified on the OAuth callback (CSRF)
- [ ] Every write endpoint checks `can(role, permission)` server-side
- [ ] Upload validates magic bytes, caps size, re-encodes, renames
- [ ] Roles re-read from Discord on a defined schedule
- [ ] `/admin/` and `/guides/new/` return 401/403 without a session,
      not just a hidden UI
- [ ] Rate limiting on login and upload

---

## 7. Things worth deciding early

- **Who may publish?** Right now `guide_writer` drafts and `manager` publishes.
  That is a guess — change `ROLE_PERMISSIONS` if your team works differently.
- **Editing someone else's draft.** The permission table has no notion of
  ownership. If writers should only edit their own drafts, that check belongs in
  the endpoint, against `guides.author_id`.
- **Audit trail.** A `role_changes` table (who changed whose role, when) costs
  little and answers questions that are otherwise unanswerable.
- **Removing a Discord role** should remove site access. See §3.
- **News entries** currently live in the dictionaries and are deployed with the
  site. If `news.write` should mean "write news in the panel", news needs the
  same table treatment as guides.
