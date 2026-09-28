# Goddess Theater income and run projection

The calculator combines two related estimates: income for one selected play
and the Red Carpet points a theater run can earn from starting energy.

## Sources and effective date

- Play names, rarity, and roles: the [Goddess Theater guide](https://loa-alexandria.github.io/game-calculators/guides/goddess-theater/), checked 27 September 2026.
- Preview ticket and audience values: the player's in-game screenshots supplied on 25–27 September 2026. 23 of the 30 plays currently have both values; the remaining entries stay blank until evidence is supplied.
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

Rarity percentages are per offered script, not the chance that at least one of
the three offered scripts has that rarity. At level 39, for example, R has a
10% chance per offer and SR 30%; assuming three independent draws with
replacement, that is a 27.1% chance to see at least one R and a 65.7% chance to
see at least one SR in a menu. These menu chances do not mean the calculator
will select that rarity: it chooses among affordable offers to maximize
expected Red Carpet points for the remaining energy.

Parade's one parallel theater is inferred from its single goddess slot. Civic's
five goddess slots are inferred from its five parallel theaters and the five
roles shown for UR+ plays. Both should be corrected if the game shows otherwise.
For an active building, tier is its level minus the building's first level,
plus one.

Each script costs R 30, SR 60, SSR 160, UR 300, or UR+ 600 energy. Each lipstick
adds 5 energy to one selected theater slot. The selected starting script in
each slot is counted first and its energy cost is deducted. Every simulation
round then draws three independent rarity offers with replacement for each
decision and selects an affordable play with the strongest expected total for
the remaining energy.

The calculator has two display modes to save space. **Single** is the existing
per-play Muse Coin calculator and comparison tables. Its “All plays” tables
also show each rarity's energy cost, Muse Coins per energy, and the existing
Red Carpet range per energy. Each efficiency value is the matching total or
Red Carpet range divided by the rarity's energy cost. **Mass** exposes theater
stats, owned goddesses, energy, lipsticks, and a starting play for every active
slot, so the run can be set up without switching modes. Each starting play is
counted exactly once before later offer choices and its energy cost is deducted
from that slot. Enter 1–1,000 simulation rounds (default 250); the lipstick
input accepts 0–10,000 lipsticks and starting energy remains 0–5,000 per slot.

Reward per rarity is the mean of the available plays of that rarity for the
player's current upgrade stats and selected goddesses. Mass mode always
auto-assigns the best owned goddesses to each play, limited to the goddess slots
unlocked by the building. A manual bonus override from Single does not alter
this auto-assignment. Each play's Red Carpet range is the existing 83–85% Muse
Coin formula, rounded down to whole hundreds.

The Mass simulation runs only after the player presses **Run simulation**.
Changing an input clears the previous result; press the button again to calculate
with the updated settings. The calculation runs locally in the browser.

Each simulation round independently draws three rarity offers, then chooses an
affordable known play using its average Red Carpet value plus the expected value
of the energy left for that slot. When a rarity is offered, its concrete play
is sampled uniformly from the recorded previews for that rarity; missing
previews are omitted. The selected play's best owned goddesses are assigned
automatically. The summary reports the lowest observed result, arithmetic mean,
and highest observed result among the requested rounds. The log shows every
performance from those three representative runs; the average log is the run
nearest the arithmetic mean. Results use a seed derived from the settings, so
they are reproducible for the same inputs. Each run's points sum the midpoint
of each play's existing Red Carpet range; coin income and the low–high Red
Carpet range are shown per line. These are Monte Carlo observations, not
theoretical absolute limits. Since only some play previews are recorded,
unknown plays are omitted; a rarity with no usable preview cannot be selected.

## Existing income formula

Ticket price and audience are independently floored after applying upgrades
and the rehearsal event. Ticket and merchandise income are then computed from
those values and the deployed-goddess Muse Coin bonus. Red Carpet points remain
83–85% of Muse Coins divided by 1,000, rounded down to whole hundreds.

The three checked performances and the boundary cases are in
`tests/theater-income.test.mjs`; building boundaries, probability totals,
energy costs, lipstick assignment, deterministic Monte Carlo outputs, and
complete representative-run logs are in `tests/theater-session.test.mjs`.
