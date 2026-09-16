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
lib/i18n/translations.ts      text kept in every language at once (editors)
app/components/EditorLanguages.tsx  language fields, toggle, and export blocks for all editors
scripts/add-language.mjs      pnpm i18n:add — adds a language
scripts/i18n-report.mjs       pnpm i18n:report — lists what is still untranslated
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

```sh
pnpm i18n:add es "Español"
pnpm i18n:add pt-BR "Português (Brasil)" --short PT --html-lang pt-BR
```

The command copies `lib/i18n/dictionaries/en.ts` to `<code>.ts`, typed as
`Dictionary`, and adds the import, the `LOCALES` entry, and the `DICTIONARIES`
entry in `lib/i18n/index.ts`. Then:

1. Translate the new file and keep every key. A missing key is a build error,
   not a silently English string.
2. Run `pnpm test` and `pnpm build`.
3. Run `pnpm i18n:report` (or `pnpm i18n:report es --all`) to list the strings
   that are still identical to English. It also shows how many heroes, painting
   sets, paintings, and plays have wording in that language.

Nothing else changes. Everything below reads the registry:

- the language menu, the `<html lang>` attribute, and number and date formatting
- every editor: fields, the **Edit all languages** switch, and one export block
  per dictionary
- the tests, including one that fails if code outside the registry lists the
  languages by hand

### Text that lives in data files

Hero wording, the Artwork catalogue, Goddess Theater names, and Anecdotes are
English in `lib/data/*.json`. Each dictionary holds only the translations, keyed
by id: `guideEntries.heroes.heroTexts`, `guideEntries.artwork.catalogTexts`,
`guideEntries.goddessTheater.playTexts`, and
`guideEntries.anecdotes.anecdoteTexts`. A new language starts with `{}` there.
Readers see the English text until someone translates it, and an empty field
in an editor shows English as a placeholder.

## Editing in several languages

Every editor handles languages the same way:

- **Which fields show.** By default an editor shows the language you are
  reading in. Editors whose data file holds English also show English next to
  it: Heroes, Artwork, Goddess Theater, guides, news, and events.
- **Edit all languages.** This switch shows every registered language. It is
  one setting for all editors, saved in `popepoch-editor-all-languages`.
- **Untranslated fields.** A field that has no text in its language has a dashed
  border and shows the English text as a placeholder. Readers see that English
  text too.
- **New text.** A **New text** form asks for every language; only English is
  required. Selecting an existing text in the tier list or Artwork layouts
  editor offers **Edit wording**, which changes that text in every language
  wherever it is used.
- **Export.** The export gives one block per dictionary, and only for
  dictionaries that change. The guide, news, and event editors print a separate
  block for each language instead of one block to copy into all three.

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
   pattern as news and events. Artwork, Artwork layouts, Heroes, Hero layouts,
   the Hero tier list, Goddess Theater, Hero linking, Anecdotes, and Server age
   unlocks skip those buttons:
   they have their own editors instead.
2. Write or replace the text under `guideEntries.<id>` in all three dictionaries,
   following the shape of `support`: `title`, `summary`, `intro`,
   `sections[]`, `note`.
3. Add or replace the item in the `guides` section in `lib/navigation.ts`,
   including a `badge` and `categoryId` from `guideCategories`. Reuse an existing
   category when the guide belongs next to one already there. Core systems
   (heroes, artwork, technology, collection, manor, support, goddesses, cryptides)
   use `coreElements`; placement guides (hero layouts, artwork
   layouts) use `layouts`; ranking guides (hero tier list) use `tierLists`;
   building guides (Goddess Theater) use `buildings`; advice that is not tied to
   one system (hero linking, anecdotes, server age unlocks) uses `tips`. The top-level Events section is the
   calendar; keep `event` for a future event-related guide.
4. For a new slug, copy `app/guides/support/page.tsx` and pass the new id
   to `GuideArticle`.

A guide that needs more than headings and paragraphs gets its own renderer next
to `GuideArticle`: `GoddessesGuide`, `ArtworkGuide`, `ArtworkLayoutsGuide`,
`HeroLayoutsGuide`, `HeroRoster`, `HeroTierListGuide`, `GoddessTheaterGuide`,
`HeroLinkingGuide`, `AnecdotesGuide`, and `ServerAgeUnlocksGuide`.
`guideLayout()` in `lib/content/guides.ts` picks the renderer from a field only
that guide has (`phases` for Goddesses, `playsHeading` for Goddess Theater,
`linksHeading` for Hero linking, `anecdoteTexts` for Anecdotes,
`timelineHeading` for Server age unlocks, before
`filterAll` for Heroes), and
`tests/guides.test.mjs` pins every entry, so two guides cannot claim the same
renderer by sharing a field name. Keep `sections` and `note` in those entries
too, since the editor reads them. Goddess names, rarity, and portraits live in
`lib/data/goddesses.json`, once for all languages; affinity and obtain stay in
the dictionaries so they can be translated. `tests/goddesses.test.mjs` checks
the roster against `public/goddesses/`. Goddess Theater casts live in
`lib/data/goddess-theater.json`, once for all languages; `tests/goddess-theater.test.mjs`
checks every name against that roster and every cover against
`public/goddess-theater/`. Play and role names in that JSON are the English wiki
spelling; `playTexts` in each dictionary can override them, and the dedicated
editor at `/guides/goddess-theater/edit/` edits every language in `LOCALES`
(`tests/goddess-theater-editor.test.mjs`). In the Hero layouts guide,
`sections` are the rule cards next to the formation board, and the slot order
lives in `lib/content/hero-layouts.ts` (builds and utility groups: see *Editing
hero layouts* below). Painting names, set effects, and hero matches for Artwork
live in `lib/data/paintings.json`, once for all languages;
`lib/content/artwork.ts` types and exports them. Unlock order and level
priority for Artwork layouts live in the guide dictionary. The SSR set-skill
ranking lives in `lib/data/artwork-layouts.json`, once for all languages;
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
list ("Isaac Newton" for Newton, "Livia Drusilla" for Livia).
`lib/content/hero-names.ts` maps them, so the pool does not offer a hero that is
already placed under the other spelling. Remove an entry there once the roster
and the guides agree — Gawain lost his entry that way, after the obtain guide
confirmed the spelling the other guides already used.

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
- **Quality** is the rarity a placement is rated at, for heroes whose rarity
  changes in the game. Joan of Arc is SS at UR+ and S at UR, so each entry sets
  its own `rarity` and gets that frame (UR+ with the glow, UR red, SSR gold) and
  an "at UR+" caption. Left at **As in the Heroes roster**, the entry has no
  `rarity` and follows `lib/data/heroes.json`. The same hero may appear twice in
  one list when the rarity or the variant differs; the rarity filter on the page
  uses the placement's rarity. Drafts that still use the old `atUr` / `atUrPlus`
  variants load with the rarity instead.

The draft is saved in that browser only (`localStorage['popepoch-tier-draft']`).
**Export** produces:

1. the complete `lib/data/hero-tiers.json`, one entry per line so a pull request
   shows exactly which heroes changed, and
2. for new text, one block per dictionary to paste under
   `guideEntries.heroTierList`.

On the page, each tier is a coloured strip of portrait cards. A card opens the
hero's placement, reason, and tiers in every list. The battle list splits into
Damage, Sustain, Buffs, and Debuffs & control columns by each hero's first skill
tag (`ROLE_GROUPS` in `lib/content/hero-tiers.ts`). A new role key needs a
column there, and TypeScript enforces that through the dictionary type.

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

## Editing the artwork catalogue

Members with `guides.draft` see **Edit catalogue** on Artwork, which opens
`/guides/artwork/edit/`. The dictionary-snippet Edit / Remove at the top of the
page is hidden here.

- Sets are grouped by rarity. Select a set to change its name, rarity, effect,
  or paintings.
- **Add set** / **Add painting** create empty rows. **Add a hero** lists the
  Heroes roster that is not already on that canvas, grouped by rarity.
- Autumn’s catalogue has no UR+ heroes except Joan of Arc; the export dialog
  warns if a UR+ name is attached.
- **Picture** takes the painting from the game without its frame. It is shrunk
  to 480 px WebP in the browser and exported as `public/artwork/<id>.webp`.
- **Original title**, **Artist**, and **Year** (with **approximate**) name the
  real artwork the painting is based on. The English original only goes into
  the JSON when the game renames the work (Nightshade is Hopper’s
  *Nighthawks*); every language can have its own original title. Leave them
  empty when the picture or the title does not settle which work it is.

On the page, each painting shows its picture in the frame colour of its rarity,
or an empty slot. Clicking a picture opens it larger with the original title in
every language. The search matches heroes, painting names and original titles
in every language, and artists, without caring about accents.

The pictures in `public/artwork/` were cut out of German client screenshots on
16 September 2026; the German in-game names on those screenshots are the German
`name` entries in `catalogTexts`. Original titles, artists, and years were
checked against Wikipedia, Wikidata, and the holding museums. `tests/artwork.test.mjs`
checks that every listed picture exists and none is left over.

The draft is saved in that browser only
(`localStorage['popepoch-artwork-catalogue-draft']`), pictures included.
**Export** produces the complete `lib/data/paintings.json` in English, the new
pictures to put into `public/artwork/`, and the ones to delete. For each
dictionary whose translations changed, it also gives a `catalogTexts` block to
replace inside `guideEntries.artwork`. That block holds set names, set skills,
painting names, productivity, and original titles. An untouched draft exports
the published file byte for byte (`tests/artwork-editor.test.mjs`).

## Editing heroes

Members with `guides.draft` see **Edit heroes** above the Heroes roster, which
opens `/guides/heroes/edit/`. The dictionary-snippet Edit / Remove is hidden on
Heroes as well.

- The list on the left filters by rarity and name, and marks heroes that are
  **new** or **changed** in the draft. Select one to edit their name, rarity,
  obtain text, abilities, and artifact, or to move them within their rarity.
- **Languages**: name, rarity, and pictures are the same everywhere and stay in
  `lib/data/heroes.json`. The wording the game shows — obtain note, ability
  names, level texts, artifact — is translated, so those fields appear once per
  language: English plus the language the page is in, or every language with
  **Edit all languages**. English is what goes into the JSON; a blank
  translation shows the English text as its placeholder, because that is what a
  reader in that language gets. A hero counts as **changed** when only a
  translation moved.
- **Abilities**: every hero has exactly three, a **Skill**, a **Buff**, and a
  **Production** bonus. Each holds a name and one text per level (Lv. 1, Lv. 2,
  …). **Add Lv. N** copies the level before it, so only the numbers need
  changing. A level may stay empty when its text is not known yet (Cleopatra's
  Lv. 1). Empty slots are left out of the export. On the Heroes page, each
  ability is a card with a level slider, and the numbers that changed since
  the level below are highlighted.
- **Add hero** creates an empty hero in the selected rarity. Their id, which
  also names their picture files, comes from the name on export. Published
  heroes keep their id when renamed.
- **Portrait and skins**: the first picture is the portrait, and the others
  show as skins in the hero dialog. Upload a picture or drop one onto the box.
  The browser shrinks it to 240 px on the long side and re-encodes it as WebP
  before it is stored in the draft. **Use as portrait** moves a skin to the
  front.
- The export dialog warns about empty names, duplicates, and abilities that
  have a name but no text, or text but no name. It also warns when a hero that the tier list, Hero layouts, or
  Artwork still name is renamed or removed.

The draft, pictures included, is saved in that browser only
(`localStorage['popepoch-hero-draft']`). A browser keeps about 5 MB per site,
which is enough for dozens of pictures. The editor tells you when it is full.
**Export** produces:

1. the complete `lib/data/heroes.json`, one line per hero and per ability,
2. each new picture as a download, with the path it belongs at
   (`public/heroes/<id>.webp`, or `<id>-2.webp` and so on for skins),
3. the pictures to delete from `public/heroes/` because the draft no longer
   uses them, and
4. a `heroTexts` block for each dictionary whose translations changed, to
   replace inside `guideEntries.heroes`. It is keyed by hero id and holds only
   the translations that are filled in; English stays empty because the JSON
   is English. Translated levels line up with the English ones, and removing
   an English level removes it in every language.

An untouched draft exports the published file and every dictionary block byte
for byte (`tests/hero-editor.test.mjs`). `tests/heroes.test.mjs` checks the
roster against the folder — every listed file exists and no file is left over —
and that each `heroTexts` key is a hero in the roster.

The portraits in `public/heroes/` were saved from the Pop Epoch Wiki rarity
pages on 14 September 2026. The artwork belongs to the game's publisher. The
roster credits it under the grid. To take the pictures down, delete the folder
and empty the `images` lists.

The Goddesses guide uses the same tile grid. Rows live in
`lib/data/goddesses.json` (id, English name, rarity, images). Affinity and
obtain stay in `guideEntries.goddesses.roster` so they stay translatable.
Rarity follows the wiki card colours on
https://pop-epochmobile.fandom.com/wiki/Goddess as of 14 September 2026: gold
SSR, purple SR, blue R. Portraits in `public/goddesses/` come from that page
(`scripts/fetch-goddess-portraits.py`). Bastet's wiki card is a placeholder, so
she has no picture. Isis and Calypso are named by the obtain guide but not by
the wiki, so they have a roster row and no picture. The upgrade-order numbers are the published
community sequence on this site (phase 2 Fortuna and Bastet stop at 60), not
the wiki's level list. To take the pictures down, delete the folder and empty
the `images` lists.

### Where a hero or goddess comes from

Both rosters say where each entry comes from, taken from Autumn's obtain guide
shared on Discord on 9 August 2026, with screenshots from several players. Both
guides credit her in `obtainCredit` under the source cards; keep that line if
you edit the text.

A hero's source is the `obtain` field in `lib/data/heroes.json`, which
`heroTexts` can translate. For a goddess it is `obtain` in
`guideEntries.goddesses.roster`, translated per dictionary, and
`tests/goddesses.test.mjs` requires a line for every goddess in every language.
For an event hero the number is which run of that event first offered him, so
`Holy Grail #3` means the third Grail. A hero with an empty `obtain` comes from
the shared pools instead, which `sources` lists once per rarity.

Two flags live in `lib/data/goddesses.json`, next to rarity rather than in the
dictionaries, because they do not change per language: `missable` for a source
that has been and gone, and `unconfirmed` for one nobody has verified. The
guide renders them as words (`missableLabel`, `unconfirmedLabel`), not as a
colour alone, and a flagged goddess still has an `obtain` line saying what is
known. Heroes need neither flag yet, since every hero source in that guide is
still reachable.

Named skins are a separate list, not the extra pictures on a roster card.
Those files have no names, so they cannot be matched. Rows live in
`lib/data/hero-skins.json` and `lib/data/goddess-skins.json` (English name and
obtain, plus the same missable and unconfirmed flags). `skinTexts` in each
dictionary can translate them. Avatar skins, mount skins, and frames from the
same Discord post are not heroes or goddesses, so they are not on these pages.
`tests/skins.test.mjs` checks every owner against the matching roster, that
ids are unique, and that a group in the JSON has a heading in the dictionary.

The skin guides are Autumn's list from 7 August 2026. Both pages credit her in
`skinsCredit`. Keep that line if you edit the text. Skins for heroes not in
the roster yet (Billy the Kid, Alexander the Great, Augustus, Charlie Chaplin)
are left out until those heroes are added.

Goddess Theater covers in `public/goddess-theater/` are the first image on each
card on https://pop-epochmobile.fandom.com/wiki/Goddess_Theater as of
14 September 2026 (`scripts/fetch-theater-covers.py`). That first picture is
the rarity-framed poster (UR / SSR / SR / R); the stills beside it stay off
the site. To take the pictures down, delete the folder and empty each play's
`image` field.

## Editing Goddess Theater

Members with `guides.draft` see **Edit plays** on Goddess Theater, which opens
`/guides/goddess-theater/edit/`. The dictionary-snippet Edit / Remove is hidden
here as well.

- The list on the left is every play. Select one to change its name, order,
  tutorial unlock, cover, or cast. **Add play** creates an empty play; new
  plays get an id from the name on export. Published plays keep their id when
  renamed.
- **Cast**: **Add a goddess** lists the Core Goddesses roster that is not
  already in that play, grouped by rarity. Each row has a role name and a
  relevant mark for stills. The same goddess cannot appear twice in one play.
- **Cover**: upload or drop the rarity-framed poster (not a still). The browser
  shrinks it to 240 px on the long side and re-encodes it as WebP.

The draft, pictures included, is saved in that browser only
(`localStorage['popepoch-theater-draft']`). **Export** produces:

1. the complete `lib/data/goddess-theater.json`,
2. each new cover as a download at `public/goddess-theater/<id>.webp`, and
3. the pictures to delete from that folder because the draft no longer uses
   them.

An untouched draft exports the published file byte for byte
(`tests/goddess-theater-editor.test.mjs`). Play and role names stay in English.

## Editing hero linking

Hero linking sits under the **Tips and tricks** category and keeps two lists:
the heroes that unlock a link, grouped by the Grail and Odin tracks, and the
order links are worth spending in. Both name heroes by their Heroes roster
spelling, so a portrait and a link into the roster always resolve;
`tests/hero-linking.test.mjs` checks every name against that roster.

Members with `guides.draft` see **Edit linking** on the guide, which opens
`/guides/hero-linking/edit/`.

- **Add a hero** in either list is the Core elements Heroes roster, grouped by
  rarity and without the heroes that list already has, so the same hero cannot
  be added twice. A new link takes the next free step of its track.
- **Track** and **Step** are what the guide groups and numbers by. Two heroes on
  the same step of one track would both claim to be “#1”, so the export warns.
- **Position** in the link order is what the advice is: the first hero is the
  one to spend a single link on, the second is next, and so on.
- **Note** is optional prose beside a hero, not game data, so every language —
  English included — keeps its own copy and none is the source. One or every
  language is shown, the same as the other editors. A note written in one
  language but not the others would render blank there, so the export warns
  about that too.

The draft is saved in that browser only
(`localStorage['popepoch-linking-draft']`). **Export** produces the complete
`lib/data/hero-linking.json` — links sorted by track, then step — and one
`linkTexts` block per dictionary to paste under `guideEntries.heroLinking`. An
untouched draft reproduces the published file and all three blocks byte for
byte.

The linkable heroes and the link order come from a community list shared on
Discord on 15 September 2026. The mechanic is read off an in-game screenshot
from the same day; the per-Legend values are deliberately not recorded, because
one screenshot is a single data point. The guide's `credit` says so.

## Server age unlocks

Server age unlocks sits under **Tips and tricks**. Milestones and unconfirmed
rows live in `lib/data/server-age-unlocks.json` (English event names, optional
`description` and `image`). The timeline renderer is `ServerAgeUnlocksGuide`;
optional name/detail/label/description overrides go in
`guideEntries.serverAgeUnlocks.eventTexts`. Related site guides are linked when
`relatedGuide` names a published `guideEntries` id. Pictures live in
`public/server-age-unlocks/`.

Members with `guides.draft` see **Edit timeline**, which opens
`/guides/server-age-unlocks/edit/`. The draft is saved in that browser only
(`localStorage['popepoch-age-unlocks-draft']`). **Export** produces the
complete JSON, new pictures to put into `public/server-age-unlocks/`, files to
delete, and one `eventTexts` block per dictionary. An untouched draft
reproduces the published file byte for byte (`tests/server-age-unlocks.test.mjs`).
Source: Autumn (Ice, S12), Discord, 14 September 2026, marked in progress.

## Editing anecdotes

Anecdotes sit under **Tips and tricks**. Each one has a group (General or
Egyptian Tales), a name, what unlocks it, the steps, and an optional picture.
Rows live in `lib/data/anecdotes.json`, English only:

- `after` is the id of an anecdote to finish first. The page links both ways
  ("Finish first" and "Unlocks next") and shows the position in the chain,
  such as the eleven Osiris anecdotes that start with Jackals vs Dog.
- `prerequisite` is any other condition, `reward` only when the guide names
  one, and `note` a warning or a known gap. Where the source guide leaves
  something out (the egg order in Philosophical Thesis, the colour order in The
  Dome Confinement), the note says so instead of guessing.
- `steps[]` is one action each; `substeps` are the options, places, or answers
  a step lists (Black Widow's spiders, the Osiris answers).
- `thanks` names community helpers and is the same in every language.
- `image` is a file in `public/anecdotes/`. Without one, the card shows an
  empty picture slot.

Members with `guides.draft` see **Edit anecdotes** on the guide, which opens
`/guides/anecdotes/edit/`. The list filters by group and text and marks
anecdotes that are **new** or **changed**. The form edits every field above in
English plus the page's language, or every language with **Edit all
languages**, and shows a preview of the card. Steps and sub-items can be added,
moved, and removed; their translations move with them. **Finish first** only
offers anecdotes that would not create a loop, and removing an anecdote clears
the links to it. A picture is uploaded or dropped, shrunk to 960 px WebP in the
browser, and kept in the draft (`localStorage['popepoch-anecdote-draft']`).

**Export** produces the complete `lib/data/anecdotes.json`, the new pictures
to put into `public/anecdotes/` (named after the anecdote id), the files to
delete, and an `anecdoteTexts` block for each dictionary whose translations
changed. An untouched draft reproduces the published file byte for byte
(`tests/anecdotes.test.mjs`), and the test also checks ids, groups, chains, and
that every listed picture exists with none left over.

The list is Autumn's guide (Ice, S12), shared on Discord and last added to on
10 September 2026, with help from Kraes, Zee, Spitzell, and Popo. The wording
was tidied without changing what to do.

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

The Heroes and Goddesses guides use a shared collage banner built from primary
roster portraits (`lib/content/hero-banner.ts` + `HeroBanner`,
`lib/content/goddess-banner.ts` + `GoddessBanner`). Those images are the same
wiki portraits already credited on each page. The mark text is the localized
guide title.

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
