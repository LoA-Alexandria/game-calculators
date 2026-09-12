# Contributing

Contributions should make a calculator more accurate, understandable, or useful.

## Protected main branch

All changes must arrive through a pull request. A contributor with repository
write access must approve the pull request, and automated checks must pass,
before it can be merged. Do not push directly to `main` or merge your own
unreviewed changes.

## Pull-request checklist

- Explain the player problem being solved.
- Link or document the source for game values and formulas.
- Put calculation rules in a pure function where practical.
- Add tests for normal, zero, minimum, maximum, and invalid inputs.
- Explain rounding, caps, unlock conditions, and other assumptions in the interface.
- Test the calculator with keyboard navigation and a narrow screen.
- Run `npm test` and `npm run build`.
- Keep unrelated cleanup out of the pull request.
- Obtain approval from another contributor with repository write access.

## Data corrections

For a data-only correction, include the old value, new value, source, and effective game version or date. A screenshot can support a change, but a stable published source is preferable.

## Commit messages

Use short, direct messages such as:

```text
Add city upgrade calculator
Correct level 30 material cost
Improve route result accessibility
```
