# Hero simulator

Experimental event simulation and joint team / Collection search, model v4, 27 September
2026. The baseline lineup mode added 1 October 2026 is a separate workbook-derived
ranking and does not change the battle model. Neither battle simulation
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
- [Cryptides](https://loa-alexandria.github.io/game-calculators/guides/cryptides/):
  lib/data/cryptides.json and localized guide skill texts, screenshots 16 September 2026.

The model reads skill coefficients from the recorded English ability tier. Stars
select the highest explicitly unlocked tier; unlabelled later tiers are never
guessed. Items use the level currently recorded in their guide. All selected
heroes share one entered level. No base-stat curve is known: 100 ATK / 1,000 HP
are fixed placeholders, so this level is metadata until real stat scaling is
recorded. Results compare modeled interactions, not real damage values.

## Coverage

MODELED_HEROES and MODELED_ITEMS in lib/calculators/hero-battle.ts are the coverage
boundary (27 heroes and 18 exclusive / Collection items as of 27 September 2026). Missing or ambiguous effects are disabled
and named in the UI, never assigned generic scores or inferred skills. Some
recorded hero entries currently contain only direct damage; those simulate only
that recorded damage, not unrecorded mechanics that may exist in the live game.
The source ability text is available on each selected card.

Implemented events include skill activation, normal hits, critical damage, extra
attacks, DoT, healing, shields, dodge, damage reduction, selected buff/debuff
effects and removal, supported Collection triggers, and four ordered Cryptid
attacks. All four unique Cryptids attack once at the start of rounds 1–4; their
unlock count enables the first one, two, or three recorded effects. Cryptid
timing follows the user's supplied rule; effect mapping follows published skill
text. This is partial buff/debuff coverage, not a complete model. No execute, revival, Plunder, unknown
proc chances, troop advantages, event passives, command scaling or enemy items
are silently approximated.

## Explicit scenario assumptions (not verified game formulas)

- One action per side per round. Player acts first. Command
  does not establish initiative because the source formula is missing.
- Every ready living hero rolls its documented trigger chance. The lowest slot
  among successes casts; Arthur has the priority stated in his text. The skill
  can activate again on later rounds. Normal attacks occur if none activates.
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
- Additive skill bonuses multiply the base damage; reductions are capped at 90%.
  Critical attacks multiply by their recorded critical increment and then by the
  allied critical-damage modifier. These multiplier/stacking assumptions need
  verification against real combat logs. No enemy defence is added to the default
  training target.
- Damage metrics count effective HP loss after shields and reductions; overkill
  is excluded. Damage per scheduled round divides by the selected fight length,
  including unused rounds after a kill. There is no invented seconds-per-round.
- Training target: no attacks, unlimited shared HP by default; victory percentage does
  not apply. An optional finite target group uses 1,000 placeholder HP per selected
  target (1, 5, 10, 20, or 30) in one shared pool. Each action damages that pool once;
  damage is never multiplied by enemy count, and the rear-most pool segments fall first.
  The public simulator exposes the training target only. Enemy artifacts and
  Collection are not modeled.

These rules produce real evolving combat state and emergent interactions, but
do not yet establish a validated replica of Pop Epoch's combat engine.

## Team search

Input: supported owned heroes, stars per hero, shared level, unlocked team slots,
owned exclusive artifacts, owned Collection items, and Cryptid order / skill unlocks.
The search runs against an unlimited-HP target with placeholder stats. Exclusive
artifacts are assigned to their owner when selected. The user marks Collection
ownership; the optimizer chooses the best six supported items (or all marked items
if fewer than six) for each candidate. It searches ordered teams and Collection
combinations jointly. Small spaces enumerate candidates within the fixed budget
of 500; larger searches use seeded sampling and mutations. No archetype is
prescribed.

Candidates are measured by simulated damage. Eight search finalists are reevaluated
on a separate set of 128 seeds;
the best three are shown. This reduces search-seed overfitting without proving a
global optimum. The deviation is the population standard deviation of damage,
not a confidence interval. The graph and event log show one validation-seed
replay, while headline metrics average all validation runs.

## Workbook baseline lineup

Source: user-supplied `Pop Epoch Calculator 9.29 (1).xlsx`, accessed 1 October
2026. The filename identifies the workbook as 9.29; it does not state a game
patch date. Baseline fields are taken from `Without Pics!B3:O86` and its lookup
tables. Rows were matched to the Core roster by hero identity; the “Mime Hero”
placeholder is omitted. The `Base Attack` sheet is player-specific and is not
used as a default. Eight heroes have no baseline ATK in the source and are
skipped until a user enters their own ATK. Source star color is only a starting
selection; it can be edited for the player's account.

The workbook's Value column uses `ATK × trigger chance × skill damage`. Trigger
chance by rarity is UR+/UR 40%, SSR 30%, SR 25%, R 20%. Base skill damage is
200%, 200%, 160%, 140%, or 120% respectively. The sheet increases skill damage
by 10 percentage points per star-color step above Green; the calculator derives
that multiplier from the selected color. The recommended lineup sorts individual
scores descending and takes the chosen number of unlocked hero slots. Ties sort
by hero name. This is a baseline comparison only: it is not total damage per
round and does not model critical hits, support skills, synergies, troop
matchups, items, Collection, goddesses, enemy defense, or multi-part damage.
Changing the entered ATK and star color does not change the data file or the
battle simulator's separate placeholder-stat assumptions.

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
four ordered Cryptid attacks, exhaustive joint team / Collection search, budgeted
search, unsupported data and manual-stat sensitivity.
tests/hero-team.test.mjs covers global production assignment, one-use constraints,
zero/fractional time, star gates and invalid input.
tests/hero-base-value.test.mjs covers source roster reconciliation, missing attack
values, the workbook formula, star-color boundaries, top-slot ranking, ties, and
invalid inputs.
After building, run `node --experimental-strip-types scripts/verify-hero-worker.mjs`
to execute the exported worker in an isolated JavaScript context and compare
its output with the source engine. This does not replace browser UI checks.

To expand fidelity, add verified stat curves, command/defence rules and complete
effect definitions with source dates and behavioral tests. Do not turn missing
effect data into a guessed coefficient. Update UI assumptions and this document
alongside any changed model rule.
