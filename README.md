# Game Calculators

A shared collection of focused game calculators and planners for Pop Epoch,
maintained by LoA Alexandria. The site is a static Next.js application deployed
through GitHub Pages. It follows the reader's light or dark preference and adds
a toggle to override it.

## Start locally

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

## Useful commands

```sh
npm test       # run calculation tests
npm run build  # create the static site in out/
npm run lint   # check source style
```

## Sections and languages

The site is split into News, Guides, Calculators, and Simulations, reachable
from the sidebar, and is available in English, German, and French. Adding an
entry or a language is described in
[`docs/CONTENT-AND-LANGUAGES.md`](docs/CONTENT-AND-LANGUAGES.md).

## Admin area and guide editor

`/admin/` manages roles and the Discord-role mapping; `/guides/new/` is the
guide editor. Both are **interface drafts without any security** — a static
export cannot verify a password. Read
[`docs/AUTH-AND-CMS.md`](docs/AUTH-AND-CMS.md) before building the backend; it
lists the data shapes, the endpoints, and everything that must be deleted first.

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
