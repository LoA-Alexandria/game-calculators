# Contributing

Contributions should make a calculator more accurate, understandable, or useful.

## Protected main branch

All changes must arrive through a pull request. Do not push directly to `main`.

An approving review is not required: a contributor with write access may merge
their own pull request once it is tested and the automated checks pass. Ask for
a review when a change is large or risky — authentication, roles, database
migrations, or a redesign — or whenever a second opinion would help. Request it
from the reviewers menu on the pull request, and mention it in the team chat as
well, since review requests arrive by email and are easy to miss.

## Pull-request checklist

- Explain the player problem being solved.
- Link or document the source for game values and formulas.
- Put calculation rules in a pure function where practical.
- Add tests for normal, zero, minimum, maximum, and invalid inputs.
- Explain rounding, caps, unlock conditions, and other assumptions in the interface.
- Test the calculator with keyboard navigation and a narrow screen.
- Run `pnpm lint`, `pnpm test`, and `pnpm build`, and check interface changes in a browser.
- Keep unrelated cleanup out of the pull request.
- Wait for the automated checks to pass before merging.

## Data corrections

For a data-only correction, include the old value, new value, source, and effective game version or date. A screenshot can support a change, but a stable published source is preferable.

## Commit messages

Use short, direct messages such as:

```text
Add city upgrade calculator
Correct level 30 material cost
Improve route result accessibility
```
