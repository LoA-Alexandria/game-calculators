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
`guild_event_camps`) with RLS. Admins
create guilds (name, server, optional icon in Storage bucket `guild-icons`, master
Discord ID). Signed-in players request to join with an optional note; masters and
officers review requests. Masters promote officers and edit guild settings. Officers
write News and run Planning events (activate catalog events, day scores, end-invest
pledges, Berlin-midnight timer). Members set their own roster display name and
pledge end-invest amounts.

Events whose def in `lib/content/guild-events.ts` carries a `camps` count also get
a siege board, drawn as the map itself: the camps sit around Asgard the way the
game places them, and tapping one opens its plan. Trials of Odin has five camps.
Officers mark which one is the guild's own, put the other four in the order they
should fall, and set each one's remaining percent plus the Draupnir Rings and
Military Tokens (Horns) to spend there; members see the same map and read the plan
of the camp they tap. Camp positions live in `GuildSiegeCamps.tsx`, with a second
set for phones, where the wide ring does not fit. One row per camp and siege day in
`guild_event_camps`; officers write, active members read, nothing crosses guilds.

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
