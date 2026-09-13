# Irrigation Planner

The Irrigation Planner is a complete, self-contained application that ships with
the site as a static file instead of being rewritten as React pages.

```text
public/tools/irrigation-planner/index.html   the application (HTML + CSS + JS)
app/simulations/irrigation-planner/page.tsx  the wrapper page that embeds it
```

## Why it is vendored instead of ported

`docs/ARCHITECTURE.md` asks for pure calculation functions in `lib/` with the
page limited to collecting and displaying values. The planner does not fit that
shape: roughly 2,500 lines of it are an interactive grid editor and a
time-budgeted layout solver whose state is the board itself. Splitting that into
presentation and calculation would be a rewrite, not a port, and every step of
the rewrite would risk changing results that players already rely on.

The file is therefore treated the same way as versioned source data: copied in
whole, with its origin recorded, and changed only deliberately.

**This is a documented exception, not a precedent.** New calculators follow
`docs/ADDING-A-CALCULATOR.md`.

## Origin

Copied from `irrigation-planner_33.html` (revision 33), which used to sit in
the repository root and is no longer there — the vendored copy under
`public/` is now the only one, and it is complete. Only the changes listed
below were made to it; the solver, the game data, the layout rules, and the
stored formats are untouched.

## Changes made to the vendored copy

1. **Title** — `Irrigation Planner · Pop Epoch Tools`.
2. **Palette** — light, dark, and colour-scheme tokens match `app/globals.css`
   (stone, lapis, papyrus, steam). Change one, change both.
3. **Embed flag** — with `?embed=1` the document adds `embedded` to
   `<html>`, which hides its own eyebrow and `<h1>` (the wrapper page supplies
   both) and trims the body padding. The instruction paragraph is kept. Without
   the flag the file behaves exactly as it did standalone.
4. **Theme and scheme bridge** — a small script in `<head>` reads
   `localStorage['popepoch-theme']` and `localStorage['popepoch-scheme']` and
   applies them as `data-theme` and `data-scheme` on `<html>`. Because the iframe
   is same-origin, a later change from the site arrives as a `storage` event and
   the planner follows it live. With no stored theme the planner falls back to
   `prefers-color-scheme`; with no stored scheme it keeps the default stone
   palette.

## Contract with the site

| Concern | Owner |
| --- | --- |
| `localStorage['popepoch-theme']` | written by `app/components/ThemeToggle.tsx`, read by both |
| `localStorage['popepoch-scheme']` | written by `app/components/SchemeMenu.tsx`, read by both |
| `?embed=1` | set by the wrapper page only |
| `irrigation_planner_*`, `irrigation_prod_v1`, `irrigation_tab_v1` | the planner alone |

The wrapper page builds the iframe URL with `asset()` from `lib/site.ts`, because
Next.js does not apply `basePath` to plain string URLs. If the GitHub Pages base
path changes, change it in `next.config.ts` only.

## Updating the planner

1. Replace `public/tools/irrigation-planner/index.html` with the new revision.
2. Re-apply the four changes above.
3. Record the new revision number in the **Origin** section.
4. Open `/simulations/irrigation-planner/`, switch the site theme and colour
   scheme, and check that the heading is not duplicated and the palette follows.

## Assumptions shown to players

The planner states its own model on screen: a production building counts the sum
of every water source whose range touches its footprint anywhere, each source
counted once whether or not ranges overlap, with 640 water as the goal. The
wrapper page repeats this below the frame, together with the fact that all data
stays in the reader's browser.
