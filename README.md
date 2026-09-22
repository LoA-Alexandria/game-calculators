# Game Calculators

A shared collection of focused game calculators and planners for Pop Epoch,
maintained by LoA Alexandria. The site is a static Next.js application deployed
through GitHub Pages. It follows the reader's light or dark preference, adds a
toggle to override it, and offers four colour schemes (stone, lapis, papyrus,
steam) from the top bar.

## Start locally

Requires Node.js 22 or newer.

```sh
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Useful commands

```sh
pnpm test       # run calculation tests
pnpm build      # create the static site in out/
pnpm lint       # check source style
```

## Sections and languages

The site is split into News, Guides, Calculators, and Simulations, reachable
from the sidebar, and is available in English, German, and French. Adding an
entry or a language is described in
[`docs/CONTENT-AND-LANGUAGES.md`](docs/CONTENT-AND-LANGUAGES.md).

## Discord login and guide editor

Discord login is handled by Supabase. Members with the configured Coders or
Builders server role can open `/guides/new/` and Edit / Remove on existing
guides. Authentication and role checks are real; the editor prints a snippet
to commit. Saving a guide to a shared wiki is the next backend phase. See
[`docs/SUPABASE-SETUP.md`](docs/SUPABASE-SETUP.md) for deployment setup and
[`docs/AUTH-AND-CMS.md`](docs/AUTH-AND-CMS.md) for the current boundary.

## Add a calculator

Read [`docs/ADDING-A-CALCULATOR.md`](docs/ADDING-A-CALCULATOR.md). Each calculator should include documented assumptions, pure calculation logic, boundary tests, an accessible interface, and an entry on the home page.

The first five production calculators were ported from Pop Bot. Their copied data and assumptions are documented in [`docs/POP-BOT-DATA.md`](docs/POP-BOT-DATA.md).

## Irrigation Planner

The Irrigation Planner is a self-contained application shipped in
`public/tools/irrigation-planner/` and embedded by
`app/simulations/irrigation-planner/`. It is vendored rather than ported, which
is a documented exception to the architecture; read
[`docs/IRRIGATION-PLANNER.md`](docs/IRRIGATION-PLANNER.md) before changing it.

## Work with a coding agent

Start with [`AGENTS.md`](AGENTS.md) and [`docs/AGENT-WORKFLOW.md`](docs/AGENT-WORKFLOW.md). These files define the repository-wide guardrails and provide ready-to-use prompts.

## Deployment

Every push to `main` runs tests, builds a static export, and deploys it to GitHub Pages. In the repository settings, select **GitHub Actions** as the Pages source if it is not already selected.

## Repository protection

The project expects `main` to accept changes only through reviewed pull requests. See [`docs/REPOSITORY-SETTINGS.md`](docs/REPOSITORY-SETTINGS.md) for the required GitHub ruleset and contributor permissions.
