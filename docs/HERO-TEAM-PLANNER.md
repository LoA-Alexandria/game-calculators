# Hero battle simulator

The hero simulator builds and compares complete, turn-based battle scenarios from the player's entered inventory. It no longer presents a separate baseline-lineup ranking. The browser runs candidate search in a cancellable Web Worker with a reproducible random seed. Every reported replay is one explicit run; the summary averages separate runs and does not claim the game engine has been reproduced exactly.

## Source data

- [Hero guide](https://loa-alexandria.github.io/game-calculators/guides/heroes/): `lib/data/heroes.json` and user screenshots, recorded 13–18 September 2026. Names, rarity and recorded skill text come from Core.
- User-supplied `Pop Epoch Calculator 9.29 (1).xlsx`, accessed 1 October 2026. Workbook fields are read from `Without Pics!B3:O86` and its lookup tables. The filename identifies a 9.29 workbook, not its game-data effective date. Its “Base Attack” sheet is player-specific and is not used as a default. Eight roster entries have no baseline attack and start at zero until the player enters an ATK value.
- [Hero layouts](https://loa-alexandria.github.io/game-calculators/guides/hero-layouts/): Autumn's formation guide, August 2026 and September additions. Slot order and front-row count inform the simulation assumptions.
- [Collection guide](https://loa-alexandria.github.io/game-calculators/guides/collection/): `lib/data/collection.json` and screenshots dated 16–18 September 2026.
- [Cryptid guide](https://loa-alexandria.github.io/game-calculators/guides/cryptides/): `lib/data/cryptides.json` and skill descriptions/screenshots dated 16 September 2026.

## Inputs and outputs

The player marks owned heroes in a compact, multi-column single-line roster, chooses exclusive hero items in the same row, and enters one shared level. A single button selects the full roster; rarity and selected-only filters keep it quick to scan without a nested scrolling panel. Skill text and modeling status are available by hovering over a hero. There are no per-hero stars, ATK, or HP fields. Instead, every selected hero uses a fixed comparison profile: workbook ATK when present (5 when absent), workbook star-color order mapped to five-star skill gates, and 100,000 HP. This keeps setup short, but these are simulator defaults rather than account-specific combat stats. The shared level is retained in the scenario and result log; it does not scale combat stats because no verified level-to-stat curve is available.

The player can also set the opponent roster and damage reduction, mark owned Collection items, and choose owned Cryptids and their skill unlock level. Opponents use the same fixed comparison profile. The player always starts. A configured opponent team attacks once, after the player's action in round 1; it does not attack in later rounds. No Cryptid is manually assigned to a round: the optimizer compares every valid assignment of the selected Cryptids across rounds 1–4 and records the best schedule on the candidate. Each selected Cryptid acts once, at most one can act per round, and none act after round 4. Skill-level effect values and target behavior remain provisional because they still need in-game evidence. Hero and item rows stay compact; source skill/effect descriptions are shown on hover instead of requiring an expanded details panel.

Each round resolves in this order: the optimizer-scheduled Cryptid acts first (if any); then every living hero on the acting side rolls their recorded skill chance; the lowest numbered slot with a successful, unused skill performs that side's single hero action. A successful skill replaces that action's normal attack and is consumed for the rest of the battle. If no unused skill succeeds, the lowest living slot makes a normal attack. The player always acts first. An opponent team gets one action after the player's action in round 1 and no hero actions in later rounds. The player's hero action occurs every later round while both sides remain alive. Cryptids act separately from the hero action; the optimizer tests every valid placement of the selected Cryptids in rounds 1–4, with at most one per round and each used once. None act from round 5 onward. Cryptid, Collection, damage-over-time, and triggered follow-up effects can add effects or damage as part of those modeled mechanics, but they do not grant another normal hero action that round. The round log marks the single hero action and the separately scheduled Cryptid action, and includes every skill roll with its selection/eligibility result, casts, damage by actor and target, raw and effective damage, target HP before and after, buffs, debuffs, healing, shields, expiry, removal, and deaths. A log is one seeded replay; result metrics average separate runs. The search compares ordered teams, supported Collection choices, and Cryptid round assignments. Budget-limited searches do not prove a global optimum.

## Damage baseline

The workbook's Value column uses `ATK × trigger chance × skill damage`. Rarity defaults are UR+/UR 40%, SSR 30%, SR 25%, R 20%; direct skill multipliers are 200%, 200%, 160%, 140%, and 120%, respectively. The workbook adds 10 percentage points per star-color step above Green. These values are used as a direct-damage fallback only when an effect is not explicitly modeled. Where a hero's Core text has a parseable direct-damage trigger and coefficient, that recorded tier is used. Stars choose the latest tier with an explicit `Activates at N-Star` gate. The fallback does not imply that every hero has only a damage skill in the live game.

The Heroes guide currently records battle-skill tables for 37 heroes, based on German client screenshots; the runtime catalog has 38 skill records. The guide marks heroes without a skill table separately. `MODELED_HEROES` is the narrower list whose secondary battle effects are implemented in the engine. Other documented skills still use the direct-damage fallback where its trigger and coefficient can be read, but secondary effects are not simulated; the interface therefore says the effect is not modeled, rather than implying the source data is missing. The Collection guide contains descriptions for all catalogued items. `MODELED_ITEMS` remains the narrower set whose effects are implemented in the engine, and the interface now labels the rest as documented but not yet simulated.

## Assumptions that need in-game validation

- The player starts every round; an opponent team acts once after the player in round 1 only. Every living hero rolls each acting round; the lowest slot with a successful, unused skill performs the one hero action. If none qualifies, the lowest living slot performs a normal attack. Skills are consumed on success for the rest of the fight. This cadence is based on the user's stated combat rules; skill chances and effect values remain source-data assumptions.
- The no-input comparison profile uses workbook ATK where present, falls back to ATK 5 when absent, maps each workbook star-color step to the next five-star skill gate, and gives every hero 100,000 HP. This is a convenience profile for comparing combinations; it is not a prediction of account-specific combat stats. The star-color-to-skill-gate mapping is an assumption.
- Cryptids are staggered, not simultaneous: the optimizer assigns each selected Cryptid to one distinct round among rounds 1–4; at most one acts in a round and none act after round 4. The one-time limit is the user's explicit rule; skill-level effect values and target behavior still need evidence.
- Incoming damage is allocated from the highest formation slot down and spills over. Healing fills the most wounded living heroes first and cannot revive. Shields are a side-wide pool. The training target does not attack. A finite training pool has 1,000 placeholder HP per selected target; attacks hit one shared pool and are not multiplied by target count.
- Buff durations use the affected side's action clock. DoT ticks three times on that side's next actions. DoT applications stack and snapshot attack at application. Independent sources of a stat effect coexist. These timing and stacking rules require validation.
- Additive skill bonuses multiply base damage; damage reduction is capped at 90%; critical multipliers use the recorded increment and then the allied critical-damage modifier. Damage metrics use effective HP loss after shields/reduction and exclude overkill. Damage per scheduled round divides by configured fight length, including turns after a kill.

## Known gaps

The simulator is intentionally explicit about these missing or incomplete data sets; it does not fill them with guessed effects:

- Verified hero ATK/HP curves by level, and reliable account-specific combat stats where the workbook baseline is insufficient.
- Complete ability levels, proc conditions/chances, target rules, damage components and interaction details for every hero. Core descriptions and the workbook do not provide every underlying rule.
- Opponent defense, troop matchups, enemy Collection and other combat modifiers.
- Goddess ownership and all Goddess bonuses in the battle model.
- Verified Cryptid target rules and each skill-level effect; the optimizer searches assignments only within the user's specified rounds 1–4 and one-use limit.
- Complete Collection trigger rules and durations for items outside the modeled set.
- Game-accurate turn timing, initiative, target selection, effects that trigger on hit/death, revive/execute mechanics and complete buff/debuff stacking/removal.

The missing data should be filled from dated screenshots, reliable game logs or other documented sources. Update the corresponding behavior tests and this file whenever a rule changes.

## Verification

`tests/hero-battle.test.mjs` covers the deterministic random generator, skill tiers, hero action/damage logs, HP loss/death order, DoT, healing/shields, modeled Collection and Cryptid interactions, search limits, unsupported inputs and manual-stat sensitivity. `tests/hero-base-value.test.mjs` protects the workbook baseline calculations and source roster reconciliation. After building, run `node --experimental-strip-types scripts/verify-hero-worker.mjs` to compare the exported Worker with the source engine; it does not replace desktop and narrow-screen browser checks.
