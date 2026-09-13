# Content and languages

The site is organised into five sections — News, Events, Guides, Calculators,
and Simulations — and speaks English, German, and French. Both the navigation
and the translations are driven by data, so adding an entry or a language does
not mean touching the layout.

## Where things live

```text
lib/i18n/dictionaries/en.ts   reference language; its shape defines the type
lib/i18n/dictionaries/de.ts   German
lib/i18n/dictionaries/fr.ts   French
lib/i18n/index.ts             language registry, negotiation, {placeholder} filling
lib/navigation.ts             the section tree: sidebar and indexes
lib/content/news.ts           news entries (dates and links only; text is in the dictionaries)
lib/content/banners.ts        optional images for the section banners
app/components/LocaleProvider.tsx  the active language and its formatters
```

## How the language switch works

The choice is stored in `localStorage` under `popepoch-locale` and applied on
mount; with nothing stored, the browser's `Accept-Language` preferences decide.
There is one set of URLs for all languages.

**The trade-off:** because the site is a static export, the pre-rendered HTML
always carries English. A reader with German stored sees one frame of English
before the page settles, a German page cannot be shared as a German link, and
search engines index the English text only. If that becomes a problem, move the
pages under `app/[locale]/` and generate one copy per language — every string is
already in a dictionary, so the pages themselves would barely change.

## Adding a language

1. Copy `lib/i18n/dictionaries/en.ts` to `<code>.ts`, translate the values, and
   keep every key. The file is typed as `Dictionary`, so a missing key is a build
   error rather than a silently English string.
2. Add one row to `LOCALES` in `lib/i18n/index.ts`:
   ```ts
   { code: "es", label: "Español", short: "ES", htmlLang: "es" },
   ```
3. Register the import in the `DICTIONARIES` map in the same file.

Nothing else changes: the menu, the `<html lang>` attribute, number formatting,
and date formatting all read the registry.

## Adding a calculator or simulation

1. Build the page as described in [`ADDING-A-CALCULATOR.md`](ADDING-A-CALCULATOR.md).
2. Add its name, description, and category under `tools.<id>` in all three
   dictionaries, and its labels under `calculator.*`.
3. Add one entry to the matching section's `items` in `lib/navigation.ts`.

It then appears in the sidebar, in the section index, and in the sidebar
filter. There is no second list to keep in step.

## Adding a guide

1. Open `/guides/new/` signed in with `guides.draft`, or use Edit / Remove on
   an existing guide. The editor prints the dictionary block, the navigation
   row, and (for a new slug) a note to copy the page file. Existing guides on
   `/guides/` and on the guide page have Edit and Remove — the same commit-snippet
   pattern as news and events.
2. Write or replace the text under `guideEntries.<id>` in all three dictionaries,
   following the shape of `waterSupply`: `title`, `summary`, `intro`,
   `sections[]`, `note`.
3. Add or replace the item in the `guides` section in `lib/navigation.ts`,
   including a `badge` and `categoryId` from `guideCategories`. Reuse an existing
   category when the guide belongs next to one already there. Core systems
   (heroes, technology, collection, manor, support, goddesses, cryptides)
   use `coreElements`; placement guides (water supply, hero layouts, artwork) use
   `layouts`.
4. For a new slug, copy `app/guides/water-supply/page.tsx` and pass the new id
   to `GuideArticle`.

A guide that needs more than headings and paragraphs gets its own renderer next
to `GuideArticle`: `GoddessesGuide`, `ArtworkGuide`, and `HeroLayoutsGuide`.
`guideLayout()` in `lib/content/guides.ts` picks the renderer from a field only
that guide has, and `tests/guides.test.mjs` pins every entry, so two guides
cannot claim the same renderer by sharing a field name. Keep `sections` and
`note` in those entries too, since the editor reads them. In the Hero layouts guide,
`sections` are the rule cards next to the formation board, and the slot order
lives in `lib/content/hero-layouts.ts`. Painting names, set effects, and hero
matches for Artwork layouts live in `lib/content/artwork.ts`.

Community-written guides name their author in the entry (`credit`). Ask the
author before publishing their text, and keep the credit when you edit it.

Guides describe game mechanics, so treat their numbers the way the repository
treats any other game data: say where they came from, and correct them in the
same change as the tool that relies on them.

## Adding an event

Events are versioned data, not database rows — the same reason news is. An entry
typed into a browser on a static site would exist only in that browser, so
committing it is what makes it visible.

1. Open `/events/` signed in with `events.write`. The schedule list can load an
   existing row into the editor or produce the notes for removing it. A blank
   form still prints a new row and the dictionary keys.
2. Paste or replace the row in `EVENTS` in `lib/content/events.ts`.
3. Add, update, or delete `eventEntries.<id>` with `name` and `summary` in all
   three dictionaries.
4. Delete `EVENTS_ARE_PLACEHOLDER` once the example schedule is gone.

The recurrence rules live in `lib/events.ts` and are covered by
`tests/events.test.mjs`: weekly with an interval and a set of weekdays, monthly
on a day that clamps to the end of shorter months, or a one-off. Everything is
computed in UTC, because a game event starts at the same moment for everyone and
deriving it from each reader's clock would show different answers.

## Adding a news entry

1. Open `/news/new/` signed in with `news.write`. The editor prints both the row
   and the dictionary block. Existing entries on `/news/` have Edit and Remove,
   which load that row or print the deletion notes — the same pattern as events.
2. Add or replace the row in `NEWS` in `lib/content/news.ts` with an ISO date and,
   optionally, an `href` to the thing the entry is about.
3. Write or update the text under `newsEntries.<id>` in all three dictionaries
   (`title`, `summary`, `body[]`).

Dates are formatted for the reader's language, so store them as `YYYY-MM-DD`.

## Section banners

News, Events, Calculators, and Simulations use illustrated banners in
`public/banners/`. They span the main column as a slim strip under the top bar.
Guides still draws the decorative CSS banner until it has its own image. To
change or add one, put the file in `public/banners/` and set the path in
`lib/content/banners.ts`. The illustrations are original splash art for this
unofficial fan site, not artwork from the game.

## Translating validation messages

Calculation errors carry a `code` and its parameters (`lib/calculators/errors.ts`).
The interface turns that into a sentence with `useCalculatorError()`. The English
`message` on the error stays exactly as it was — the calculation tests assert on
it — so never reword one without updating `tests/` in the same change.

Adding a new validation:

1. Add the code to `CalculatorErrorCode`.
2. Throw `new CalculatorError("<code>", "<English message>", { …params })`.
3. Add `errors.<code>` to all three dictionaries, using the same `{placeholders}`.

## Names that need a second pair of eyes

Item, building, and city-group names in German and French were translated by
hand and are **not** verified against the wording those game clients use. They
are collected in `materials`, `cityTypes`, and `cityGroups` in each dictionary,
so they can be corrected in one place.

Hero and Collection names in `guideEntries.heroLayouts` deliberately stay in
English in every language, and `tests/hero-layouts.test.mjs` fails if one
dictionary drifts from the others. Only the qualifiers next to a name ("with
item") are translated.
