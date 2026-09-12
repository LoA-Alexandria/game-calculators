# Architecture

## Overview

The project is a browser-only Next.js site using the App Router and static export. GitHub Pages serves the generated `out/` directory. There is no server runtime.

## Structure

```text
app/
  calculators/<slug>/page.tsx  Calculator pages
  globals.css                  Shared visual system
  layout.tsx                   Site metadata and document shell
  page.tsx                     Calculator directory
docs/                          Human and agent guidance
public/                        Static assets
tests/                         Calculation and output tests
.github/workflows/pages.yml    Test, build, and Pages deployment
```

## Design boundaries

- Components collect and display values.
- Pure functions perform calculations and validation.
- Versioned constants hold game data.
- Tests describe the expected rules and edge cases.
- Static export means calculators must not depend on server actions, private environment variables, databases, or runtime APIs.

When a calculation grows beyond a few lines, place it in `lib/calculators/<slug>.ts` and test it independently.
