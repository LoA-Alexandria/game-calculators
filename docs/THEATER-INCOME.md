# Goddess Theater income and run projection

The calculator combines two related estimates: income for one selected play
and the Red Carpet points a theater run can earn from starting energy.

## Sources and effective date

- Play names, rarity, and roles: the [Goddess Theater guide](https://loa-alexandria.github.io/game-calculators/guides/goddess-theater/), checked 27 September 2026.
- Preview ticket and audience values: the player's in-game screenshots supplied on 25–27 September 2026. 21 of the 30 plays currently have both values; the remaining entries stay blank until evidence is supplied.
- Building unlock levels, rarity odds, and energy costs: the player's in-game screenshots and confirmations supplied on 27 September 2026. Royal and Civic each use SSR 40% and UR 10%, as confirmed by the player.
- Red Carpet conversion and income formula: Autumn's (Ice, S12) in-game tests from 20–21 August 2026, encoded in `lib/calculators/theater-income.ts` and checked in `tests/theater-income.test.mjs`.

## Run projection

The player's theater level selects a building stage and its tier, parallel
theater slots, goddess slots, and offer distribution:

| Building | Theater level | Parallel theaters | Goddess slots | R / SR / SSR / UR / UR+ |
| --- | ---: | ---: | ---: | --- |
| Parade Wagon | 1–2 | 1 | 1 | 80 / 20 / 0 / 0 / 0 % |
| Open-Air Theater | 3–14 | 2 | 2 | 40 / 50 / 10 / 0 / 0 % |
| Art Theater | 15–26 | 3 | 3 | 20 / 35 / 35 / 10 / 0 % |
| Royal Theater | 27–39 | 4 | 4 | 10 / 30 / 40 / 10 / 10 % |
| Civic Theater | 40+ | 5 | 5 | 5 / 25 / 40 / 10 / 20 % |

Parade's one parallel theater is inferred from its single goddess slot. Civic's
five goddess slots are inferred from its five parallel theaters and the five
roles shown for UR+ plays. Both should be corrected if the game shows otherwise.
For an active building, tier is its level minus the building's first level,
plus one.

Each script costs R 30, SR 60, SSR 160, UR 300, or UR+ 600 energy. Each lipstick
adds 5 energy to one selected theater slot. The calculator models three
independent rarity offers with replacement at each decision, then selects the
affordable offer that maximizes expected remaining points. It calculates the
expected number of completed scripts and the minimum and maximum points under
that same selection policy.

The calculator has two display modes to save space. **Single** is the existing
per-play Muse Coin calculator, including the play selector, goddess ownership,
and comparison tables. **Mass** shows the energy and lipstick run projection
only. It uses theater stats, entered play previews, and goddess ownership from
Single; switch back to edit those inputs. The lipstick input accepts 0–10,000
lipsticks so values such as 2,400 are valid; starting energy remains 0–5,000 per
slot.

Reward per rarity is the mean of the available plays of that rarity for the
player's current upgrade stats and selected goddesses. Goddess deployment is
limited to the number of slots unlocked by the building. Each play's Red Carpet
range is the existing 83–85% Muse Coin formula, rounded down to whole hundreds;
the projection uses its midpoint as the expected reward. Since only some play
previews have been recorded, the projection is partial: unknown plays are
omitted, and a rarity with no usable preview data contributes zero points. It
is not a complete ranking of every possible script until the remaining preview
values are collected.

## Existing income formula

Ticket price and audience are independently floored after applying upgrades
and the rehearsal event. Ticket and merchandise income are then computed from
those values and the deployed-goddess Muse Coin bonus. Red Carpet points remain
83–85% of Muse Coins divided by 1,000, rounded down to whole hundreds.

The three checked performances and the boundary cases are in
`tests/theater-income.test.mjs`; building boundaries, probability totals,
energy costs, offer selection, lipstick assignment, and projection ranges are
in `tests/theater-session.test.mjs`.
