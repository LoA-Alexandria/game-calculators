# Architecture

## Overview

The project is a browser-only Next.js site using the App Router and static export. GitHub Pages serves the generated `out/` directory. There is no server runtime.

## Structure

```text
app/
  page.tsx                     Home: hero, featured simulation, tools, news
  news/                        News index
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
  navigation.ts                Section tree driving sidebar, indexes, home
  site.ts                      Base path, Discord, repository, storage keys
docs/                          Human and agent guidance
public/
  tools/irrigation-planner/    Vendored standalone planner (see below)
tests/                         Calculation and output tests
.github/workflows/pages.yml    Test, build, and Pages deployment
```

## Navigation

`lib/navigation.ts` is the single source of truth for the four sections and
their entries. The sidebar, the section index pages, the home page, and the
sidebar filter all read it, so a new tool is added in one place. Labels are
functions of the dictionary rather than literals.

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

`app/globals.css` defines the colour, spacing, and type tokens. The light
palette sits on bare `:root`; the dark palette is repeated under
`prefers-color-scheme: dark` and under `:root[data-theme="dark"]`, so an explicit
choice wins in both directions. `app/components/ThemeToggle.tsx` writes that
choice to `localStorage['popepoch-theme']`, and a small script in the root layout
applies it before first paint.

The palette is cool graphite neutrals with a lapis-blue primary and a warm gold
secondary — the Egyptian pairing in saturated modern tones. Type is Sora for
headings and Inter for text, both self-hosted by `next/font`.

The visual identity is built from original CSS geometry and hand-drawn SVG in
`app/components/Icons.tsx`. It evokes the setting without reproducing any
artwork, logo, icon, or typeface from the game; the footer states that the site
is an unofficial fan project.

## Roles and the admin area

`lib/auth/roles.ts` holds the roles (`admin`, `manager`, `guide_writer`), the
permission table, and the "highest role wins" rule. It is free of UI and demo
code so a future server can import it unchanged.

`/admin/` and `/guides/new/` are **front-end drafts with no security**. The site
is a static export, so the sign-in check runs in the browser against credentials
that ship inside the bundle, and the session is a localStorage entry the visitor
can write. Both routes carry `robots: noindex`, which is the only protection a
static host can offer.

Do not extend `lib/auth/demo.ts`. Read
[`AUTH-AND-CMS.md`](AUTH-AND-CMS.md) before touching anything under
`app/admin/` — it records the data shapes, the endpoints the interface expects,
and what must be deleted when the real backend lands.

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
- Static export means calculators must not depend on server actions, private environment variables, databases, or runtime APIs.

When a calculation grows beyond a few lines, place it in `lib/calculators/<slug>.ts` and test it independently.
