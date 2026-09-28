# Volunteer translator guide

Thank you for helping translate Pop Epoch Tools. Your role is only to translate
the text supplied by the project maintainer. You will not edit the website,
pages, or code. The maintainer will send you a translation pack with the English
text, stable keys, and screen context. Fill in the translation column and return
the same file; please keep the keys and source text unchanged. The maintainer
will integrate your translations into the website after review.

## Before you start

Confirm the target language and regional variant with the maintainer (for
example, `es-ES` or `pt-BR`). One pack covers one language. If several people
volunteer for the same language, agree on one lead translator and one reviewer;
the lead owns the working copy and gathers questions so two people do not
overwrite each other's changes.

The source language is English. Translate the supplied player-facing text, not
code, keys, IDs, URLs, game titles, character names, or values. Follow the
project glossary supplied with the pack. If the game already has an official
localized term, use it. If a phrase is unclear or a term is missing from the
glossary, leave a note instead of guessing.

## Fill in the translation pack

Use the provided CSV or spreadsheet. It has these columns:

| Column | What to do |
| --- | --- |
| `key` | Keep unchanged. It identifies exactly where the text appears. |
| `english_source` | Read for meaning; do not edit. |
| `context` | Use this to understand the screen, audience, or grammatical role. |
| `translation` | Enter your complete translation. Leave it blank only if you need clarification. |
| `translator_note` | Ask a question or explain an intentional wording choice. |

Keep these details exactly as shown in the source:

- Placeholders such as `{count}`, `{name}`, `{points}`, and `{date}`. They are
  filled by the app and must not be translated, removed, or changed.
- URLs, keyboard shortcuts, IDs, rarity labels such as R / SR / SSR / UR, and
  numbers that are part of a formula or game value.
- Markdown links and emphasis. Translate the words inside the link, not its URL.

Translate for natural, concise game UI. Buttons and headings need to fit on
small screens; prefer a clear short phrase over a literal long translation.
Keep the meaning and warnings intact. Do not change formulas, probabilities,
energy costs, or gameplay instructions while translating them.

## Review and return

Before returning the pack, check that every supplied row has a translation or a
note, placeholders still match the English source, and terminology is consistent
throughout the file. Read the translated strings together as a player would;
correct grammar that only becomes clear in context.

Return the completed pack to the project maintainer. Do not publish it or make
changes to the website. The maintainer will import the text into the correct
language dictionary, run checks for missing keys and placeholders, and review
the site in that language. A second fluent speaker should review the pack when
one is available. The translation is published only after that review and the
normal site checks pass.

## How a new language is added

The current site ships English, German, and French. A new language needs a
locale code, number/date formatting, and a complete dictionary with the same
keys as English. The project maintainer handles that code work after agreeing
on the target language and preparing the translation pack. Translators should
not copy or edit `en.ts`, `de.ts`, or `fr.ts` directly.

The blank [translation-sheet template](translation-template.csv) shows the
format. It is an example, not the full list of strings; the maintainer prepares
a source-keyed pack for the agreed language and translation batch.
