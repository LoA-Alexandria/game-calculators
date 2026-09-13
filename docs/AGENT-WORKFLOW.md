# Working with coding agents

Give an agent a bounded goal, authoritative data, and explicit acceptance criteria. Ask it to inspect the existing patterns before changing code.

## Prompt: add a calculator

```text
Add a <name> calculator to this repository. Read AGENTS.md and the docs first.

Player goal:
<what decision this calculator helps with>

Inputs and units:
<list>

Formula and rules:
<formula, caps, rounding, unlock rules>

Authoritative data source:
<link or supplied file, including date/version>

Acceptance criteria:
- Calculation logic is separated and tested.
- Important boundaries and invalid inputs are covered.
- The page explains assumptions and units.
- The home page links to the calculator.
- pnpm test and pnpm build pass.
```

## Prompt: verify a calculation

```text
Audit the <name> calculator for correctness. Do not change files yet. Compare every formula, constant, boundary, and rounding rule with <source>. Report concrete discrepancies with file and line references, then propose the smallest safe correction and tests.
```

## Prompt: fix a bug

```text
Reproduce and fix this calculator bug: <description>. Add a failing regression test first, make the smallest scoped correction, then run the complete test and build checks. Do not change unrelated behavior.
```

## Review questions

- Which facts came from a source, and which were assumptions?
- What happens at zero and at every supported boundary?
- Are units and rounding visible to the player?
- Can future game-data changes be made without rewriting the interface?
