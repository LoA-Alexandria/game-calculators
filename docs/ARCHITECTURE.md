# Architecture

## Overview

The project is a statically exported Next.js site. GitHub Pages serves the generated `out/` directory. Supabase provides Discord authentication, persistent wiki data, row-level authorization, and the small server-side functions needed for Discord role checks.

## Structure

```text
app/
  page.tsx                     Home: news slide, site stats, event calendar + schedule editor
  news/                        News index
  events/                      Event guides index (wiki icons + Discord tips)
  guides/<slug>/               Guides
  calculators/<slug>/          Calculators, plus their index
  simulations/<slug>/          Simulations, plus their index
  components/                  Shell, locale provider, icons, shared UI
  globals.css                  Design tokens and the whole visual system
  layout.tsx                   Document shell, theme bootstrap, providers
lib/
  calculators/<slug>.ts        Pure calculation logic
  calculators/errors.ts        Validation errors with translatable codes
  i18n/                        Language registry and dictionaries
  content/news.ts              News entries
  content/events.ts            Event schedule (overview calendar)
  content/guides.ts            Guide slug and dictionary-id helpers
  content/banners.ts           Optional section banner images
  navigation.ts                Section tree driving sidebar and indexes
  site.ts                      Base path, Discord, repository, storage keys
  theme.ts                     Colour-scheme ids and validation
  events.ts                    Schedule recurrence math (UTC)
docs/                          Human and agent guidance
public/
  tools/irrigation-planner/    Vendored standalone planner (see below)
tests/                         Calculation and output tests
.github/workflows/pages.yml    Test, build, and Pages deployment
```

## Navigation

`lib/navigation.ts` is the single source of truth for the sections and
their entries. The sidebar, the section index pages, and the sidebar filter all
read it, so a new tool is added in one place. Labels are functions of the
dictionary rather than literals. The sidebar can collapse to an icon rail on
wide screens; `/` or Ctrl/Cmd+K focuses the filter.

Guild rooms use `/guilds/room/…?guild=<slug>` because the site is a static
export and cannot pre-render unknown admin-created slugs at build time.

## Languages

Three languages ship (English, German, French) with a client-side switch and one
set of URLs. `app/components/LocaleProvider.tsx` holds the active language and
its number and date formatters; every string comes from `lib/i18n/dictionaries/`.
The English dictionary defines the `Dictionary` type, so an untranslated key
fails the build. See [`CONTENT-AND-LANGUAGES.md`](CONTENT-AND-LANGUAGES.md) for
the trade-offs and for how to add a language, guide, or news entry.

Because pages read the dictionary at runtime they are client components, so they
do not export `metadata`. Tab titles are set with `useDocumentTitle`.

## Theming

`app/globals.css` defines the colour, spacing, and type tokens. Light sits on
bare `:root`; dark is repeated under `prefers-color-scheme: dark` and under
`:root[data-theme="dark"]`, so an explicit brightness choice wins in both
directions. Colour schemes sit on `[data-scheme]` (`stone`, `lapis`, `papyrus`,
`steam`) and keep light/dark as a separate axis. `ThemeToggle` writes
`localStorage['popepoch-theme']`; `SchemeMenu` writes
`localStorage['popepoch-scheme']`. A small script in the root layout applies
both before first paint.

The default palette is warm stone neutrals with a teal primary (from the
section-banner HUDs) and copper-gold from the plaques. Type is Sora for
headings and Inter for text, both self-hosted by `next/font`.

The visual identity is built from original CSS geometry and hand-drawn SVG in
`app/components/Icons.tsx`. It evokes the setting without reproducing any
artwork, logo, icon, or typeface from the game; the footer states that the site
is an unofficial fan project.

## Discord roles and protected editing

`lib/auth/roles.ts` defines UI permissions. Supabase Auth supplies the signed-in
Discord identity, and the `verify-discord-role` Edge Function checks server
membership and the `role_mappings` table. The resulting `editor_access` row is
server-maintained and protected with RLS. `/admin/` is shown to members with
`roles.assign`; writes are enforced by RLS.

`/guides/new/` requires verified guide-writer access. New, edit, and remove
print a snippet to commit into the dictionaries and navigation; shared wiki
tables are still to be implemented. Read [`AUTH-AND-CMS.md`](AUTH-AND-CMS.md)
before adding any write path.

Community guilds live in Supabase (`guilds`, `guild_memberships`, `guild_posts`,
`guild_active_events`, `guild_event_days`, `guild_event_pledges`,
`guild_event_camps`, `guild_event_orders`, `guild_alliances`) with RLS. Admins
create guilds (name, server, optional icon in Storage bucket `guild-icons`, master
Discord ID). Signed-in players request to join with an optional note; masters and
officers review requests. Masters promote officers and edit guild settings. Officers
write News and run Planning events (activate catalog events, day scores, end-invest
pledges, Berlin-midnight timer). Members set their own roster display name and
pledge end-invest amounts.

Events whose def in `lib/content/guild-events.ts` carries a `camps` count also get
a siege board: a drawn map of the villages, with the plan sitting on top of it.
`SIEGE_MAPS` in `GuildSiegeCamps.tsx` holds the picture, its shape, and where
each village stands, in percent; an event with villages but no picture falls back
to a plain ring. Everything is done on the map, so the page around it stays
almost wordless: tapping a village names it right where it stands, marks it as
the guild's base, or gives it a number in the target order, and the marker then
carries that number, the rings and horns pointed at it and how many members
attack it.

Officers turn events on and off from a dialog that the board's own header opens.
Ending an event calls `end_guild_event`, which deletes its villages, stock, day
scores, pledges and any alliance for it, so the next match starts empty; the
dialog asks first.

Tapping a village opens a small card on the village itself, inside the map: the
name field, the base button, the target order, the horn share, the ring spread,
the call, and a row per member with one toggle that sends that member's attacks
to this village or back to “every village”. Nobody types how much they carry:
Military Tokens (Horns) are handed out as a share per target (0 to 100 percent in
quarters, `horn_share`) and Draupnir Rings either hit one camp or the whole field
(`ring_focus`, set on every target). Each marker shows its share, a ring when the
rings land there, and how many members attack it; the line under the map adds the
shares up and turns amber when they do not make 100 percent. The
card flips to the side of the village that has room and scrolls inside it; on a
phone it becomes a sheet at the bottom edge. Marking a village as the guild's
base names it after the guild unless someone typed another name. How soon a
village should fall has a colour — first red, then amber, then the accent — worn
by its number on the map, the edge of its marker and the order chips in the card.

Villages, the order, the horn share and the ring spread live in
`guild_event_camps`, and who attacks what in `guild_event_orders`, both one row
per siege day. `setCampPriority` keeps the
order contiguous when a village moves into it, swaps with it, or leaves it.
Officers write, active members read and keep their own row, and nothing crosses
guilds. An event with a siege map plans its rings and horns there, so the
end-invest block and its bank line are hidden for it.

Two guilds may plan one siege together, and each holds one village. A guild can
only offer an alliance once it has marked its own base: the offer carries that
village as `guild_alliances.from_slot`, and the policy refuses an offer without
one. The invited guild sees the offer in its own inbox, beside the join requests and
counted in the same badge, so nobody has to open an event to find it. Answering
goes through `respond_to_guild_alliance`, so nobody accepts their own offer;
accepting turns the event on and opens it. The guild then has to pick its own
village through
`set_alliance_base` — until `to_slot` is set the shared board only offers that
one step. That function takes the guild as an argument rather than reading it
from the caller: `is_guild_master` is true for a site admin at every guild, so
guessing the side put the village on the wrong guild. With both villages held, the guilds get a second board beside their own
— the same map, but on `guild_alliance_camps` and `guild_alliance_orders`, with
the two bases drawn from the alliance and `alliance_roster` naming the members of
both guilds. `is_alliance_member` and `is_alliance_officer` gate it, a village a
guild holds can never be a target, and each guild's own board stays private.
Ending the alliance, from either side, deletes the shared plan with it.

Players write to each other at `/post/` (top-bar Mail shortcut; not a left-rail
section). One table, `messages`, holds all three kinds and tells them apart by
`kind`: direct mail between two players, the chat of one guild, and the chat the
two guilds of an alliance share. RLS decides who reads what — sender or recipient
for mail, `is_guild_member` for a guild chat, `is_alliance_member` for an alliance
chat — and the two chats are plain inserts.

Direct mail goes through `send_direct_message`, which refuses a recipient who
blocked the sender (`message_blocks`, a list only its owner can read) and stops
after thirty letters an hour. `find_people` searches everybody by the name
Discord gives them, falling back to a guild display name, and leaves out anyone
who blocked the searcher; `message_names` resolves the names on screen. Unread
mail is a letter that came in with no `read_at`; for the chats, `message_reads`
keeps one mark per reader and channel. The page polls every twenty seconds.

## Vendored applications

`public/tools/irrigation-planner/` holds a complete standalone application that
is embedded by a wrapper page rather than ported page by page. The reasoning, the
exact changes made to the copy, and the update procedure are in
[`IRRIGATION-PLANNER.md`](IRRIGATION-PLANNER.md). Treat it as an exception:
new calculators follow [`ADDING-A-CALCULATOR.md`](ADDING-A-CALCULATOR.md).

## Design boundaries

- Components collect and display values.
- Pure functions perform calculations and validation.
- Versioned constants hold game data.
- Tests describe the expected rules and edge cases.
- Calculators remain browser-only and independent of authentication. Wiki features use the Supabase browser client with its publishable key and RLS-protected tables. Discord and Supabase secrets exist only in their respective dashboards and Supabase Edge Functions.

When a calculation grows beyond a few lines, place it in `lib/calculators/<slug>.ts` and test it independently.
