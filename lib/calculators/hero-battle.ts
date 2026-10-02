import { HEROES } from "../content/heroes.ts";
import { COLLECTION_ITEMS, EXCLUSIVE_COLLECTION_HEROES } from "../content/collection.ts";
import { CRYPTIDES } from "../content/cryptides.ts";
import { FORMATION_COLUMNS } from "../content/hero-layouts.ts";
import { baseValueSource } from "./hero-base-value.ts";

export type Fighter = { id: string; atk: number; hp: number; stars: number; level?: number };
export type CryptidSelection = { id: string; skills: 1 | 2 | 3 };
export type BattleOptions = { rounds: number; seed: number; trials: number; budget: number; size: number; enemyCount?: 1 | 5 | 10 | 20 | 30; infiniteDummy?: boolean; objective: "damage" | "wins"; enemy: Fighter[]; dummy: boolean; enemyReduction: number; items: string[]; collection: string[]; collectionSlots?: number; cryptides?: (CryptidSelection | null)[] };
export type BattleEvent = { round: number; side: number; actor: string; target?: string; action: string; amount: number; raw?: number; hpBefore?: number; hpAfter?: number; effectKey?: string; duration?: number; chance?: number; succeeded?: boolean; eligible?: boolean; selected?: boolean; allyHp: number; enemyHp: number };
export type BattleResult = { damage: number; healing: number; absorbed: number; alive: number; remaining: number; win: boolean; rounds: number; events: BattleEvent[]; timeline: { round: number; damage: number; allyHp: number; enemyHp: number }[] };
export type Candidate = { team: Fighter[]; collection: string[]; cryptides: (CryptidSelection | null)[]; damage: number; healing: number; winRate: number; remaining: number; deviation: number };
export type SearchResult = { candidates: Candidate[]; evaluated: number; exhaustive: boolean; validationTrials: number; trace: BattleResult };

// Only skills whose complete recorded level text can be translated into effects.
// Missing skill text never becomes an invented generic damage coefficient.
export const MODELED_HEROES = new Set([
  "hermes", "merlin", "heracles", "lancelot", "king-arthur", "odysseus",
  "bjorn-ironside", "lagertha", "pompey", "caesar", "cleopatra",
  "charles-the-great", "achilles", "william-shakespeare", "tutankhamun",
  "da-vinci", "alexander-the-great", "augustus",
  "guinevere", "garwain", "queen-victoria", "napoleon-bonaparte",
  "isaac-newton", "blackbeard", "hammurabi", "socrates", "gilgamesh",
]);
export const MODELED_ITEMS = new Set([
  "winged-sandals", "divine-greaves", "mona-lisa", "eagle-scepter",
  "golden-throne", "aeolus-bag-of-winds", "nemean-lion-pelt",
  "prometheus-torch", "holy-hand-grenade", "notre-dame-de-paris-replica",
  "the-creation-of-adam", "scarab-amulet", "heimdalls-horn",
  "model-of-the-minotaurs-labyrinth", "plague-doctor-mask",
  "decameron-manuscript", "dead-sea-scrolls", "brutus-dagger",
  "golden-mask-of-agamemnon", "david", "model-of-noahs-ark",
  "flintstone-pedal-car", "thors-hammer", "wings-of-icarus",
  "olympia-olive-wreath", "pandoras-box", "trojan-horse",
  "otzis-copper-axe", "discobolus", "cross-of-lorraine-flag",
  "galileos-telescope",
]);
const heroMap = new Map(HEROES.map((hero) => [hero.id, hero]));
const itemMap = new Map(COLLECTION_ITEMS.map((item) => [item.id, item]));
const percentages = (text: string) => [...text.matchAll(/(\d+(?:\.\d+)?)%/g)].map((match) => Number(match[1]) / 100);
export function skillFor(fighter: Fighter) {
  const source = heroMap.get(fighter.id)?.skill;
  if (!source || !MODELED_HEROES.has(fighter.id)) {
    const hero = heroMap.get(fighter.id);
    const baseline = baseValueSource(fighter.id);
    if (!hero) return null;
    if (source) {
      let index = 0;
      source.levels.forEach((text, i) => { const gate = text.match(/^Activates at (\d+)-Star\./); if (gate && fighter.stars >= Number(gate[1])) index = i; });
      const text = source.levels[index];
      const values = percentages(text);
      if (/\bchance to activate\b/i.test(text) && values.length >= 2 && values[0] > 0 && values[0] <= 1 && values[1] > 1) {
        return { text, level: index + 1, chance: values[0], coefficient: values[1], values, source: "hero-skill-direct" as const };
      }
    }
    const chance: Record<string, number> = { "UR+": .4, UR: .4, SSR: .3, SR: .25, R: .2 };
    const baseDamage: Record<string, number> = { "UR+": 2, UR: 2, SSR: 1.6, SR: 1.4, R: 1.2 };
    const proc = chance[hero.rarity], coefficient = baseDamage[hero.rarity] + ((baseline?.starColor ?? 1) - 1) * .1;
    return proc && coefficient > 0 ? { text: "Workbook baseline direct-damage fallback; secondary effects are not modeled.", level: 0, chance: proc, coefficient, values: [proc, coefficient], source: "workbook-fallback" as const } : null;
  }
  let index = 0;
  source.levels.forEach((text, i) => {
    const gate = text.match(/^Activates at (\d+)-Star\./);
    if (gate && fighter.stars >= Number(gate[1])) index = i;
  });
  const text = source.levels[index];
  const values = percentages(text);
  if (values.length < 2) return null;
  return { text, level: index + 1, chance: values[0], coefficient: values[1], values, source: "hero-skill" as const };
}
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
type Effect = { key: string; source: string; value: number; expires: number; ticks?: number };
type Unit = Fighter & { health: number };
type Side = { units: Unit[]; max: number; shield: number; effects: Effect[]; items: Set<string>; damage: number; healing: number; absorbed: number; actions: number; nextUnit: number; usedSkills: Set<string>; labyrinth: boolean; dotTaken: number; pedalCarTriggered: boolean; pedalCarShield: boolean; hammerTriggered: boolean; wingsTriggered: boolean; skillsUsed: number };
const totalHp = (side: Side) => side.units.reduce((sum, unit) => sum + unit.health, 0);
const living = (side: Side) => side.units.filter((unit) => unit.health > 0);
const effect = (side: Side, key: string) => side.effects.filter((entry) => entry.key === key).reduce((sum, entry) => sum + entry.value, 0);
const buffs = new Set(["dodge", "break", "crit", "skill", "reduction", "barrier", "dotHeal", "counterHeal", "atk", "extra", "frontForce", "reflect", "cryptidHeal", "skillReductionDown", "damageCap"]);
const debuffs = new Set(["dot", "skillDown", "replace", "atkDown", "reductionDown"]);

export function validateBattle(pool: Fighter[], options: BattleOptions) {
  const whole = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
  if (!whole(options.rounds, 1, 100) || !whole(options.size, 1, 25) || (options.enemyCount !== undefined && ![1, 5, 10, 20, 30].includes(options.enemyCount)) || (options.infiniteDummy !== undefined && typeof options.infiniteDummy !== "boolean") || (options.collectionSlots !== undefined && !whole(options.collectionSlots, 0, 6)) || !whole(options.seed, 0, 2147483647) || !whole(options.trials, 1, 128) || !whole(options.budget, 1, 1000)) throw new RangeError("settings");
  if (!["damage", "wins"].includes(options.objective) || !Number.isFinite(options.enemyReduction) || options.enemyReduction < 0 || options.enemyReduction > .9) throw new RangeError("settings");
  const validateTeam = (team: Fighter[], dummy = false) => {
    if (!team.length || team.length > 82 || new Set(team.map((unit) => unit.id)).size !== team.length) throw new RangeError("team");
    for (const unit of team) {
      if ((!dummy && !skillFor(unit)) || !Number.isFinite(unit.atk) || unit.atk < 0 || unit.atk > 1e9 || !Number.isFinite(unit.hp) || unit.hp <= 0 || unit.hp > 1e12 || !whole(unit.stars, 0, 1000)) throw new RangeError("fighter");
    }
  };
  validateTeam(pool);
  const cryptides = options.cryptides ?? [];
  const selectedCryptides = cryptides.filter((entry): entry is CryptidSelection => entry !== null);
  if (cryptides.length > 4 || new Set(selectedCryptides.map((entry) => entry.id)).size !== selectedCryptides.length || selectedCryptides.some((entry) => !CRYPTIDES.some((cryptide) => cryptide.id === entry.id) || !whole(entry.skills, 1, 3))) throw new RangeError("cryptides");
  if (pool.length < options.size) throw new RangeError("size");
  if (!options.dummy) { validateTeam(options.enemy); if (options.enemy.length > 25) throw new RangeError("enemy"); }
  if (new Set(options.items).size !== options.items.length || options.items.some((id) => !MODELED_ITEMS.has(id) || !EXCLUSIVE_COLLECTION_HEROES[id]) || new Set(options.collection).size !== options.collection.length || options.collection.some((id) => !MODELED_ITEMS.has(id) || EXCLUSIVE_COLLECTION_HEROES[id]) || options.collection.length > 25) throw new RangeError("items");
}

/** Event simulation with an explicit scenario model; see HERO-TEAM-PLANNER.md. */
export function simulateBattle(team: Fighter[], options: BattleOptions, seed = options.seed, record = false): BattleResult {
  const random = seededRandom(seed);
  const make = (units: Fighter[], items: string[]): Side => ({ units: units.map((unit) => ({ ...unit, health: unit.hp })), max: units.reduce((sum, unit) => sum + unit.hp, 0), shield: 0, effects: [], items: new Set(items), damage: 0, healing: 0, absorbed: 0, actions: 0, nextUnit: 0, usedSkills: new Set(), labyrinth: false, dotTaken: 0, pedalCarTriggered: false, pedalCarShield: false, hammerTriggered: false, wingsTriggered: false, skillsUsed: 0 });
  const owned = options.items.filter((id) => team.some((unit) => unit.id === EXCLUSIVE_COLLECTION_HEROES[id]));
  const targets = options.infiniteDummy === false
    ? Array.from({ length: options.enemyCount ?? 1 }, (_, index) => ({ id: "target-" + (index + 1), atk: 0, hp: 1000, stars: 0 }))
    : [{ id: "dummy", atk: 0, hp: 1e15, stars: 0 }];
  const sides = [make(team, [...owned, ...options.collection]), make(options.dummy ? targets : options.enemy, [])];
  const events: BattleEvent[] = [];
  const timeline: BattleResult["timeline"] = [];
  let round = 0;
  let actor = "";
  const log = (side: number, action: string, amount: number, detail: Partial<BattleEvent> = {}) => { if (record) events.push({ round, side, actor, action, amount, ...detail, allyHp: totalHp(sides[0]), enemyHp: totalHp(sides[1]) }); };
  const add = (side: Side, key: string, value: number, turns: number, stack = false, source = actor) => {
    if (!stack) side.effects = side.effects.filter((entry) => entry.key !== key || entry.source !== source);
    if (value) {
      let duration = turns;
      let triggerChance = 0;
      if (side === sides[0] && key !== "seal" && side.items.has("galileos-telescope")) triggerChance = item(side, "galileos-telescope");
      if (side === sides[1] && debuffs.has(key) && sides[0].items.has("discobolus")) triggerChance = item(sides[0], "discobolus");
      const extended = triggerChance > 0 && random() < triggerChance;
      if (extended) duration += 2;
      side.effects.push({ key, source, value, expires: side.actions + duration });
      log(side === sides[0] ? 0 : 1, debuffs.has(key) || key === "seal" ? "debuff" : "buff", value, { actor: source, target: side === sides[0] ? "allies" : "enemies", effectKey: key, duration, chance: triggerChance || undefined, succeeded: triggerChance ? extended : undefined });
    }
  };
  const addDot = (side: Side, value: number) => {
    const chance = side === sides[1] && sides[0].items.has("discobolus") ? item(sides[0], "discobolus") : 0;
    const extended = chance > 0 && random() < chance;
    const duration = extended ? 5 : 3;
    side.effects.push({ key: "dot", source: actor, value, expires: Infinity, ticks: duration });
    log(side === sides[0] ? 0 : 1, "debuff", value, { target: side === sides[0] ? "allies" : "enemies", effectKey: "dot", duration, chance: chance || undefined, succeeded: chance ? extended : undefined });
  };
  const item = (side: Side, id: string, index = 0) => side.items.has(id) ? percentages(itemMap.get(id)!.skill.text)[index] ?? 0 : 0;
  const attack = (side: Side) => living(side).reduce((sum, unit) => sum + unit.atk, 0) * (1 + Math.max(0, effect(side, "atk") - effect(side, "atkDown")));
  const heal = (index: number, amount: number) => {
    const side = sides[index];
    let left = amount * (1 + item(side, "decameron-manuscript"));
    let restored = 0;
    // Most wounded living slot first. Healing cannot revive a fallen hero.
    for (const unit of [...living(side)].sort((a, b) => a.health / a.hp - b.health / b.hp)) {
      const gain = Math.min(left, unit.hp - unit.health);
      unit.health += gain; left -= gain; restored += gain;
    }
    side.healing += restored;
    if (restored > 0) log(index, "heal", restored);
    const shield = restored * item(side, "the-creation-of-adam");
    side.shield += shield;
    if (shield) log(index, "shield", shield);
    return restored;
  };
  const lowestLivingSlot = (side: Side) => side.units.findIndex((unit) => unit.health > 0);
  const hit = (index: number, raw: number, kind: string, critical = false) => {
    const from = sides[index], to = sides[1 - index];
    if (totalHp(to) <= 0 || raw <= 0) return 0;
    if (effect(to, "barrier") > 0) { log(index, "immune", 0, { target: living(to).at(-1)?.id }); return 0; }
    // Each action applies damage once to a shared pool represented by ordered
    // 1,000-HP segments; enemy count changes pool capacity, never hit damage.
    let amount = raw;
    if (kind === "skill") amount *= Math.max(0, 1 + effect(from, "skill") - effect(from, "skillDown")) * (1 - Math.min(.9, Math.max(0, effect(to, "reduction") - effect(from, "skillReductionDown"))));
    if (kind === "extra") amount *= 1 + effect(from, "extra");
    if (kind === "dot") amount *= 1 + item(from, "dead-sea-scrolls");
    if (critical) amount *= 1 + effect(from, "crit");
    if (index === 0) amount *= 1 - Math.max(0, options.enemyReduction - effect(to, "reductionDown"));
    if (effect(to, "damageCap") > 0) amount = Math.min(amount, to.max * effect(to, "damageCap"));
    const bypass = kind === "skill" || kind === "extra" ? Math.min(1, effect(from, "break")) : 0;
    const absorbed = Math.min(to.shield, amount * (1 - bypass));
    to.shield -= absorbed; to.absorbed += absorbed; amount -= absorbed;
    if (absorbed) log(1 - index, "absorb", absorbed);
    if (to === sides[0] && to.pedalCarShield && to.shield <= 0) {
      to.pedalCarShield = false;
      actor = "flintstone-pedal-car";
      add(to, "reduction", item(to, "flintstone-pedal-car", 2), 1000, true, "flintstone-pedal-car");
    }
    let remaining = amount;
    const losses: { id: string; amount: number; before: number; after: number }[] = [];
    // Highest slot falls first; spillover goes to the next living slot.
    for (const unit of [...to.units].reverse()) {
      const before = unit.health;
      const damage = Math.min(unit.health, remaining);
      const wasAlive = unit.health > 0;
      unit.health -= damage; remaining -= damage;
      if (damage > 0) losses.push({ id: unit.id, amount: damage, before, after: unit.health });
      if (to === sides[0] && !to.pedalCarTriggered && to.items.has("flintstone-pedal-car") && before >= unit.hp * .5 && unit.health < unit.hp * .5) {
        to.pedalCarTriggered = true; to.pedalCarShield = true;
        const shield = to.max * item(to, "flintstone-pedal-car");
        to.shield += shield;
        actor = "flintstone-pedal-car"; log(0, "shield", shield, { effectKey: "flintstone-pedal-car" });
        add(to, "reduction", item(to, "flintstone-pedal-car", 1), 1000, false, "flintstone-pedal-car");
      }
      if (to === sides[0] && !to.hammerTriggered && to.items.has("thors-hammer") && totalHp(to) < to.max * .35) {
        to.hammerTriggered = true;
        add(to, "damageCap", item(to, "thors-hammer"), 3, false, "thors-hammer");
      }
      if (wasAlive && unit.health === 0) {
        log(1 - index, "fall:" + unit.id, 0);
        if (to.items.has("holy-hand-grenade")) add(to, "skill", item(to, "holy-hand-grenade", 1), 1000, true);
        if (!to.wingsTriggered && to.items.has("wings-of-icarus")) {
          to.wingsTriggered = true;
          const reviveCount = 9 + Math.floor(random() * 3);
          const fallen = to.units.filter((candidate) => candidate.health <= 0).slice(0, reviveCount);
          for (const revived of fallen) revived.health = 1;
          actor = "wings-of-icarus";
          log(1 - index, "revive", fallen.length, { effectKey: "wings-of-icarus" });
        }
      }
      if (remaining <= 0) break;
    }
    const dealt = amount - remaining;
    from.damage += dealt;
    if (losses.length) for (const loss of losses) log(index, critical ? "critical" : kind, loss.amount, { target: loss.id, raw, hpBefore: loss.before, hpAfter: loss.after });
    else log(index, critical ? "critical" : kind, 0, { target: living(to).at(-1)?.id, raw, hpBefore: totalHp(to), hpAfter: totalHp(to) });
    if (kind === "dot") to.dotTaken += dealt;
    if (dealt > 0 && effect(to, "cryptidHeal") > 0) heal(1 - index, to.max * effect(to, "cryptidHeal"));
    if (dealt > 0 && kind !== "reflection" && effect(to, "reflect") > 0) hit(1 - index, dealt * effect(to, "reflect"), "reflection");
    if (!to.labyrinth && totalHp(to) > 0 && totalHp(to) < to.max * .5 && to.items.has("model-of-the-minotaurs-labyrinth")) {
      to.labyrinth = true; heal(1 - index, to.max * item(to, "model-of-the-minotaurs-labyrinth"));
    }
    return dealt;
  };
  for (const side of sides) {
    add(side, "atk", item(side, "prometheus-torch"), 1000, false, "prometheus-torch");
    add(side, "atk", item(side, "plague-doctor-mask"), 1000, false, "plague-doctor-mask");
    add(side, "skill", item(side, "prometheus-torch", 1), 1000, false, "prometheus-torch");
    add(side, "crit", item(side, "holy-hand-grenade"), 1000, false, "holy-hand-grenade");
    add(side, "crit", item(side, "plague-doctor-mask", 1), 1000, false, "plague-doctor-mask");
  }
  if (sides[0].items.has("golden-mask-of-agamemnon")) {
    const enemyAttack = attack(sides[1]);
    const ownAttack = attack(sides[0]);
    const reduction = enemyAttack > 0 ? Math.min(enemyAttack * item(sides[0], "golden-mask-of-agamemnon"), ownAttack) / enemyAttack : 0;
    actor = "golden-mask-of-agamemnon";
    add(sides[1], "atkDown", reduction, 5, false, "golden-mask-of-agamemnon");
  }
  const cast = (index: number, unit: Unit) => {
    const from = sides[index], to = sides[1 - index];
    const skill = skillFor(unit)!;
    const v = skill.values;
    const atk = unit.atk * (1 + Math.max(0, effect(from, "atk") - effect(from, "atkDown")));
    const hadShield = to.shield > 0;
    if (random() < effect(to, "dodge")) { log(index, "dodge", 0); return; }
    log(index, "cast", skill.level);
    if (unit.id === "achilles" && from.items.has("divine-greaves")) add(from, "crit", item(from, "divine-greaves"), 3, true);
    const critHero = ["bjorn-ironside", "lagertha", "achilles", "tutankhamun"].includes(unit.id);
    const critChance = unit.id === "bjorn-ironside" ? (to.shield > 0 ? 1 : v[3]) : v[2];
    const critBonus = unit.id === "bjorn-ironside" ? v[4] : v[3];
    const critical = critHero && random() < critChance;
    const damage = hit(index, atk * skill.coefficient * (critical ? 1 + critBonus : 1), "skill", critical);
    from.skillsUsed++;
    if (index === 0 && from.items.has("cross-of-lorraine-flag")) add(from, "skillReductionDown", item(from, "cross-of-lorraine-flag"), 3, true, "cross-of-lorraine-flag");
    if (index === 1 && sides[0].items.has("trojan-horse") && from.skillsUsed % 3 === 0 && random() < item(sides[0], "trojan-horse")) {
      actor = "trojan-horse"; add(from, "seal", 1, 1, false, "trojan-horse");
    }
    switch (unit.id) {
      case "hermes": add(from, "dodge", Math.min(1, v[2] + item(from, "winged-sandals")), 3); break;
      case "merlin": add(from, "break", v[2], 3); if (hadShield) hit(index, atk * v[3], "extra"); break;
      case "heracles":
        { const buff = to.effects.find((entry) => buffs.has(entry.key) && entry.value > 0);
          if (buff) to.effects.splice(to.effects.indexOf(buff), 1);
          if (from.effects.filter((e) => buffs.has(e.key) && e.value > 0).length > to.effects.filter((e) => buffs.has(e.key) && e.value > 0).length) hit(index, atk * v[2], "extra");
          if (from.items.has("nemean-lion-pelt")) {
            const debuff = from.effects.find((e) => debuffs.has(e.key));
            if (debuff) from.effects.splice(from.effects.indexOf(debuff), 1);
            if (from.effects.filter((e) => debuffs.has(e.key)).length <= to.effects.filter((e) => debuffs.has(e.key)).length) hit(index, atk * item(from, "nemean-lion-pelt"), "extra");
          }
        } break;
      case "lancelot":
        { const count = Math.min(3, to.effects.filter((e) => debuffs.has(e.key)).length);
          addDot(to, atk * v[2] * (1 + count));
        } break;
      case "king-arthur": add(from, "reduction", v[2], 3); addDot(to, atk * v[3]); break;
      case "odysseus": addDot(to, atk * v[2]); add(from, "dotHeal", v[3], 3); if (from.items.has("aeolus-bag-of-winds")) add(from, "counterHeal", item(from, "aeolus-bag-of-winds"), 3); break;
      case "bjorn-ironside": add(from, "crit", v[2], 3, true); break;
      case "lagertha": heal(index, damage * v[4]); break;
      case "pompey": heal(index, damage * v[2]); if (random() < v[3]) add(from, "barrier", 1, 1);
        if (from.items.has("eagle-scepter")) { if (unit.health > unit.hp * .5) add(from, "skill", item(from, "eagle-scepter", 1), 3, true); else heal(index, from.max * item(from, "eagle-scepter", 3)); } break;
      case "caesar": {
        let chance = v[2], count = 0;
        while (chance > 0 && count < 10 && random() < chance) {
          hit(index, atk * v[3], "extra"); count++; chance -= v[4];
          if (from.items.has("notre-dame-de-paris-replica") && random() < item(from, "notre-dame-de-paris-replica")) hit(index, atk * item(from, "notre-dame-de-paris-replica", 1), "collection");
        }
        if (count >= 2 && from.items.has("golden-throne")) { add(from, "skill", item(from, "golden-throne"), 3, true); add(from, "extra", item(from, "golden-throne", 1), 3); }
      } break;
      case "cleopatra": add(to, "replace", atk * v[2], 1); break;
      case "charles-the-great": add(to, "skillDown", v[2], 2); break;
      case "william-shakespeare": if (random() < v[2]) heal(index, from.max * v[3]); break;
      case "da-vinci": from.shield += from.max * v[2]; log(index, "shield", from.max * v[2]); add(from, "skill", v[3], 3, true); if (from.items.has("mona-lisa")) add(from, "reduction", item(from, "mona-lisa"), 3); break;
      case "alexander-the-great": if (random() < v[2]) {
        hit(index, atk * v[3], "extra");
        if (from.items.has("notre-dame-de-paris-replica") && random() < item(from, "notre-dame-de-paris-replica")) hit(index, atk * item(from, "notre-dame-de-paris-replica", 1), "collection");
      } break;
      case "augustus": hit(index, atk * (round <= 5 ? v[2] : v[3]), "extra"); break;
    }
    if (index === 0 && unit.id === "augustus" && from.items.has("augustus-coin") && round <= 5) add(from, "skill", item(from, "augustus-coin"), 1, true, "augustus-coin");
    if (from.items.has("notre-dame-de-paris-replica") && random() < item(from, "notre-dame-de-paris-replica")) hit(index, atk * item(from, "notre-dame-de-paris-replica", 1), "collection");
  };
  const removeEffects = (side: Side, kinds: Set<string>, count: number) => {
    let removed = 0;
    for (let index = side.effects.length - 1; index >= 0 && removed < count; index--) {
      if (kinds.has(side.effects[index].key)) {
        const [entry] = side.effects.splice(index, 1); removed++;
        log(side === sides[0] ? 0 : 1, "removeEffect", entry.value, { actor, target: side === sides[0] ? "allies" : "enemies", effectKey: entry.key });
      }
    }
    return removed;
  };
  const cryptidAction = (selection: CryptidSelection) => {
    const from = sides[0], to = sides[1];
    const unlocked = selection.skills;
    actor = selection.id;
    log(0, "cryptidAction", unlocked);
    switch (selection.id) {
      case "nidhogg":
        hit(0, attack(from) * 2, "cryptid");
        add(from, "frontForce", 1, 3, false, "nidhogg");
        if (unlocked >= 2) add(from, "skill", .25, 2, false, "nidhogg");
        if (unlocked >= 3) add(to, "reductionDown", .15, 2, false, "nidhogg");
        break;
      case "caladrius":
        from.shield += from.max * .3;
        log(0, "shield", from.max * .3);
        add(from, "reduction", .2, 3, false, "caladrius");
        if (unlocked >= 2) add(to, "atkDown", .1, 2, false, "caladrius");
        if (unlocked >= 3) add(from, "cryptidHeal", .08, 3, false, "caladrius");
        break;
      case "cerberus":
        hit(0, attack(from) * 2, "cryptid");
        add(from, "skill", .2, 3, false, "cerberus");
        if (unlocked >= 2) add(to, "skillDown", .2, 2, false, "cerberus");
        if (unlocked >= 3) hit(0, Math.min(to.max * .1, attack(from)), "cryptid");
        break;
      case "sleipnir":
        heal(0, from.max * .3);
        add(from, "reflect", .2, 3, false, "sleipnir");
        if (unlocked >= 2) log(0, "dispelBuff", removeEffects(to, buffs, 2));
        if (unlocked >= 3) log(0, "dispelDebuff", removeEffects(from, debuffs, 2));
        break;
    }
  };
  let completed = 0;
  for (round = 1; round <= options.rounds && totalHp(sides[0]) > 0 && totalHp(sides[1]) > 0; round++) {
    const cryptid = options.cryptides?.[round - 1];
    if (cryptid && totalHp(sides[0]) > 0 && totalHp(sides[1]) > 0) cryptidAction(cryptid);
    // Player always starts. The opponent gets exactly one action, after the
    // player's action in round 1; later rounds are player + scheduled Cryptid.
    const actingSides = [0, 1];
    for (const index of actingSides) {
      const from = sides[index], to = sides[1 - index];
      if (totalHp(from) <= 0 || totalHp(to) <= 0) break;
      const expired = from.effects.filter((entry) => entry.expires <= from.actions);
      from.effects = from.effects.filter((entry) => entry.expires > from.actions);
      for (const entry of expired) log(index, "expire", entry.value, { actor: entry.source, target: index === 0 ? "allies" : "enemies", effectKey: entry.key });
      actor = "team";
      from.dotTaken = 0;
      const dot = effect(from, "dot");
      if (dot) hit(1 - index, dot, "dot");
      from.effects.forEach((entry) => { if (entry.ticks !== undefined) entry.ticks--; });
      from.effects = from.effects.filter((entry) => entry.ticks === undefined || entry.ticks > 0);
      if (totalHp(from) <= 0) continue;
      const dagger = () => {
        if (from.dotTaken && totalHp(to) > 0 && to.items.has("brutus-dagger")) {
          actor = "brutus-dagger";
          hit(1 - index, from.dotTaken * item(to, "brutus-dagger"), "collection");
        }
      };
      // Training targets and later opponent rounds still advance their effect
      // clocks and DoT ticks, but only a real opponent attacks in round 1.
      if (index === 1 && (options.dummy || round > 1)) { from.actions++; dagger(); continue; }
      const damageBefore = from.damage;
      const replacement = effect(from, "replace");
      if (replacement) { from.effects = from.effects.filter((e) => e.key !== "replace"); hit(1 - index, replacement, "normal"); }
      else if (effect(from, "seal") > 0) log(index, "sealed", 0, { effectKey: "seal" });
      else {
        const frontCount = FORMATION_COLUMNS.front.filter((value) => value > 0).length;
        // Every living hero rolls each action. Successful unused skills are
        // considered in formation order; the lowest numbered eligible slot
        // gets the one action. If none qualifies, the lowest living slot makes
        // the normal attack. A skill remains consumed for the whole battle.
        const rolls: { unit: Unit; slot: number; skill: NonNullable<ReturnType<typeof skillFor>>; chance: number; succeeded: boolean; eligible: boolean }[] = [];
        for (let slot = 0; slot < from.units.length; slot++) {
          const unit = from.units[slot];
          if (unit.health <= 0) continue;
          const skill = skillFor(unit);
          if (!skill) continue;
          const procChance = Math.min(1, skill.chance + (slot < frontCount ? effect(from, "frontForce") : 0));
          const succeeded = random() < procChance;
          const eligible = !from.usedSkills.has(unit.id);
          rolls.push({ unit, slot, skill, chance: procChance, succeeded, eligible });
        }
        const winner = rolls.find((entry) => entry.succeeded && entry.eligible);
        const arkForced = index === 0 && round % 4 === 0 && from.items.has("model-of-noahs-ark")
          ? from.units.find((unit) => unit.health > 0 && !from.usedSkills.has(unit.id)) : undefined;
        const selectedUnit = arkForced ?? winner?.unit;
        for (const roll of rolls) {
          actor = roll.unit.id;
          log(index, "skillRoll", roll.chance, { target: living(to).at(-1)?.id, chance: roll.chance, succeeded: roll.succeeded, eligible: roll.eligible, selected: roll.unit === selectedUnit });
        }
        const slot = selectedUnit ? from.units.indexOf(selectedUnit) : lowestLivingSlot(from);
        const unit = slot >= 0 ? from.units[slot] : undefined;
        if (unit && totalHp(to) > 0) {
          const actionDamageBefore = from.damage;
          const target = living(to).at(-1)?.id;
          const succeeded = Boolean(selectedUnit && (arkForced || winner));
          actor = unit.id;
          if (arkForced) { actor = "model-of-noahs-ark"; add(from, "skill", 2.5, 1, false, "model-of-noahs-ark"); log(index, "forcedSkill", 2.5, { target: unit.id, effectKey: "model-of-noahs-ark" }); }
          const pandora = index === 0 && from.items.has("pandoras-box") && random() < item(from, "pandoras-box");
          if (pandora) { actor = "pandoras-box"; add(from, "skill", item(from, "pandoras-box", 1), 1, true, "pandoras-box"); log(index, "empower", item(from, "pandoras-box", 1), { target: unit.id, effectKey: "pandoras-box" }); }
          actor = unit.id;
          if (succeeded) { cast(index, unit); from.usedSkills.add(unit.id); }
          else hit(index, unit.atk * (1 + Math.max(0, effect(from, "atk") - effect(from, "atkDown"))) * (pandora ? 1 + item(from, "pandoras-box", 1) : 1), "normal");
          log(index, "heroAction", from.damage - actionDamageBefore, { target, effectKey: succeeded ? "skillAttack" : "normalAttack", chance: arkForced ? skillFor(unit)?.chance : winner?.skill.chance, succeeded, selected: true });
        }
      }
      if (effect(from, "dotHeal")) heal(index, to.dotTaken * effect(from, "dotHeal"));
      if (effect(to, "counterHeal")) heal(1 - index, (from.damage - damageBefore) * effect(to, "counterHeal"));
      from.actions++;
      if (index === 0 && from.items.has("otzis-copper-axe") && round % 3 === 0) {
        actor = "otzis-copper-axe"; add(from, "skillReductionDown", item(from, "otzis-copper-axe"), 1, false, "otzis-copper-axe");
      }
      if (index === 0 && round % 2 === 0) {
        if (from.items.has("david")) {
          actor = "david";
          const qualified = living(from).filter(() => from.effects.filter((entry) => buffs.has(entry.key)).length >= 2);
          if (qualified.length) heal(index, qualified.reduce((sum, unit) => sum + unit.hp * item(from, "david"), 0));
        }
        if (from.items.has("olympia-olive-wreath") && to.effects.filter((entry) => debuffs.has(entry.key)).length >= 2 && random() < item(from, "olympia-olive-wreath")) {
          actor = "olympia-olive-wreath"; add(to, "seal", 1, 1, false, "olympia-olive-wreath");
        }
      }
      if (from.actions <= 5) {
        if (from.items.has("scarab-amulet")) add(from, "atk", item(from, "scarab-amulet"), 1000, true, "scarab-amulet");
        if (from.items.has("heimdalls-horn")) add(from, "reduction", item(from, "heimdalls-horn"), 1000, true, "heimdalls-horn");
      }
      dagger();
    }
    completed = round;
    if (record) timeline.push({ round, damage: sides[0].damage, allyHp: totalHp(sides[0]), enemyHp: totalHp(sides[1]) });
  }
  return { damage: sides[0].damage, healing: sides[0].healing, absorbed: sides[0].absorbed, alive: living(sides[0]).length, remaining: totalHp(sides[0]) / sides[0].max, win: !options.dummy && totalHp(sides[1]) === 0 && totalHp(sides[0]) > 0, rounds: completed, events, timeline };
}

function evaluate(team: Fighter[], collection: string[], cryptides: (CryptidSelection | null)[], options: BattleOptions, trials: number, seedOffset = 0): Candidate {
  const scenario = { ...options, collection, cryptides };
  let damage = 0, squares = 0, healing = 0, wins = 0, remaining = 0;
  for (let i = 0; i < trials; i++) {
    const battle = simulateBattle(team, scenario, (options.seed + i * 7919 + seedOffset) >>> 0);
    damage += battle.damage; squares += battle.damage ** 2; healing += battle.healing; wins += Number(battle.win); remaining += battle.remaining;
  }
  return { team, collection, cryptides, damage: damage / trials, healing: healing / trials, winRate: wins / trials, remaining: remaining / trials, deviation: Math.sqrt(Math.max(0, squares / trials - (damage / trials) ** 2)) };
}
function cryptidSchedules(selected: CryptidSelection[]): (CryptidSelection | null)[][] {
  const schedules: (CryptidSelection | null)[][] = [];
  const place = (index: number, current: (CryptidSelection | null)[], usedRounds: Set<number>) => {
    if (index === selected.length) { schedules.push(current); return; }
    for (let round = 0; round < 4; round++) {
      if (usedRounds.has(round)) continue;
      const next = [...current]; next[round] = selected[index];
      const used = new Set(usedRounds); used.add(round);
      place(index + 1, next, used);
    }
  };
  place(0, Array.from({ length: 4 }, () => null), new Set());
  return schedules;
}
export function optimizeTeams(pool: Fighter[], options: BattleOptions, progress?: (done: number) => void): SearchResult {
  validateBattle(pool, options);
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const collectionPool = [...options.collection].sort((a, b) => a.localeCompare(b, "en"));
  const selectedCryptides = (options.cryptides ?? []).filter((entry): entry is CryptidSelection => entry !== null);
  const schedules = cryptidSchedules(selectedCryptides);
  const collectionSlots = Math.min(options.collectionSlots ?? 6, collectionPool.length);
  const random = seededRandom(options.seed);
  const scheduleKey = (schedule: (CryptidSelection | null)[]) => schedule.map((entry) => entry?.id ?? "-").join(",");
  const compare = (a: Candidate, b: Candidate) => (options.objective === "wins" && !options.dummy ? b.winRate - a.winRate || b.remaining - a.remaining : 0) || b.damage - a.damage || a.team.map((u) => u.id).join(",").localeCompare(b.team.map((u) => u.id).join(","), "en") || a.collection.join(",").localeCompare(b.collection.join(","), "en") || scheduleKey(a.cryptides).localeCompare(scheduleKey(b.cryptides), "en");
  const seen = new Set<string>();
  let elite: Candidate[] = [];
  let teamCount = 1;
  for (let i = 0; i < options.size; i++) teamCount *= sorted.length - i;
  let collectionCount = 1;
  for (let i = 0; i < collectionSlots; i++) collectionCount = collectionCount * (collectionPool.length - i) / (i + 1);
  const exhaustive = teamCount * collectionCount * schedules.length <= options.budget;
  const assess = (team: Fighter[], collection: string[], cryptides: (CryptidSelection | null)[]) => {
    const key = team.map((unit) => unit.id).join(",") + "|" + collection.join(",") + "|" + scheduleKey(cryptides);
    if (seen.has(key)) return;
    seen.add(key);
    elite.push(evaluate(team, collection, cryptides, options, options.trials));
    elite.sort(compare); elite = elite.slice(0, 8);
    if (seen.size % 10 === 0) progress?.(seen.size);
  };
  const eachCollection = (visit: (collection: string[]) => void) => {
    const choose = (start: number, current: string[]) => {
      if (current.length === collectionSlots) { visit(current); return; }
      for (let index = start; index <= collectionPool.length - (collectionSlots - current.length); index++) choose(index + 1, [...current, collectionPool[index]]);
    };
    choose(0, []);
  };
  const randomCollection = () => {
    const shuffled = [...collectionPool];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    return shuffled.slice(0, collectionSlots).sort((a, b) => a.localeCompare(b, "en"));
  };
  const mutateCollection = (current: string[]) => {
    if (collectionSlots === 0 || collectionPool.length <= collectionSlots) return randomCollection();
    const next = [...current];
    const replace = Math.floor(random() * next.length);
    const choices = collectionPool.filter((id) => !next.includes(id));
    next[replace] = choices[Math.floor(random() * choices.length)];
    return next.sort((a, b) => a.localeCompare(b, "en"));
  };
  if (exhaustive) {
    const visit = (team: Fighter[]) => {
      if (team.length === options.size) { eachCollection((collection) => schedules.forEach((schedule) => assess(team, collection, schedule))); return; }
      for (const unit of sorted) if (!team.includes(unit)) visit([...team, unit]);
    };
    visit([]);
  } else {
    // No archetypes, tiers, names or guide scores seed the search.
    for (let attempt = 0; seen.size < options.budget && attempt < options.budget * 8; attempt++) {
      let team: Fighter[], collection: string[], cryptides: (CryptidSelection | null)[];
      if (elite.length && attempt % 3 !== 0) {
        const parent = elite[Math.floor(random() * elite.length)];
        team = [...parent.team];
        collection = [...parent.collection];
        cryptides = [...parent.cryptides];
        if (schedules.length > 1 && random() < .4) cryptides = schedules[Math.floor(random() * schedules.length)];
        if (collectionPool.length > collectionSlots && random() < .5) collection = mutateCollection(collection);
        else {
          const slot = Math.floor(random() * team.length);
          const spare = sorted.filter((unit) => !team.includes(unit));
          if (spare.length && random() < .6) team[slot] = spare[Math.floor(random() * spare.length)];
          else { const other = Math.floor(random() * team.length); [team[slot], team[other]] = [team[other], team[slot]]; }
          if (collectionPool.length > collectionSlots && random() < .25) collection = mutateCollection(collection);
        }
      } else {
        const shuffled = [...sorted];
        for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
        team = shuffled.slice(0, options.size);
        collection = randomCollection();
        cryptides = schedules[Math.floor(random() * schedules.length)];
      }
      assess(team, collection, cryptides);
    }
  }
  // Independent seed set reduces selection bias; not a proof of global optimality.
  const validationTrials = 128;
  const candidates = elite.map((candidate) => evaluate(candidate.team, candidate.collection, candidate.cryptides, options, validationTrials, 1000003)).sort(compare).slice(0, 3);
  return { candidates, evaluated: seen.size, exhaustive, validationTrials, trace: simulateBattle(candidates[0].team, { ...options, collection: candidates[0].collection, cryptides: candidates[0].cryptides }, options.seed + 1000003, true) };
}
