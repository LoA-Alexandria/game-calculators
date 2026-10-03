# Hero stat baselines

`lib/calculators/hero-stat-baselines.json` is the roster-wide catalog for
workbook base attack values, recorded level-panel observations, and the
experimental held-ANG estimate. It is separate from skill damage coefficients
in the battle calculator. Each Core Heroes profile displays its Basic stats
under “In other guides”; no separate roster page is used.

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

## Held-stat observations

`heldStatObservations` contains the values shown in the user-supplied hero
panels, with level, before/after ascension state, and visible precision retained.
K/M values are stored as their displayed approximate point value; they are not
presented as exact integers. The source and effective date are recorded in the
catalog. Guan Yu's 77.07K reading is level 150 after ascension; the 77.98K /
853.1K reading is level 151, as confirmed by the user.

Each profile shows its level-one held ANG estimate, level-one LP when a direct
reading exists, and expandable observed readings. LP is shown only at observed
levels; there is no supported roster-wide LP formula, so level-one LP is not
inferred.

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
