# Hero simulator

Experimental event simulation and independent team search, model v2, 26 September
2026. This replaces the original guide-weight ranking. Neither battle simulation
nor team search imports layout archetypes, tiers, role scores, or recommended builds.
The browser runs the search in a cancellable Web Worker with a reproducible seed.

## Sources

- [Heroes](https://loa-alexandria.github.io/game-calculators/guides/heroes/):
  lib/data/heroes.json, roster and client screenshots, 13–18 September 2026.
- [Hero layouts](https://loa-alexandria.github.io/game-calculators/guides/hero-layouts/):
  Autumn's formation rules, August 2026 / September additions: lower slots cast
  first, higher slots fall first, living heroes contribute attack. These inform
  the model; the guide's fixed build lists are never used by the optimizer.
- [Collection](https://loa-alexandria.github.io/game-calculators/guides/collection/):
  lib/data/collection.json, screenshots 16–18 September 2026.

The model reads skill coefficients from the recorded English ability tier. Stars
select the highest explicitly unlocked tier; unlabelled later tiers are never
guessed. Items use the level currently recorded in their guide. No base-stat
curve is known: 100 ATK / 1,000 HP are clearly labeled scenario defaults and
players can enter actual ATK/HP separately. Hero level is saved metadata only.

## Coverage

MODELED_HEROES and MODELED_ITEMS in lib/calculators/hero-battle.ts are the coverage
boundary (27 heroes, 18 items in v2). Missing or ambiguous effects are disabled
and named in the UI, never assigned generic scores or inferred skills. Some
recorded hero entries currently contain only direct damage; those simulate only
that recorded damage, not unrecorded mechanics that may exist in the live game.
The source ability text is available on each selected card.

Implemented events include skill activation, normal hits, critical damage, extra
attacks / pursuit, DoT, healing, shields, dodge, damage reduction, buff removal,
and the supported Collection triggers. No execute, revival, Plunder, unknown
proc chances, troop advantages, event passives, command scaling or enemy items
are silently approximated.

## Explicit scenario assumptions (not verified game formulas)

- One action per side per round. Player first by default, switchable. Command
  does not establish initiative because the source formula is missing.
- Every ready living hero rolls its documented trigger chance. The lowest slot
  among successes casts; Arthur has the priority stated in his text. A skill is
  spent after use by default; an optional repeat mode is an experimental rule.
  Normal attacks occur if none activates.
- Attack strength is the sum of living heroes' entered ATK. Skill coefficients
  multiply that sum. Incoming damage consumes individual HP from the highest
  slot down and spills over; zero-HP heroes stop acting/contributing.
- Shield is a formation pool. Healing fills the most wounded living heroes first
  and cannot revive. Max-HP fractions use the formation's initial total max HP.
- Buff durations use the affected side's action clock and expire before its next
  action once the duration has elapsed. DoT has exactly three victim-action ticks.
  DoTs snapshot total ATK on application and stack as separate applications.
  Stat effects from different sources coexist; refreshing one source preserves
  other sources. Buff removal/counting currently treats each stat effect entry
  as one effect. Brutus Dagger resolves after the affected side's action.
  Other repeated stacking behavior follows the explicit handlers; repeat mode
  is a sensitivity experiment, not a claim about the game's stacking rules.
- Additive skill bonuses multiply the base damage; reductions are capped at 90%.
  Critical attacks multiply by their recorded critical increment and then by the
  allied critical-damage modifier. These multiplier/stacking assumptions need
  verification against real combat logs. Defence is not fabricated: an explicit
  enemy damage-reduction input scales damage to the enemy.
- Damage metrics count effective HP loss after shields and reductions; overkill
  is excluded. Damage per scheduled round divides by the selected fight length,
  including unused rounds after a kill. There is no invented seconds-per-round.
- Training target: no attacks, effectively unlimited HP; victory percentage does
  not apply. Standard test team: Achilles, Caesar, Da Vinci, each 100 ATK / 1,000 HP,
  0 stars. Custom opponents use supported heroes with manual stats and slot order.
  Enemy artifacts/Collection are not modeled in this version.

These rules produce real evolving combat state and emergent interactions, but
do not yet establish a validated replica of Pop Epoch's combat engine.

## Team search

Input: supported owned heroes, fixed owned artifacts and fixed equipped Collection,
team size 1–25, rounds 1–100, trials 1–128, candidates 1–1,000, seed. Small spaces
enumerate all ordered teams when the permutation count fits the budget. Larger
spaces generate seeded random teams, then mutate membership and ordering of the
current best candidates. No archetype is prescribed.

Candidates are measured by simulated damage, or win rate then remaining HP and
damage. Eight search finalists are reevaluated on a separate set of 128 seeds;
the best three are shown. This reduces search-seed overfitting without proving a
global optimum. The deviation is the population standard deviation of damage,
not a confidence interval. The graph and event log show one validation-seed
replay, while headline metrics average all validation runs.

## Production

Production is now a global one-to-one hero/building assignment, followed by a
time simulation. A maximum-weight assignment reserves universal heroes for
buildings where specialists cannot work. Each slot gets at most one hero; each
hero appears at most once. The user specifies base comparable units/hour and a
0–168 hour horizon. Rate = baseRate × (1 + documented individual bonus / 100);
the timeline integrates that constant rate, including fractional final hours.
Unknown production text and unmet star gates cannot contribute a bonus.
No stacked heroes in one slot, production cycles, resource-specific prices,
storage caps or undocumented city bonuses are assumed. Source intermediate
production ability rows can be interpolated; see lib/content/heroes.ts.

## Verification and extension

tests/hero-battle.test.mjs covers reproducible random draws, source star gates,
HP loss/death order, DoT ticks/expiry, healing/shields, Collection interactions,
exhaustive and budgeted search, unsupported data and manual-stat sensitivity.
tests/hero-team.test.mjs covers global production assignment, one-use constraints,
zero/fractional time, star gates and invalid input.
After building, run `node --experimental-strip-types scripts/verify-hero-worker.mjs`
to execute the exported worker in an isolated JavaScript context and compare
its output with the source engine. This does not replace browser UI checks.

To expand fidelity, add verified stat curves, command/defence rules and complete
effect definitions with source dates and behavioral tests. Do not turn missing
effect data into a guessed coefficient. Update UI assumptions and this document
alongside any changed model rule.
