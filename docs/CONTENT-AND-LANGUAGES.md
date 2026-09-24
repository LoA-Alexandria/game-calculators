# Content and languages

The site is organised into sections — News, Guilds, Events, Guides, Calculators,
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
lib/content/guide-meta.ts     Guides index cards: pictures and editor button per guide
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

Hero wording, the Artwork catalogue, goddess affinity and obtain, the goddess
upgrade order, Collection items, Goddess Theater names, and Anecdotes are English in
`lib/data/*.json`. Each dictionary holds only the translations, keyed by id:
`guideEntries.heroes.heroTexts`, `guideEntries.artwork.catalogTexts`,
`guideEntries.goddesses.goddessTexts`, `guideEntries.goddessLeveling.phaseTexts`,
`guideEntries.collection.collectionTexts`,
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
   pattern as news and events. Every guide listed with an `editor` in
   `lib/content/guide-meta.ts` skips those buttons: it has its own editor instead.
2. Write or replace the text under `guideEntries.<id>` in all three dictionaries,
   following the shape of a plain article guide: `title`, `summary`, `intro`,
   `sections[]`, `note`. The Ads / Buy guide (`adsBuy`) also carries
   `adsHeading`, `adsLede`, `spendHeading`, and `spendLede` for its vertical
   priority layout — leave those off a new plain guide so it keeps the default
   article renderer.
3. Add or replace the item in the `guides` section in `lib/navigation.ts`,
   including a `badge` and `categoryId` from `guideCategories`. Reuse an existing
   category when the guide belongs next to one already there. Core systems
   (heroes, artwork, technology, collection, manor, goddesses, cryptides,
   production buildings)
   use `coreElements`; placement guides (hero layouts, artwork
   layouts) use `layouts`; ranking guides (hero tier list) use `tierLists`;
   building guides (Goddess Theater, Museion) use `buildings`; advice that is not tied to
   one system (hero linking, anecdotes, server age unlocks, hero leveling, goddess
   leveling, ads / buy) uses `tips`. Limited-time event write-ups belong under the top-level
   Events section in
   `lib/navigation.ts`, not under Guides — do not reuse `guideCategories.event`
   for Guides items.
4. For a new slug, copy `app/guides/ads-buy/page.tsx` and pass the new id
   to `GuideArticle`.
5. Add the guide to `GUIDE_PRESENTATION` in `lib/content/guide-meta.ts`: up to
   four pictures already under `public/` for its card on `/guides/` (an empty
   list shows the category icon; `cutout: true` for pictures on a transparent
   background), and `editor` with the route and button label when it has its
   own editor. `tests/guide-meta.test.mjs` fails until the entry exists, and
   checks that every picture exists and that `editor` routes match the
   `app/guides/*/edit/page.tsx` pages.

### How every guide looks

All guides share one frame, so a new guide only brings its own content:

- **`/guides/`** shows a card per guide (pictures, title, summary, category, and
  an Editor badge), a search that ignores accents, and a filter per category.
  `/guides/#<categoryId>` opens with that category picked; the sidebar links
  use this. Each category has a one-line `guides.categoryLedes.<categoryId>`
  in every dictionary.
- **The guide head** (`GuideHeader` in `app/guides/GuideArticle.tsx`) shows
  Guides / category, the title or its title banner from
  `lib/content/banners.ts`, the `summary`, and — when the entry has
  `creditDate` — `credit`, `creditDate`, and `status` as chips. The button to
  the guide's own editor sits there too, for members with `guides.draft`, so a
  renderer does not add its own edit link or top credit line.
- **Colours** come from the category: `data-category` on the head and the
  article sets `--cat`, which colours the crumb, the card, and the bar in front
  of every section heading.
- **Text-only guides** (headings and paragraphs) show their sections as cards.

A guide that needs more than headings and paragraphs gets its own renderer next
to `GuideArticle`: `GoddessesGuide`, `ArtworkGuide`, `ArtworkLayoutsGuide`,
`HeroLayoutsGuide`, `HeroRoster`, `HeroTierListGuide`, `GoddessTheaterGuide`,
`HeroLinkingGuide`, `AnecdotesGuide`, `ServerAgeUnlocksGuide`, `MuseionGuide`,
`HeroLevelingGuide`, `GoddessLevelingGuide`, `CollectionGuide`,
`BuildingsGuide`, and `CryptidesGuide`.
`guideLayout()` in `lib/content/guides.ts` picks the renderer from a field only
that guide has (`goddessTexts` for Goddesses, `phaseTexts` for Goddess leveling,
`collectionTexts` for Collection,
`playsHeading` for Goddess Theater,
`linksHeading` for Hero linking, `anecdoteTexts` for Anecdotes,
`timelineHeading` for Server age unlocks, `buildingsHeading` for Museion,
`focusHeading` for Hero leveling, `categoriesHeading` for Buildings,
`cryptidesHeading` for Cryptides, before
`filterAll` for Heroes), and
`tests/guides.test.mjs` pins every entry, so two guides cannot claim the same
renderer by sharing a field name. Keep `sections` and `note` in those entries
too, since the editor reads them. Goddess names, rarity, portraits, and the
English affinity and obtain live in `lib/data/goddesses.json`, once for all
languages; `goddessTexts` translates the wording. `tests/goddesses.test.mjs`
checks the roster against `public/goddesses/`. Goddess Theater casts live in
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

Members with `guides.draft` see **Edit builds** in the guide head, which opens
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

Members with `guides.draft` see **Edit tier list** in the guide head, which
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

On the page, each tier is a card with its letter in a gradient badge (the same
badge as in the detail dialog) on a strip tinted in the tier colour, followed
by portrait cards. Rarity chips with counts and the search field are the Heroes
roster's own, followed by an "N shown" line and a legend that spells out the
grade letters, the linker and situational marks (only when the list has them),
and that a card opens. A card opens the
hero's placement, reason, and tiers in every list. The battle list splits into
Damage, Sustain, Buffs, and Debuffs & control columns by each hero's first skill
tag (`ROLE_GROUPS` in `lib/content/hero-tiers.ts`). A new role key needs a
column there, and TypeScript enforces that through the dictionary type.

The export dialog lists problems first: missing names, duplicates, invalid
grades, and text keys without text. An untouched draft exports the published file
byte for byte (`tests/hero-tier-editor.test.mjs`), so a diff only ever contains
real changes.

## Editing artwork layouts

The page shows each ranked set as a card: the set's paintings as one strip (only
the ones that already have a picture; a set without any keeps an empty frame),
the rank, the set skill, its effect, the painting names, and a link to that set
on the Artwork page. Every set card on Artwork carries its id as an anchor, and
that page opens the matching rarity tab when the address has one
(`/guides/artwork/#rococo-curtain`). Set skills are translated in
`catalogTexts.sets[id].effect` per dictionary.

Members with `guides.draft` see **Edit set skills** in the Artwork layouts head, which
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

Members with `guides.draft` see **Edit catalogue** in the Artwork head, which opens
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

On 21 September 2026 the German names the screenshots did not cover, every
French name, the set names, and the productivity labels in both languages were
written through this editor's export. French original titles are the ones
French museums and Wikipedia use (for example *Tres de mayo*, *Des glaneuses*);
they are filled in exactly for the works whose dialog lists titles, so no row
falls back to English. Productivity uses the resource words of the tier list.

The draft is saved in that browser only
(`localStorage['popepoch-artwork-catalogue-draft']`), pictures included.
**Export** produces the complete `lib/data/paintings.json` in English, the new
pictures to put into `public/artwork/`, and the ones to delete. For each
dictionary whose translations changed, it also gives a `catalogTexts` block to
replace inside `guideEntries.artwork`. That block holds set names, set skills,
painting names, productivity, and original titles. An untouched draft exports
the published file byte for byte (`tests/artwork-editor.test.mjs`).

## Editing heroes

Members with `guides.draft` see **Edit heroes** in the Heroes head, which
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
  changing. A level may stay empty when its text is not known yet. Empty slots
  are left out of the export. On the Heroes page, each ability is a card with a
  level slider, and the numbers that changed since the level below are
  highlighted.
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

Tapping a hero opens their sheet: a head with the portrait, the facts, and the
hero's figure, then the subjects — Skills, Artifact, Skins, Story, and In other
guides — as a list beside the open panel. Every subject is laid out in the same
cell so the sheet keeps the tallest subject’s height when you switch; only the
active one is visible. The list carries a count where one helps: how many
abilities are filled in, how many skins, how many guides name this hero. A
subject the hero has nothing for is left out.

The list is a tab list: up and down walk it, Home and End jump to its ends,
while left and right still step to the previous or next hero. The subject a
reader picks stays picked as they step through the roster; on a hero without it
the sheet falls back to the first one without forgetting the choice. Below
640 px the list becomes a row of chips above the panel.

The portraits in `public/heroes/` were saved from the Pop Epoch Wiki rarity
pages on 14 September 2026. Cleopatra, Alexander the Great, and Augustus have
none. The artwork belongs to the game's publisher. The roster credits it under
the grid. To take the pictures down, delete the folder and empty the `images`
lists.

`public/heroes/chibi/<hero id>.webp` holds the small in-game figure of a hero,
free of the pedestal it stands on and of the level badge under it.
`scripts/cut-hero-figures.py` makes them from the local Heroes dump and
explains how; `lib/content/hero-chibis.ts` lists the hero ids that have one, and
`heroChibiUrl` returns `null` for the rest, so their sheet simply shows no
figure. 52 of the 82 heroes have one. These pictures belong to the game's
publisher as well; the roster credits them under the grid (`figureCredit`), and
deleting the folder together with the list takes them out again.
`tests/heroes.test.mjs` keeps list, folder, and roster in step.

Skill, buff, and production tables for 37 heroes come from German client
screenshots taken on 18 September 2026. English in `lib/data/heroes.json` is a
translation of that German text; `guideEntries.heroes.heroTexts` holds the
German wording. Production mid-levels that were not photographed are
interpolated: UR/UR+ +4% per level, SSR 30% + 3% × (n−1), as noted in the
source files. Joan of Arc had no skill tables in that dump, so her abilities
stay empty. Billy the Kid is not in this roster (skin cards only).

The French ability texts were written on 21 September 2026 from the English
ones: every ability is one French sentence whose placeholders take the numbers
of each level, with "S’active à N étoiles." in front where the English level
says "Activates at N-Star." Event names stay in English, as on the French event
pages. `tests/heroes.test.mjs` checks that every French level carries exactly
the numbers of the English level. On the same day the German texts got their
umlauts back — the screenshot import had written "fuegt", "Hoehe", "Koenig" and
similar — and Morgana's skill, the one ability that had no German yet.

The Goddesses guide uses the same tile grid. Rows live in
`lib/data/goddesses.json` (id, name, rarity, English affinity and obtain,
images, and the flags below); `guideEntries.goddesses.goddessTexts` translates
affinity and obtain by id, and an empty translation falls back to English.
Rarity follows the wiki card colours on
https://pop-epochmobile.fandom.com/wiki/Goddess as of 14 September 2026: gold
SSR, purple SR, blue R. Portraits in `public/goddesses/` come from that page
(`scripts/fetch-goddess-portraits.py`). Bastet's wiki card is a placeholder, so
she has no picture. Isis and Calypso are named by the obtain guide but not by
the wiki, so they have a roster row and no picture. To take the pictures down,
delete the folder and empty the `images` lists. The upgrade order used to sit at
the bottom of this guide; it is now its own guide under Tips and tricks (see
**Goddess leveling / upgrade order**), and the Goddesses page links to it.

### Where a hero or goddess comes from

Both rosters say where each entry comes from, taken from Autumn's obtain guide
shared on Discord on 9 August 2026, with screenshots from several players. Both
guides credit her in `obtainCredit` under the source cards; keep that line if
you edit the text.

A hero's source is the `obtain` field in `lib/data/heroes.json`, which
`heroTexts` can translate. For a goddess it is `obtain` in
`lib/data/goddesses.json`, which `goddessTexts` can translate, and
`tests/goddesses.test.mjs` requires a line for every goddess.
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
the roster yet (Billy the Kid, Charlie Chaplin) are left out until those
heroes are added.

Goddess Theater covers in `public/goddess-theater/` are the first image on each
card on https://pop-epochmobile.fandom.com/wiki/Goddess_Theater as of
14 September 2026 (`scripts/fetch-theater-covers.py`). That first picture is
the rarity-framed poster (UR / SSR / SR / R); the stills beside it stay off
the site. To take the pictures down, delete the folder and empty each play's
`image` field.

## Editing goddesses

Members with `guides.draft` see **Edit goddesses** in the Goddesses head, which
opens `/guides/goddesses/edit/`. It works like the Heroes editor:

- The list on the left filters by rarity and name and marks goddesses that are
  **new** or **changed**. Select one to edit her name, rarity, availability,
  affinity, and obtain, or to move her within her rarity.
- **Availability** is one of three choices: obtainable, **Not obtainable now**
  (`missable`), or **Source unconfirmed** (`unconfirmed`), so a goddess never
  carries both flags. **A skin raises her to SSR** sets `skinRaisesTo`.
- **Languages**: name, rarity, flags, and pictures are shared. Affinity and
  obtain appear once per language — English plus the page language, or every
  language with **Edit all languages**. English goes into the JSON.
- **Pictures**: the first is the portrait, the others are skins. Uploads are
  shrunk to 240 px WebP in the browser and named after the goddess id.
- **Export** gives the complete `lib/data/goddesses.json`, new pictures for
  `public/goddesses/`, the files to delete, and one `goddessTexts` block per
  dictionary that changed. It warns when a goddess is renamed or removed while
  Goddess Theater casts or skins still name her, when the upgrade order still
  uses her id, and when a removed picture is part of the banner collage
  (`lib/content/goddess-banner.ts`).

The draft is saved in that browser only
(`localStorage['popepoch-goddess-draft']`). An untouched draft reproduces the
published JSON and dictionary blocks byte for byte
(`tests/goddess-editor.test.mjs`).

## Goddess leveling / upgrade order

The goddess upgrade order sits under **Tips and tricks**
(`/guides/goddess-leveling/`, renderer `GoddessLevelingGuide`, detector
`phaseTexts`). Phases live in `lib/data/goddess-leveling.json`: an `id`, the
English `subtitle` and `lede`, and rows with a goddess `id` (or `null` for
everyone the phases do not name), the `target` level, and `withoutSsr` where
she stops lower without an SSR skin. Levels are written as the game writes them
and are the same in every language. `guideEntries.goddessLeveling.phaseTexts`
translates subtitle and lede by phase id. The page shows each phase as a row of
goddess cards and then one line per goddess across the phases.

Members with `guides.draft` see **Edit upgrade order** in the guide head, which
opens `/guides/goddess-leveling/edit/`. Phases can be added, reordered, and
removed; rows pick a goddess from the roster (or **Everyone else**), and set the
level and the level without an SSR skin. **Export** produces the complete JSON
and one `phaseTexts` block per dictionary, and warns about a phase without a
subtitle or goddess, a row without a level, and a goddess listed twice in one
phase. The draft is saved in that browser only
(`localStorage['popepoch-goddess-leveling-draft']`). An untouched draft
reproduces the published file byte for byte (`tests/goddess-leveling.test.mjs`).
The numbers are the community order this site already published (phase 2 stops
Fortuna and Bastet at 60), not the wiki's level list.

## Editing Goddess Theater

Members with `guides.draft` see **Edit plays** in the Goddess Theater head, which opens
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
(`tests/goddess-theater-editor.test.mjs`). Play and role names stay in English
in the JSON; German and French names live in `playTexts` and list only what
differs from English (Hamlet stays Hamlet). The export gives each dictionary's
`playTexts` block, and the test checks that `de.ts` and `fr.ts` hold exactly
that block.

### Theater income calculator

`/calculators/theater-income/` works out the Muse Coins of a play from the
player's ticket price and visitor flow upgrades, merchandise, rehearsal bonus,
and goddesses (`lib/calculators/theater-income.ts`). The formula is Autumn's
(Ice, S12, 20 August 2026): ticket price and audience are each rounded down,
then ticket income = price × audience × (1 + bonus) and merchandise income =
merchandise × audience × (1 + bonus). `tests/theater-income.test.mjs` replays
her three test performances to the coin, so a change to the rounding shows up
there first.

Everything the game fixes per play or goddess lives in
`lib/data/theater-income.json`:

- `plays`: every play in `goddess-theater.json` with its rarity, and where
  known the base ticket price and visitor flow from the play's preview
  (`ticket`, `visitors`) and its three aptitudes. UR+ plays have `slots: 5` because
  their casts have five roles; that is an assumption until someone checks.
- `goddesses`: the aptitudes known per goddess, and `lacks` for aptitudes a
  test showed she does not have. With `lacks` a play's bonus can be exact
  before all three of her aptitudes are known.
- `aptitudes`: each aptitude and the resource it trains.

The aptitudes of all 30 plays and of 20 goddesses were read from German client
screenshots on 22 September 2026: the Archive card of each play and each
goddess's talent page, whose icons are the aptitudes (house Family, teddy bear
Innocence, telescope Adventure, chess piece Intrigue, raven Darkness, scroll
Suspense, harp Artistry, jester Satire, broken mask Revenge, dove Idealism,
heart Love, hare Instinct). The talent page also names the resource an
aptitude trains; Darkness and Revenge were not shown, so their `resource` is
left out (Glass and Paper are the two left). Lilith has no screenshot and
Artemis only the two aptitudes Autumn's test showed. The same screenshots
added Hamilton, Les Misérables, and Notre-Dame de Paris to
`goddess-theater.json`, with covers cut from the Archive cards and no cast
yet; the Goddess Theater guide says the cast is not recorded, and the editor
test pins their `noRoles` problems until someone adds them.

Base values were known only for Pride and Prejudice, Don Quixote, and Robinson
Crusoe on that day. Autumn
confirmed that a play's base ticket price and visitor flow never change and are
the same for every player; only the muse coin bonus depends on the goddesses. A
Magic Lantern shows any play's preview, so the base values can be read off for
all plays once and stored in the JSON. Until then players
type the other plays' preview numbers and bonus into the page; that stays in
their browser (`localStorage['popepoch-theater-income']`). New values from a
player or a spreadsheet go into the JSON; the tests check that every aptitude
exists, every play has both base values or neither, and every goddess is in the
roster.

## Editing hero linking

Hero linking sits under the **Tips and tricks** category and keeps two lists:
the heroes that unlock a link, grouped by the Grail and Odin tracks, and the
order links are worth spending in. Both name heroes by their Heroes roster
spelling, so a portrait and a link into the roster always resolve;
`tests/hero-linking.test.mjs` checks every name against that roster.

Members with `guides.draft` see **Edit linking** in the guide head, which opens
`/guides/hero-linking/edit/`.

- **Add a hero** in either list is the Core elements Heroes roster, grouped by
  rarity and without the heroes that list already has, so the same hero cannot
  be added twice. A new link takes the next free step of its track.
- **Track** and **Step** are what the guide groups and numbers by. Two heroes on
  the same step of one track would both claim to be “#1”, so the export warns.
- **Position** in the link order is what the advice is: the first hero is the
  one to spend a single link on, the second is next, and so on.
- **Note** is optional prose beside a hero, not game data, so it lives in the
  dictionaries rather than the JSON. English is the text the other languages
  fall back to, so it is shown beside the reader's language, or every language
  with **Edit all languages** — the shared controls in
  `app/components/EditorLanguages.tsx`. A language without its own note shows
  the English one as its placeholder, because that is what a reader there gets,
  and the export lists what is still untranslated.

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

Members with `guides.draft` see **Edit timeline** in the guide head, which opens
`/guides/server-age-unlocks/edit/`. The draft is saved in that browser only
(`localStorage['popepoch-age-unlocks-draft']`). **Export** produces the
complete JSON, new pictures to put into `public/server-age-unlocks/`, files to
delete, and one `eventTexts` block per dictionary. An untouched draft
reproduces the published file byte for byte (`tests/server-age-unlocks.test.mjs`).
Source: Autumn (Ice, S12), Discord, 14 September 2026, marked in progress.

## Museion

Museion sits under **Buildings**. Halls, competition stats, and hero markers
live in `lib/data/museion.json` (English). The guide renderer is `MuseionGuide`;
building display names and competition-stat labels live in
`guideEntries.museion` for every language (`buildingTexts`, `stats`,
`primaryStatLabel`, `secondaryStatLabel`). Heroes use Core roster spellings
when they exist; a short off-roster allow-list covers names Autumn listed that
are not in `heroes.json` yet (Guan Yu, Lu Bu, Miyamoto Musashi, Yi Sun-sin).

Members with `guides.draft` see **Edit Museion** in the guide head, which opens
`/guides/museion/edit/`. The draft is saved in that browser only
(`localStorage['popepoch-museion-draft']`). **Export** produces the complete
JSON and one `buildingTexts` block per dictionary (including English). An
untouched draft reproduces the published file byte for byte
(`tests/museion.test.mjs`).
Source: Autumn (Ice, S12), Discord, 20 August 2026, with later placements from
Spitzell and Zee.

## Hero leveling / fragment priorities

Hero leveling sits under **Tips and tricks**. Focus bands, fragment rules per
Hero layouts build (Crit, DoT, Pursuit, Execute), and shared level caps live in
`lib/data/hero-leveling.json`. The guide renderer is `HeroLevelingGuide`
(detector `focusHeading`). Band labels, fragment kind labels, level-target
labels, and optional hero notes live in `guideEntries.heroLeveling`
(`heroNotes` is sparse per language).

The page uses the same look as the goddess upgrade order: each focus band is a
numbered stage on a coloured timeline with a tile per hero (rank on the right,
optional note underneath), each fragment rule is a numbered step, a table shows
every hero of the build with rank, band, and fragment steps, and the level caps
are tiles with the level as a large number. The styles are the shared `gl-*`
classes in `app/globals.css`.

Members with `guides.draft` see **Edit priorities** in the guide head, which opens
`/guides/hero-leveling/edit/`. The draft is saved in that browser only
(`localStorage['popepoch-leveling-draft']`). **Export** produces the complete
JSON and one `heroNotes` block per dictionary. An untouched draft reproduces
the published file byte for byte (`tests/hero-leveling.test.mjs`).
Source: Boah’s Discord list, with Autumn’s addendum (Ice, S12), 6 August 2026.

## Buildings

Buildings sits under **Core elements** (`/guides/buildings/`; old
`/guides/production-buildings/` still opens the same guide). Population,
production, and military rows live in `lib/data/buildings.json`. The guide
renderer is `BuildingsGuide` (detector `categoriesHeading`). Category labels,
production group labels, resource names, tag prose, and building name/note
overrides live in `guideEntries.buildings` (`buildingTexts` is sparse per
language).

The page shows population → production age groups → military as numbered stages
(the shared `gl-*` timeline) with compact cards: art, level cap, and for
production the cut-out or resource dots, stars for priority, produced/required
resource chips, and tags. A category filter, search, and resource filter narrow
the cards. A table lists every building with the same facts.

Members with `guides.draft` see **Edit buildings** in the guide head, which opens
`/guides/buildings/edit/`. The draft is saved in that browser only
(`localStorage['popepoch-buildings-draft']`). **Export** produces the complete
JSON and one `buildingTexts` block per dictionary. An untouched draft reproduces
the published file byte for byte (`tests/buildings.test.mjs`).
Roster, level caps, stage arts, and level-sample tables come from the Pop Epoch
Wiki Buildings page (Fandom), last merged on 18 September 2026. Production upgrade
resource *types* and priority asterisks are from a community Discord list
(Enlightenment thanks to Spitzell). Production cut-outs in
`public/production-buildings/` were taken from German client screenshots on
16 September 2026; wiki highest-stage and upgrade-stage art lives in
`public/buildings/` and `public/buildings/stages/`. Level rows live in
`lib/data/building-levels.json` (wiki samples, not necessarily every integer
level up to the cap). Tap a card for the detail panel. The building name is the wiki name (e.g. Spice Workshop / Gewürzhaus); coffee beans are the resource that workshop produces, not the building’s name.

## Collection

Collection sits under **Core elements** (`/guides/collection/`, renderer
`CollectionGuide`, detector `collectionTexts`). Items live in
`lib/data/collection.json`, one line each: `id`, English `name`, `rarity`, the
cut-out `image`, and the `skill` with its English `name`, `level`, `text`, and
round `icon`. Pictures are WebP files in `public/collection/`
(`<id>.webp`, `<id>-skill.webp`). `guideEntries.collection.collectionTexts`
translates name, skill name, and effect by id; an empty field shows English.
The effect text belongs to the skill level stored with it, because the numbers
change per level, so the card shows that level next to the skill name. Rarity
follows the colour of the item name in the game: red UR, gold SSR, purple SR.

The first 25 items were read from German client screenshots on 16 September
2026. Seventeen hero-exclusive UR items were added from screenshots on
18 September 2026; those cards use the St. 1 battle skill only. German is the
game's wording (the in-game typo "Fäigkeitsschadens…" is corrected); English
and French are translations and the guide's credit says so.
The item pictures were cut out with a background-removal model run locally
(rembg, `birefnet-general`), with the glow behind each item removed. The skill
icons are the circle inside the white ring, with the type badge and level
number painted over.

Members with `guides.draft` see **Edit collection** in the guide head, which
opens `/guides/collection/edit/`. Items can be added, removed, regrouped by
rarity, and reordered; name, skill name, and effect are edited in every
language; the skill level is shared. The item picture (360 px) and the skill
icon (144 px) are uploaded separately and shrunk to WebP in the browser, keeping
transparency. **Export** gives the complete JSON, new and removed pictures, and
one `collectionTexts` block per dictionary, and warns about a missing name,
picture, icon, or skill text, a duplicate name, and a level that is not a whole
number. The draft is saved in that browser only
(`localStorage['popepoch-collection-draft']`). An untouched draft reproduces
the published JSON and dictionary blocks byte for byte
(`tests/collection-editor.test.mjs`; `tests/collection.test.mjs` checks the
pictures and translations).

## Collection layouts

Collection layouts sit under **Layouts** (`/guides/collection-layouts/`,
renderer `CollectionLayoutsGuide`, detector `setupTexts`). The guide is the
general one: which collection goes into each of the six age slots. Data lives
in `lib/data/collection-layouts.json`:

- `setups`: `id`, `credit`, `tags`, English `title`, `lede`, `notes`, and
  `slots` with one collection id per age (`iceAge`, `stoneAge`, `bronzeAge`,
  `classical`, `medieval`, `renaissance`).
- `options`: every active collection with its `age`, the collection `item` id,
  an English `name` used until the Collection guide has that item, `tags`, and
  the English `note` on what it does.

Slots and options name a collection by its id in `lib/data/collection.json`, so
the picture and the translated name come from the Collection guide; a
collection that is not there yet shows its name without a picture and the guide
says so; every collection the published setups equip has a picture
(`tests/collection-layouts.test.mjs`). Ages and tags are named in `guideEntries.collectionLayouts`, along with
the build shapes, the upgrade priorities, and the authors' notes;
`setupTexts` and `optionTexts` translate setup titles, ledes, notes, and what a
collection does, keyed by setup id and collection id.

Setup ids are stable so Hero layouts can point at a setup later: this guide
stays the general one, while a hero build can carry its own collection line.

Members with `guides.draft` see **Edit layouts** in the guide head, which opens
`/guides/collection-layouts/edit/`. The left column lists the setups and then
the collections by age; a setup form takes the credit, tags, the six slots, and
the title, lede, and notes in every language, and a collection form takes its
tags and what it does. **Export** produces the complete JSON and one
`setupTexts` / `optionTexts` pair per dictionary, and warns about a missing or
duplicate title, an empty or unknown slot, and a collection without English
text. The draft is saved in that browser only
(`localStorage['popepoch-collection-layouts-draft']`). An untouched draft
reproduces the published file and blocks byte for byte
(`tests/collection-layouts-editor.test.mjs`; `tests/collection-layouts.test.mjs`
checks the data and the translations).
Source: Boah's and Autumn's (Ice, S12) Discord guides, August and September 2026.

## Cryptides

Cryptides sits under **Core elements**. Structured rows (tower, talent material,
skills, foods, image paths) live in `lib/data/cryptides.json`. Readable names,
skill bodies, feed names, Tower labels, and talent copy live in
`guideEntries.cryptides` (`cryptideTexts` is sparse per language). The guide
renderer is `CryptidesGuide` (detector `cryptidesHeading`). Portraits and icons
are WebP crops under `public/cryptides/`.

Talent rules encoded in the JSON: unlock costs `unlockCost` of that Cryptide's
summon material; the Tower drops `dropAmount` every `dropEveryLevels` levels.
Mapping: Cerberus → Pike / Bell, Nidhogg → Bow / Branch, Caladrius → Shield /
Potion, Sleipnir → Horse / Grass.
Source: in-game screenshots (16 September 2026); talent material map from the
same pass.

Members with `guides.draft` see **Edit Cryptides** in the guide head, which
opens `/guides/cryptides/edit/`. The list on the left marks Cryptides that are
**new** or **changed**; the form edits a Cryptide's names in every language,
rarity, Tower, talent material and portrait, then its skills (icon, name,
effect) and its feed (icon, name, growth), each of which can be added, removed
and moved. The three talent numbers sit above the list, since they hold for
every Cryptide. Names and texts can be written in every language; numbers and
pictures are shared, and uploads are shrunk to WebP in the browser (480 px for
a portrait, 160 px for an icon). The draft, pictures included, is saved in that
browser only (`localStorage['popepoch-cryptides-draft']`).

**Export** gives the complete `lib/data/cryptides.json`, the new pictures with
the path each belongs at (`<id>.webp`, `skills/<id>-<n>.webp`,
`foods/<id>-<n>.webp`), the files nothing uses any more, and a `cryptideTexts`
block for each dictionary whose texts changed. A new Cryptide, skill or food
takes its id from the English name. `tests/cryptides-editor.test.mjs` checks
that an untouched draft exports the JSON byte for byte and every language's
texts unchanged.


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

Members with `guides.draft` see **Edit anecdotes** in the guide head, which opens
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

## Adding an event guide

Event guides are a flat list in the Events section. In-game help and square icons come from the Pop Epoch
wiki Events hub (`lib/data/event-wiki.json`, last merged 18 September 2026);
Discord tips stay in the dictionaries.

1. Add a nav item with `eventNav("<id>", "/events/<slug>/")` in
   `lib/navigation.ts`. That pulls the title, summary, and wiki icon.
2. Add `app/events/<slug>/page.tsx` that renders `EventArticle` with that id,
   and write `eventGuideEntries.<id>` (`title`, `summary`, `intro`,
   `sections[]`, `note`) in all three dictionaries. Community tips go in
   `sections`; leave `sections` empty if there are none yet.
3. Put the wiki help icon in `public/events/<slug>.webp` and a matching row in
   `lib/data/event-wiki.json` (or re-run `scripts/fetch-event-wiki.py`). Cite
   the wiki page and the merge date.
4. Do not list event write-ups under `guides.items`.

## Editing event guides and guides that are only text

Every event guide, and every guide that is nothing but text without an editor
of its own (Ads / Buy today), has an edit mode. Members with `guides.draft` see
**Edit** in the page head; it opens the editor under the article, and while it
is open the page itself shows the draft, in the language the page is in.

- **Fields** are read from the English entry: every string it has (title,
  summary, intro, credit, date, the Ads / Buy headings, note, …) in the order
  the dictionary has them. A field that grows into an entry later needs no
  change to the editor.
- **Sections** each hold a heading and the paragraphs, one blank line between
  paragraphs. They can be added, removed, and moved up or down; the order holds
  for every language. A section's picture (Heart of Gold) stays as it is; only
  its description is translated.
- **Languages** work as in every other editor: English plus the page's language,
  or all of them with **Edit all languages**. A field left empty in a language
  takes the English text, which is what readers of that language get until
  somebody translates it.
- The draft stays in this browser (`popepoch-text-guide:<catalog>:<id>`) until
  **Discard changes** or until it matches the published text again.

**Export** gives one block per dictionary that changed. Each block replaces the
whole entry — `eventGuideEntries.<id>` or `guideEntries.<id>` — in that
dictionary. `lib/content/text-guide-editor.ts` holds the logic, and
`tests/text-guide-editor.test.mjs` checks that an untouched draft gives back
every event guide and every text-only guide in every language unchanged, key
order included.

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
so they can be corrected in one place. The same goes for the German and French
painting set names in `catalogTexts.sets` and the Goddess Theater role names in
`playTexts`: plays and paintings use their usual published titles, but set
names and roles such as "Support 1" were translated here.
The Theater income calculator's German and French words for Muse Coins
(Musenmünzen, pièces des Muses) and the theater upgrades are ours too, in
`theaterIncome` in each dictionary. The German aptitude names are the game's;
the English ones for Family, Innocence, Intrigue, Darkness, and Revenge and
all French ones are ours. Red Carpet points are shown rounded down to whole
hundreds, because every Red Carpet item is worth a multiple of 100.

Hero and Collection names in the Hero layouts and tier list data are not
translated at all: they live in the JSON files, and only qualifiers such as
"with item" (`pickNotes`) are translated.
