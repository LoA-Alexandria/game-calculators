# Game Calculators

A shared collection of focused game calculators maintained by LoA Alexandria. The site is a static Next.js application deployed through GitHub Pages, with Supabase providing Discord authentication and wiki services.

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

## Add a calculator

Read [`docs/ADDING-A-CALCULATOR.md`](docs/ADDING-A-CALCULATOR.md). Each calculator should include documented assumptions, pure calculation logic, boundary tests, an accessible interface, and an entry on the home page.

The first five production calculators were ported from Pop Bot. Their copied data and assumptions are documented in [`docs/POP-BOT-DATA.md`](docs/POP-BOT-DATA.md).

## Work with a coding agent

Start with [`AGENTS.md`](AGENTS.md) and [`docs/AGENT-WORKFLOW.md`](docs/AGENT-WORKFLOW.md). These files define the repository-wide guardrails and provide ready-to-use prompts.

## Deployment

Every push to `main` runs tests, builds a static export, and deploys it to GitHub Pages. In the repository settings, select **GitHub Actions** as the Pages source if it is not already selected.

Discord authentication and wiki-editor access are configured separately in Supabase. See [`docs/SUPABASE-SETUP.md`](docs/SUPABASE-SETUP.md).

## Repository protection

The project expects `main` to accept changes only through reviewed pull requests. See [`docs/REPOSITORY-SETTINGS.md`](docs/REPOSITORY-SETTINGS.md) for the required GitHub ruleset and contributor permissions.
