# Architecture

## Overview

The project is a statically exported Next.js site. GitHub Pages serves the generated `out/` directory. Supabase provides Discord authentication, persistent wiki data, row-level authorization, and the small server-side functions needed for Discord role checks.

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
- Calculators remain browser-only and independent of authentication. Wiki features use the Supabase browser client with its publishable key and RLS-protected tables. Discord and Supabase secrets exist only in their respective dashboards and Supabase Edge Functions.

When a calculation grows beyond a few lines, place it in `lib/calculators/<slug>.ts` and test it independently.
