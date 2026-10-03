# Hero stat baselines

`lib/data/hero-stat-baselines.json` is the roster-wide catalog for hero base
attack and observed level-stat contributions. It is separate from skill damage
coefficients in the battle calculator.

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

## Held stat observations

`heldStatObservations` records the `Held` contribution shown in the user's
HeroSkale screenshots and later level readings. ANG and LP are kept separate
from the workbook's combat base attack. Level 20 has pre- and post-enlightenment
rows; level 50 has a separate post-ascension row. Values shown in K in the game
are approximate transcriptions at the displayed precision. Each roster entry's
`heldStatScalingStatus` tells whether it has a reference fit, a partial check,
only a starting value, or no observations yet.

The working ANG curve uses Guan Yu as its reference:

`ANG ≈ 568.14796841 + 45.84547224 × level + 2.85203883 × level²`

The curve fits the available reference observations after excluding the
unconfirmed level-43 value. The reported value is preserved as 8,313; 8,213
would fit the curve, but has not been confirmed. The screenshots show an
additional +400 ANG / +4,000 LP at enlightenment on level 20 and another +1,600
ANG / +16,000 LP at the level-50 ascension. These are observed for Guan Yu.

Lü Bu's level-10 and level-15 ANG values are close to the Guan Yu curve scaled
by their level-1 ANG ratio (587 / 616). This is a promising hypothesis, not a
validated formula for every hero. Musashi currently has only a level-1 value.
There is not enough evidence to publish an LP curve for other heroes or a
roster-wide scaling rule. Coefficients are a least-squares approximation of
rounded data, not a confirmed game formula.

Sources: user-provided `HeroSkale` screenshots captured 2026-10-03 and user
transcriptions in this conversation. The source images are not copied into the
repository.
