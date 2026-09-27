# Instructions for coding agents

This repository is a statically exported Next.js site of game calculators,
guides, and a Discord- and email-authenticated editor, published on GitHub Pages.

## Working rules

- Keep calculation logic deterministic and separate from presentation code.
- Calculators stay browser-only and independent of authentication. Do not add a
  new backend, database, tracking, or external API unless the issue explicitly
  requires it. Discord login, username/password, Premium entitlements, and role
  checks already use Supabase; extend that path rather than inventing a second
  one.
- Treat source data as versioned code. Cite its origin and effective date in the relevant calculator documentation.
- Never silently change a formula or assumption. Update tests and user-facing notes in the same change.
- Prefer a focused calculator over a large shared abstraction. Extract shared code only after two real consumers need it.
- Preserve keyboard access, visible labels, mobile layouts, and reduced-motion behavior.
- Do not commit generated `out/`, `.next/`, secrets, personal data, or local environment files.
- Work on a feature branch and open a pull request. Never push directly to `main`.
- Merge a pull request only after the verification below and passing checks. Approval is not required, and there is no second maintainer to ask: nobody reviews this repository but the person you are working for.
- That makes authentication, roles, row level security, database migrations and redesigns your responsibility alone. Do not route them to a reviewer who is not there. Instead: keep the change small and single-purpose, write in the pull request what could go wrong and what you actually checked, verify against the real database where you can, and say plainly in chat which parts are unverified. A risk named out loud is the substitute for the review, not a review request.

## Before editing

1. Read `README.md`, `CONTRIBUTING.md`, and `docs/ARCHITECTURE.md`.
2. Read the calculator's own documentation and tests.
3. State any assumption that changes the formula, supported range, or interpretation of game data.

## Required verification

Run these commands before handing work back:

```sh
pnpm lint
pnpm test
pnpm build
```

Check interface changes in a browser as well, including a narrow screen.

Report what changed, which assumptions were made, and the verification result. Do not claim a calculation is correct without a test covering its important boundaries.
