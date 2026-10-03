# Hero stat baselines

`lib/calculators/hero-stat-baselines.json` is the roster-wide catalog for
workbook base attack values, recorded level-panel observations, and the
experimental held-ANG estimate. It is separate from skill damage coefficients
in the battle calculator. Each Core Heroes profile has a separate “Basic” tab
in the profile navigation; no separate roster page is used.

## Base attack source

The `combatBaseAttack` field is transcribed from the `Base Attack` sheet,
columns `Hero` through `Base ATK`, in `Pop Epoch Calculator 9.29 (1).xlsx`
(file modified 2026-10-01). The workbook describes these as the very base hero
value without personal bonuses and records Green, 1-star values. Its effective
game version is not stated. The original workbook is not vendored into this
repository.

Workbook labels that clearly differ from the site roster are mapped to the
matching hero name (for example, `Charlemagne` to `Charles the Great`). The
possible `Anderson` / `Andersen` match is left unresolved. Source blanks and
heroes absent from the sheet remain `null`; skill coefficients are not used as
base stats. The workbook has no LP column, so `combatBaseLp` is explicitly
`null` for every hero rather than inferred from attack.

## Chat-derived level-one stats

`heldStatObservations` contains the values shown in the user-supplied hero
panels, with level, before/after ascension state, and visible precision retained.
K/M values are stored as their displayed approximate point value; they are not
presented as exact integers. The source and effective date are recorded in the
catalog. Guan Yu's 77.07K reading is level 150 after ascension; the 77.98K /
853.1K reading is level 151, as confirmed by the user.

The Basic tab uses the hero values supplied in chat, not the workbook table.
For each hero with a level reading, it scales the reading back to a level-one
ANG and LP value, subtracting the known enlightenment and ascension bonuses
first. The UI prefixes formula-derived values with `≈` and shows direct
level-one readings without the prefix.

The Basic tab also accepts a target level from 1 to 500 and calculates ANG and
LP at that level from the level-one values. It uses the same integer ANG
reference curve for both stats, rounds the scaled stat to a whole point, then
adds the known milestone bonus. Bonuses from earlier milestones are included;
at the exact milestone level, a checkbox controls whether that level's
ascension has been completed. Values derived from estimated level-one stats
remain marked with `≈`.

The star-level selector accepts 0 to 13 levels; each star level represents five
hero levels. Each star level adds a fixed rarity-based bonus to both ANG and LP:
UR+/UR 15%, SSR 12%, SR 8%, and R 5%. The total bonus is the selected star level
multiplied by the hero's per-level rarity bonus. Both selected-level stats are
multiplied by `1 + total bonus` and rounded to a whole point.
The maximum selectable star level is `floor(hero level / 5)`, capped at 13.
These user-reported rates and the five-level progression were supplied on
3 October 2026 and remain provisional until confirmed in game.

LP has its own per-hero level-one base, but uses the same level-growth
multiplier as the existing integer ANG reference curve. This is a fitted
cross-stat assumption, not a confirmed game formula. It is checked against 61
Guan Yu LP readings through level 151: the largest absolute residual is 271
points, and the largest relative residual is 0.55% (at a rounded level-24
reading). Multiple samples for one hero are combined by their median
level-one estimate. Heroes without a chat LP reading remain blank.

## Experimental held-ANG estimate

The reference curve begins with Guan Yu's observed level-one held ANG of 616.
It uses whole-number increments:

```text
reference ANG at level 1 = 616
for each step k from 1 to target level − 1:
    add floor((985 + 114 × k) / 20)
```

Observed milestone additions are kept separate: +400 at level 20, +1,600 at
50, +1,500 at 100, +1,920 at 150, +2,400 at 200, and +9,000 at 300. The next
reported milestone is level 500; no level-250 ascension is used. The level-300
bonus is confirmed from one supplied Queen Victoria reading only and is assumed
to apply to other heroes for the provisional estimates.

For a hero with a reading, the estimated level-one held ANG is:

```text
(observed ANG − milestone additions) × 616 / reference ANG at observed level
```

This assumes other heroes scale proportionally to the Guan Yu reference. Lü Bu
and Morgana level-10/15 readings support the idea at low levels; high-level
estimates rely on extrapolation and remain experimental. They are labeled as
estimates, never as verified hero base attack. They are not a confirmed game
formula. Guan Yu's reported level-43 ANG of 8,313 is retained but excluded from
the fit; a possible correction to 8,213 is unconfirmed.

Sources: user-provided `HeroSkale` screenshots and hero-panel transcriptions,
captured or reported in this conversation on 2026-10-03. The source images are
not copied into the repository.
