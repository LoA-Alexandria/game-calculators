# Adding a calculator

1. Write down the inputs, outputs, units, valid ranges, formula, rounding rules, and source data.
2. Copy `app/calculators/example/` to a short, descriptive slug.
3. Move non-trivial calculation logic into `lib/calculators/<slug>.ts`.
4. Add boundary-focused tests under `tests/`.
5. Add the calculator to the directory in `app/page.tsx`.
6. Explain assumptions beside the result; do not hide them only in documentation.
7. Verify keyboard use, labels, error messages, narrow layouts, tests, and the production build.

## Definition of done

A calculator is ready when a player can understand what to enter, trust how the answer was produced, recover from invalid input, and use the tool comfortably on a phone.
