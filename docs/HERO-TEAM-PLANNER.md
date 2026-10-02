# Hero battle simulator

The hero simulator builds and compares complete, turn-based battle scenarios from the player's entered inventory. It no longer presents a separate baseline-lineup ranking. The browser runs candidate search in a cancellable Web Worker with a reproducible random seed. Every reported replay is one explicit run; the summary averages separate runs and does not claim the game engine has been reproduced exactly.

## Source data

- [Hero guide](https://loa-alexandria.github.io/game-calculators/guides/heroes/): `lib/data/heroes.json` and user screenshots, recorded 13–18 September 2026. Names, rarity and recorded skill text come from Core.
- User-supplied `Pop Epoch Calculator 9.29 (1).xlsx`, accessed 1 October 2026. Workbook fields are read from `Without Pics!B3:O86` and its lookup tables. The filename identifies a 9.29 workbook, not its game-data effective date. Its “Base Attack” sheet is player-specific and is not used as a default. Eight roster entries have no baseline attack and start at zero until the player enters an ATK value.
- [Hero layouts](https://loa-alexandria.github.io/game-calculators/guides/hero-layouts/): Autumn's formation guide, August 2026 and September additions. Slot order and front-row count inform the simulation assumptions.
- [Collection guide](https://loa-alexandria.github.io/game-calculators/guides/collection/): `lib/data/collection.json` and screenshots dated 16–18 September 2026.
- [Cryptid guide](https://loa-alexandria.github.io/game-calculators/guides/cryptides/): `lib/data/cryptides.json` and skill descriptions/screenshots dated 16 September 2026.

## Inputs and outputs

The player marks owned heroes in a compact roster, sets each hero's stars, ATK, Max HP and exclusive item, and enters one shared level. The level is retained in the scenario and result log; it does not scale combat stats because no verified level-to-stat curve is available. Workbook ATK is a starting value that can be edited. The simulator requires positive Max HP for every selected fighter rather than silently inventing it.

The player can also set the opponent roster, opponent damage reduction and initiative, mark owned Collection items, and choose owned Cryptids and their skill unlock level. No Cryptid is manually assigned to a round. The interface assigns them automatically in Core-list order; this is a provisional assumption, not a verified in-game schedule.

For each candidate formation, every living hero gets an action each round in formation order. The simulator rolls that hero's skill trigger chance; a successful skill replaces that hero's normal attack. The opposing side then acts according to the initiative setting. The event log records skill rolls, casts, damage by attacker and target, raw and effective damage, target HP before and after, and modeled buffs, debuffs, healing, shields, expiry, removal, deaths, and Cryptid/Collection actions. A log is one seeded replay; result cards average multiple seeded runs. The search compares ordered teams and supported Collection choices. Budget-limited searches do not prove a global optimum.

## Damage baseline

The workbook's Value column uses `ATK × trigger chance × skill damage`. Rarity defaults are UR+/UR 40%, SSR 30%, SR 25%, R 20%; direct skill multipliers are 200%, 200%, 160%, 140%, and 120%, respectively. The workbook adds 10 percentage points per star-color step above Green. These values are used as a direct-damage fallback only when an effect is not explicitly modeled. Where a hero's Core text has a parseable direct-damage trigger and coefficient, that recorded tier is used. Stars choose the latest tier with an explicit `Activates at N-Star` gate. The fallback does not imply that every hero has only a damage skill in the live game.

Specialized secondary effects are currently implemented for the 27 hero IDs in `MODELED_HEROES`; effects for other heroes resolve only the available direct-damage model and are named in the UI as base-skill-only. `MODELED_ITEMS` in `hero-battle.ts` lists the Collection and exclusive items whose effects are implemented. Other checked inventory remains visible as unsupported and is excluded from the optimizer until its behavior is sourced and modeled.

## Assumptions that need in-game validation

- Each living hero acts once per side's turn, in the current formation order. A skill roll is performed per hero; success replaces that hero's basic attack. This action cadence is an implementation assumption based on the per-hero workbook values and the requested detailed log, not a confirmed combat rule.
- A selected Cryptid fires at the start of round 1, 2, 3, or 4 according to Core list order. Its skill level unlocks the first one, two, or three effects recorded in the guide. Actual timing and unlock behavior still need evidence.
- Incoming damage is allocated from the highest formation slot down and spills over. Healing fills the most wounded living heroes first and cannot revive. Shields are a side-wide pool. The training target does not attack. A finite training pool has 1,000 placeholder HP per selected target; attacks hit one shared pool and are not multiplied by target count.
- Buff durations use the affected side's action clock. DoT ticks three times on that side's next actions. DoT applications stack and snapshot attack at application. Independent sources of a stat effect coexist. These timing and stacking rules require validation.
- Additive skill bonuses multiply base damage; damage reduction is capped at 90%; critical multipliers use the recorded increment and then the allied critical-damage modifier. Damage metrics use effective HP loss after shields/reduction and exclude overkill. Damage per scheduled round divides by configured fight length, including turns after a kill.

## Known gaps

The simulator is intentionally explicit about these missing or incomplete data sets; it does not fill them with guessed effects:

- Verified hero ATK/HP curves by level, and reliable account-specific combat stats where the workbook baseline is insufficient.
- Complete ability levels, proc conditions/chances, target rules, damage components and interaction details for every hero. Core descriptions and the workbook do not provide every underlying rule.
- Opponent defense, troop matchups, enemy Collection and other combat modifiers.
- Goddess ownership and all Goddess bonuses in the battle model.
- Verified Cryptid action timing, target rules and each skill-level effect.
- Complete Collection trigger rules and durations for items outside the modeled set.
- Game-accurate turn timing, initiative, target selection, effects that trigger on hit/death, revive/execute mechanics and complete buff/debuff stacking/removal.

The missing data should be filled from dated screenshots, reliable game logs or other documented sources. Update the corresponding behavior tests and this file whenever a rule changes.

## Verification

`tests/hero-battle.test.mjs` covers the deterministic random generator, skill tiers, hero action/damage logs, HP loss/death order, DoT, healing/shields, modeled Collection and Cryptid interactions, search limits, unsupported inputs and manual-stat sensitivity. `tests/hero-base-value.test.mjs` protects the workbook baseline calculations and source roster reconciliation. After building, run `node --experimental-strip-types scripts/verify-hero-worker.mjs` to compare the exported Worker with the source engine; it does not replace desktop and narrow-screen browser checks.
