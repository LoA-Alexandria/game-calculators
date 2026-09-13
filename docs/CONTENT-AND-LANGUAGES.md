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
   pattern as news and events. Artwork layouts and the Hero tier list skip those
   buttons: they have their own editors instead.
2. Write or replace the text under `guideEntries.<id>` in all three dictionaries,
   following the shape of `waterSupply`: `title`, `summary`, `intro`,
   `sections[]`, `note`.
3. Add or replace the item in the `guides` section in `lib/navigation.ts`,
   including a `badge` and `categoryId` from `guideCategories`. Reuse an existing
   category when the guide belongs next to one already there. Core systems
   (heroes, artwork, technology, collection, manor, support, goddesses, cryptides)
   use `coreElements`; placement guides (water supply, hero layouts, artwork
   layouts) use `layouts`; ranking guides (hero tier list) use `tierLists`.
4. For a new slug, copy `app/guides/water-supply/page.tsx` and pass the new id
   to `GuideArticle`.

A guide that needs more than headings and paragraphs gets its own renderer next
to `GuideArticle`: `GoddessesGuide`, `ArtworkGuide`, `ArtworkLayoutsGuide`,
`HeroLayoutsGuide`, and `HeroTierListGuide`.
`guideLayout()` in `lib/content/guides.ts` picks the renderer from a field only
that guide has, and `tests/guides.test.mjs` pins every entry, so two guides
cannot claim the same renderer by sharing a field name. Keep `sections` and
`note` in those entries too, since the editor reads them. In the Hero layouts guide,
`sections` are the rule cards next to the formation board, and the slot order
lives in `lib/content/hero-layouts.ts` (builds and utility groups: see *Editing
hero layouts* below). Painting names, set effects, and hero matches for Artwork
live in `lib/content/artwork.ts`. Unlock order and level priority for Artwork
layouts live in the guide dictionary. The SSR set-skill ranking lives in
`lib/data/artwork-layouts.json`, once for all languages;
`lib/content/artwork-layouts.ts` types and exports it. Dictionaries hold the
build names, reasons, and notes those rows point at.

The Hero tier list keeps its rows (hero names, grades, resources, bonuses) in
`lib/data/hero-tiers.json`, once for all languages; `lib/content/hero-tiers.ts`
types and exports them. The dictionaries only hold the text those rows point at
(`roles`, `effects`, `resources`, `notes`, `variants`, `reasons`).
`tests/hero-tiers.test.mjs` checks that every key has text in every language and
that hero names match the Hero layouts guide.

## Editing hero layouts

The Hero layouts guide keeps which hero sits in which build, counter, or utility
group in `lib/data/hero-layouts.json`. The readable parts are keyed maps inside
`guideEntries.heroLayouts` in every dictionary: `buildTexts` (name, label, short
description, pros, cons, notes per build), `counterLabels`, `pickNotes` (such as
"with item"), `roleNames`, and `groupLabels`. Hero and Collection names appear
only in the JSON, so they are the same in every language.
`tests/hero-layouts.test.mjs` checks that every key has text in every language
and that pros, cons, and notes have the same number of lines in each.

Members with `guides.draft` see **Edit builds** on the guide, which opens
`/guides/hero-layouts/edit/`:

- **Hero pool** (beside the builds, above them on a phone): heroes from Core
  elements › Heroes. By default it shows only heroes that are not in the layout
  yet; it can also show heroes missing from the selected build, or all heroes,
  filtered by rarity or name. Drag a hero into any zone, or tap **Key**,
  **Important**, or **Other** to add it to the selected build.
- **Builds**: switch with the tabs, add one with **New build**, reorder with the
  arrows, or delete one. Name, label, and description are edited in place;
  pros, cons, and notes are lines you can add and remove.
- **Zones**: drag heroes between key, important, other, best collection,
  counters, and utility groups, or type a name into a zone. Selecting a hero
  sets a qualifier ("with item", or a new one) or moves it to any zone from a
  list.
- **Languages**: text fields edit the language the site is shown in. **Edit all
  languages** shows English, German, and French side by side. A new build,
  counter, or group starts with the same text in all three.

The draft is saved in that browser only (`localStorage['popepoch-layout-draft']`).
**Export** gives the complete `lib/data/hero-layouts.json` and, per dictionary,
the block from `buildTexts` to `groupLabels` to replace inside
`guideEntries.heroLayouts`. An untouched draft exports both byte for byte
(`tests/hero-layout-editor.test.mjs`).

The Heroes roster spells some heroes differently from the layouts and the tier
list ("Isaac Newton" for Newton, "Garwain" for Gawain). `lib/content/hero-names.ts`
maps them, so the pool does not offer a hero that is already placed under the
other spelling. Remove an entry there once the roster and the guides agree.

## Editing the hero tier list

Members with `guides.draft` see **Edit tier list** on the tier list page, which
opens `/guides/hero-tier-list/edit/`. The dictionary-snippet Edit / Remove at
the top of the page is hidden here.

- Drag a hero by its handle to another tier or position. The handle also works
  from the keyboard: focus it, press space, move with the arrow keys, and press
  space again to drop.
- Select a hero to change its name, tier, grades, skill tags, effect, resource,
  bonus, note, or reason, or to remove it. **Add hero** sits at the end of every
  tier.
- A text the dictionaries do not have yet (a new effect, note, or reason) can be
  typed in English, German, and French from the **New text…** option.

The draft is saved in that browser only (`localStorage['popepoch-tier-draft']`).
**Export** produces:

1. the complete `lib/data/hero-tiers.json`, one entry per line so a pull request
   shows exactly which heroes changed, and
2. for new text, one block per dictionary to paste under
   `guideEntries.heroTierList`.

The export dialog lists problems first: missing names, duplicates, invalid
grades, and text keys without text. An untouched draft exports the published file
byte for byte (`tests/hero-tier-editor.test.mjs`), so a diff only ever contains
real changes.

## Editing artwork layouts

Members with `guides.draft` see **Edit set skills** on Artwork layouts, which
opens `/guides/artwork-layouts/edit/`. The dictionary-snippet Edit / Remove at
the top of the page is hidden here.

- Each build is a ranked list of painting sets from the Artwork catalogue.
  Change order with the rank dropdown, pick a reason, or remove a set.
- **Add a painting set** lists catalogue sets that are not already in that
  build, grouped by rarity.
- **Add build** / **Remove build** create or delete a ranking. A new build can
  start empty or copy an existing one. The last remaining build cannot be
  deleted.
- A text the dictionaries do not have yet (a new build name, note, or reason)
  can be typed in English, German, and French from the **New text…** option.

The draft is saved in that browser only
(`localStorage['popepoch-artwork-layout-draft']`). **Export** produces:

1. the complete `lib/data/artwork-layouts.json`, one row per line so a pull
   request shows exactly which sets moved, and
2. for new text, one block per dictionary to paste under
   `guideEntries.artworkLayouts`.

An untouched draft exports the published file byte for byte
(`tests/artwork-layout-editor.test.mjs`).

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

Hero and Collection names in the Hero layouts and tier list data are not
translated at all: they live in the JSON files, and only qualifiers such as
"with item" (`pickNotes`) are translated.
