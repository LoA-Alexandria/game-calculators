# Hero team planner

The browser-only planner at /simulations/hero-team-planner/ uses the same versioned
data as the Heroes, Hero layouts and Collection guides. It requires no login.
Inventory and progression notes are saved only in browser localStorage.

## Sources and effective date

Model v1, reviewed 26 September 2026:

- [Heroes](https://loa-alexandria.github.io/game-calculators/guides/heroes/):
  lib/data/heroes.json, wiki roster and client screenshots, 13–18 September 2026.
- [Hero layouts](https://loa-alexandria.github.io/game-calculators/guides/hero-layouts/):
  lib/data/hero-layouts.json and guideEntries.heroLayouts (community guide).
- [Collection](https://loa-alexandria.github.io/game-calculators/guides/collection/):
  lib/data/collection.json and EXCLUSIVE_COLLECTION_HEROES; screenshots,
  16–18 September 2026.

The production source includes interpolated intermediate ability levels; see
lib/content/heroes.ts. These are not newly measured game values. No source
formulas or guide data are modified by the planner.

## Combat method and limitations

This is a transparent guide-matching heuristic, not a combat engine or a claim
of globally optimal gameplay. It returns four alternative profiles: Crit, DoT,
Pursuit and Execute. For each owned hero, the first matching guide tier gives
12 (key), 6 (important), or 2 (other) points. Unconfirmed conditional picks earn
no tier points. Each distinct documented utility role adds 1 point for Crit,
3 for DoT, or 2 for the other profiles. These are planner assumptions, not game
coefficients. Within each profile, descending individual scores give the exact
best subset under this additive objective. Equal scores use stable hero-id order.
Only positive-scoring heroes are recommended, so a team can have fewer members
than requested. Zero scores indicate insufficient modeled evidence, not weakness.

Each distinct equipped Collection recommended by the profile adds 3 points if
the team is nonempty. Explicit aliases connect guide nicknames to Collection ids;
David/Adam accepts either documented item. Unknown or duplicated ids cannot add
points. Exclusive-item checkboxes (or equipping the item in a Collection slot)
satisfy the guide's with-item requirements. No invented general artifact stat
boost is added. Other requirements (rarity, Nidhogg, age) remain unconfirmed and
are not inferred from the catalog or player level. Guide caveats are displayed.
The UI starts with three Collection slots but allows 0–25 as a planning control,
not a claim about unlocked in-game slots. Team size is 1–25 from the formation guide.
The result is a team membership recommendation, not a slot-order simulation.

## Production method

Select a target building and number of heroes. Only explicitly documented
production text matching that building or any building is used. At the selected
production ability level (default 1), individual productivity percentages rank
the heroes. A strict parser fails closed on missing or changed source text.
Bonuses are never summed; stacking, real building assignment limits, city-wide
buffs, resource prices, artifact effects and multi-building allocation are not
modeled. Ability levels are independent inputs, never derived from hero stars.

## Future progression data

OwnedHero reserves optional level and stars fields. They currently store player
notes only and have no effect on combat scoring. Unknown values remain undefined.
Production texts with explicit "Activates at N-Star" gates are respected:
known insufficient stars exclude the bonus; unknown stars show a conditional
recommendation with the required number. This is not a general star scaling model.
Adding base stats, star unlock mappings or level scaling requires explicit
versioned data, boundary tests and updated visible assumptions. Keep those
calculations separate from UI and from guide weights in lib/calculators/hero-team.ts.

## Verification

tests/hero-team.test.mjs covers all guide aliases, empty/invalid inputs, sizes
1 and 25, duplicate heroes/items, exclusive-item conditions, unknown prerequisites,
determinism, unknown production data, target filtering and ability-level boundaries.
Run pnpm lint, pnpm test and pnpm build, plus desktop/mobile browser checks.
