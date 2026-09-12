# Instructions for coding agents

This repository contains small, browser-only game calculators published as a static GitHub Pages site.

## Working rules

- Keep calculation logic deterministic and separate from presentation code.
- Do not add a backend, database, tracking, authentication, or external API unless the issue explicitly requires it.
- Treat source data as versioned code. Cite its origin and effective date in the relevant calculator documentation.
- Never silently change a formula or assumption. Update tests and user-facing notes in the same change.
- Prefer a focused calculator over a large shared abstraction. Extract shared code only after two real consumers need it.
- Preserve keyboard access, visible labels, mobile layouts, and reduced-motion behavior.
- Do not commit generated `out/`, `.next/`, secrets, personal data, or local environment files.
- Work on a feature branch and open a pull request. Never push directly to `main`.
- Do not merge a pull request without approval from another contributor and passing checks.

## Before editing

1. Read `README.md`, `CONTRIBUTING.md`, and `docs/ARCHITECTURE.md`.
2. Read the calculator's own documentation and tests.
3. State any assumption that changes the formula, supported range, or interpretation of game data.

## Required verification

Run these commands before handing work back:

```sh
npm test
npm run build
```

Report what changed, which assumptions were made, and the verification result. Do not claim a calculation is correct without a test covering its important boundaries.
