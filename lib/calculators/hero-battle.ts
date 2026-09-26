import { HEROES } from "../content/heroes.ts";
import { COLLECTION_ITEMS, EXCLUSIVE_COLLECTION_HEROES } from "../content/collection.ts";

export type Fighter = { id: string; atk: number; hp: number; stars: number; level?: number };
export type BattleOptions = { rounds: number; seed: number; trials: number; budget: number; size: number; enemyFirst: boolean; repeatSkills: boolean; objective: "damage" | "wins"; enemy: Fighter[]; dummy: boolean; enemyReduction: number; items: string[]; collection: string[] };
export type BattleEvent = { round: number; side: number; actor: string; action: string; amount: number; allyHp: number; enemyHp: number };
export type BattleResult = { damage: number; healing: number; absorbed: number; alive: number; remaining: number; win: boolean; rounds: number; events: BattleEvent[]; timeline: { round: number; damage: number; allyHp: number; enemyHp: number }[] };
export type Candidate = { team: Fighter[]; damage: number; healing: number; winRate: number; remaining: number; deviation: number };
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
]);
const heroMap = new Map(HEROES.map((hero) => [hero.id, hero]));
const itemMap = new Map(COLLECTION_ITEMS.map((item) => [item.id, item]));
const percentages = (text: string) => [...text.matchAll(/(\d+(?:\.\d+)?)%/g)].map((match) => Number(match[1]) / 100);
export function skillFor(fighter: Fighter) {
  const source = heroMap.get(fighter.id)?.skill;
  if (!source || !MODELED_HEROES.has(fighter.id)) return null;
  let index = 0;
  source.levels.forEach((text, i) => {
    const gate = text.match(/^Activates at (\d+)-Star\./);
    if (gate && fighter.stars >= Number(gate[1])) index = i;
  });
  const text = source.levels[index];
  const values = percentages(text);
  if (values.length < 2) return null;
  return { text, level: index + 1, chance: values[0], coefficient: values[1], values };
}
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
type Effect = { key: string; source: string; value: number; expires: number; ticks?: number };
type Unit = Fighter & { health: number; spent: boolean };
type Side = { units: Unit[]; max: number; shield: number; effects: Effect[]; items: Set<string>; damage: number; healing: number; absorbed: number; actions: number; labyrinth: boolean; dotTaken: number };
const totalHp = (side: Side) => side.units.reduce((sum, unit) => sum + unit.health, 0);
const living = (side: Side) => side.units.filter((unit) => unit.health > 0);
const effect = (side: Side, key: string) => side.effects.filter((entry) => entry.key === key).reduce((sum, entry) => sum + entry.value, 0);
const buffs = new Set(["dodge", "break", "crit", "skill", "reduction", "barrier", "dotHeal", "counterHeal", "atk", "extra"]);
const debuffs = new Set(["dot", "skillDown", "replace"]);

export function validateBattle(pool: Fighter[], options: BattleOptions) {
  const whole = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
  if (!whole(options.rounds, 1, 100) || !whole(options.size, 1, 25) || !whole(options.seed, 0, 2147483647) || !whole(options.trials, 1, 128) || !whole(options.budget, 1, 1000)) throw new RangeError("settings");
  if (!["damage", "wins"].includes(options.objective) || !Number.isFinite(options.enemyReduction) || options.enemyReduction < 0 || options.enemyReduction > .9) throw new RangeError("settings");
  const validateTeam = (team: Fighter[], dummy = false) => {
    if (!team.length || team.length > 82 || new Set(team.map((unit) => unit.id)).size !== team.length) throw new RangeError("team");
    for (const unit of team) {
      if ((!dummy && !skillFor(unit)) || !Number.isFinite(unit.atk) || unit.atk < 0 || unit.atk > 1e9 || !Number.isFinite(unit.hp) || unit.hp <= 0 || unit.hp > 1e12 || !whole(unit.stars, 0, 1000)) throw new RangeError("fighter");
    }
  };
  validateTeam(pool);
  if (pool.length < options.size) throw new RangeError("size");
  if (!options.dummy) { validateTeam(options.enemy); if (options.enemy.length > 25) throw new RangeError("enemy"); }
  if (options.items.some((id) => !MODELED_ITEMS.has(id) || !EXCLUSIVE_COLLECTION_HEROES[id]) || options.collection.some((id) => !MODELED_ITEMS.has(id)) || options.collection.length > 25) throw new RangeError("items");
}

/** Event simulation with an explicit scenario model; see HERO-TEAM-PLANNER.md. */
export function simulateBattle(team: Fighter[], options: BattleOptions, seed = options.seed, record = false): BattleResult {
  const random = seededRandom(seed);
  const make = (units: Fighter[], items: string[]): Side => ({ units: units.map((unit) => ({ ...unit, health: unit.hp, spent: false })), max: units.reduce((sum, unit) => sum + unit.hp, 0), shield: 0, effects: [], items: new Set(items), damage: 0, healing: 0, absorbed: 0, actions: 0, labyrinth: false, dotTaken: 0 });
  const owned = options.items.filter((id) => team.some((unit) => unit.id === EXCLUSIVE_COLLECTION_HEROES[id]));
  const sides = [make(team, [...owned, ...options.collection]), make(options.dummy ? [{ id: "dummy", atk: 0, hp: 1e15, stars: 0 }] : options.enemy, [])];
  const events: BattleEvent[] = [];
  const timeline: BattleResult["timeline"] = [];
  let round = 0;
  let actor = "";
  const log = (side: number, action: string, amount: number) => { if (record) events.push({ round, side, actor, action, amount, allyHp: totalHp(sides[0]), enemyHp: totalHp(sides[1]) }); };
  const add = (side: Side, key: string, value: number, turns: number, stack = false, source = actor) => {
    if (!stack) side.effects = side.effects.filter((entry) => entry.key !== key || entry.source !== source);
    if (value) side.effects.push({ key, source, value, expires: side.actions + turns });
  };
  const addDot = (side: Side, value: number) => side.effects.push({ key: "dot", source: actor, value, expires: Infinity, ticks: 3 });
  const item = (side: Side, id: string, index = 0) => side.items.has(id) ? percentages(itemMap.get(id)!.skill.text)[index] ?? 0 : 0;
  const attack = (side: Side) => living(side).reduce((sum, unit) => sum + unit.atk, 0) * Math.max(0, 1 + effect(side, "atk"));
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
  const hit = (index: number, raw: number, kind: string, critical = false) => {
    const from = sides[index], to = sides[1 - index];
    if (totalHp(to) <= 0 || raw <= 0) return 0;
    if (effect(to, "barrier") > 0) { log(index, "immune", 0); return 0; }
    let amount = raw;
    if (kind === "skill") amount *= Math.max(0, 1 + effect(from, "skill") - effect(from, "skillDown")) * (1 - Math.min(.9, effect(to, "reduction")));
    if (kind === "extra") amount *= 1 + effect(from, "extra");
    if (kind === "dot") amount *= 1 + item(from, "dead-sea-scrolls");
    if (critical) amount *= 1 + effect(from, "crit");
    if (index === 0) amount *= 1 - options.enemyReduction;
    const bypass = kind === "skill" || kind === "extra" ? Math.min(1, effect(from, "break")) : 0;
    const absorbed = Math.min(to.shield, amount * (1 - bypass));
    to.shield -= absorbed; to.absorbed += absorbed; amount -= absorbed;
    if (absorbed) log(1 - index, "absorb", absorbed);
    let remaining = amount;
    // Highest slot falls first; spillover goes to the next living slot.
    for (const unit of [...to.units].reverse()) {
      const damage = Math.min(unit.health, remaining);
      const wasAlive = unit.health > 0;
      unit.health -= damage; remaining -= damage;
      if (wasAlive && unit.health === 0) {
        log(1 - index, "fall:" + unit.id, 0);
        if (to.items.has("holy-hand-grenade")) add(to, "skill", item(to, "holy-hand-grenade", 1), 1000, true);
      }
      if (remaining <= 0) break;
    }
    const dealt = amount - remaining;
    from.damage += dealt;
    log(index, critical ? "critical" : kind, dealt);
    if (kind === "dot") to.dotTaken += dealt;
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
  const cast = (index: number, unit: Unit) => {
    const from = sides[index], to = sides[1 - index];
    const skill = skillFor(unit)!;
    const v = skill.values;
    const atk = attack(from);
    const hadShield = to.shield > 0;
    unit.spent = !options.repeatSkills;
    if (random() < effect(to, "dodge")) { log(index, "dodge", 0); return; }
    log(index, "cast", skill.level);
    if (unit.id === "achilles" && from.items.has("divine-greaves")) add(from, "crit", item(from, "divine-greaves"), 3, true);
    const critHero = ["bjorn-ironside", "lagertha", "achilles", "tutankhamun"].includes(unit.id);
    const critChance = unit.id === "bjorn-ironside" ? (to.shield > 0 ? 1 : v[3]) : v[2];
    const critBonus = unit.id === "bjorn-ironside" ? v[4] : v[3];
    const critical = critHero && random() < critChance;
    const damage = hit(index, atk * skill.coefficient * (critical ? 1 + critBonus : 1), "skill", critical);
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
    if (from.items.has("notre-dame-de-paris-replica") && random() < item(from, "notre-dame-de-paris-replica")) hit(index, atk * item(from, "notre-dame-de-paris-replica", 1), "collection");
  };
  let completed = 0;
  for (round = 1; round <= options.rounds && totalHp(sides[0]) > 0 && totalHp(sides[1]) > 0; round++) {
    for (const index of options.enemyFirst ? [1, 0] : [0, 1]) {
      const from = sides[index], to = sides[1 - index];
      if (totalHp(from) <= 0 || totalHp(to) <= 0) break;
      from.effects = from.effects.filter((entry) => entry.expires > from.actions);
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
      if (options.dummy && index === 1) { from.actions++; dagger(); continue; }
      const damageBefore = from.damage;
      const replacement = effect(from, "replace");
      if (replacement) { from.effects = from.effects.filter((e) => e.key !== "replace"); hit(1 - index, replacement, "normal"); }
      else {
        const available = living(from).filter((unit) => !unit.spent);
        const ready = available.filter((unit) => random() < (skillFor(unit)?.chance ?? 0));
        // Arthur's text explicitly gives him activation priority.
        const unit = ready.find((entry) => entry.id === "king-arthur") ?? ready[0];
        if (unit) { actor = unit.id; cast(index, unit); }
        else hit(index, attack(from), "normal");
      }
      if (effect(from, "dotHeal")) heal(index, to.dotTaken * effect(from, "dotHeal"));
      if (effect(to, "counterHeal")) heal(1 - index, (from.damage - damageBefore) * effect(to, "counterHeal"));
      from.actions++;
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

function evaluate(team: Fighter[], options: BattleOptions, trials: number, seedOffset = 0): Candidate {
  let damage = 0, squares = 0, healing = 0, wins = 0, remaining = 0;
  for (let i = 0; i < trials; i++) {
    const battle = simulateBattle(team, options, (options.seed + i * 7919 + seedOffset) >>> 0);
    damage += battle.damage; squares += battle.damage ** 2; healing += battle.healing; wins += Number(battle.win); remaining += battle.remaining;
  }
  return { team, damage: damage / trials, healing: healing / trials, winRate: wins / trials, remaining: remaining / trials, deviation: Math.sqrt(Math.max(0, squares / trials - (damage / trials) ** 2)) };
}
export function optimizeTeams(pool: Fighter[], options: BattleOptions, progress?: (done: number) => void): SearchResult {
  validateBattle(pool, options);
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const random = seededRandom(options.seed);
  const compare = (a: Candidate, b: Candidate) => (options.objective === "wins" && !options.dummy ? b.winRate - a.winRate || b.remaining - a.remaining : 0) || b.damage - a.damage || a.team.map((u) => u.id).join(",").localeCompare(b.team.map((u) => u.id).join(","), "en");
  const seen = new Set<string>();
  let elite: Candidate[] = [];
  let count = 1;
  for (let i = 0; i < options.size; i++) count *= sorted.length - i;
  const exhaustive = count <= options.budget;
  const assess = (team: Fighter[]) => {
    const key = team.map((unit) => unit.id).join(",");
    if (seen.has(key)) return;
    seen.add(key);
    elite.push(evaluate(team, options, options.trials));
    elite.sort(compare); elite = elite.slice(0, 8);
    if (seen.size % 10 === 0) progress?.(seen.size);
  };
  if (exhaustive) {
    const visit = (team: Fighter[]) => {
      if (team.length === options.size) { assess(team); return; }
      for (const unit of sorted) if (!team.includes(unit)) visit([...team, unit]);
    };
    visit([]);
  } else {
    // No archetypes, tiers, names or guide scores seed the search.
    for (let attempt = 0; seen.size < options.budget && attempt < options.budget * 8; attempt++) {
      let team: Fighter[];
      if (elite.length && attempt % 3 !== 0) {
        team = [...elite[Math.floor(random() * elite.length)].team];
        const slot = Math.floor(random() * team.length);
        const spare = sorted.filter((unit) => !team.includes(unit));
        if (spare.length && random() < .6) team[slot] = spare[Math.floor(random() * spare.length)];
        else { const other = Math.floor(random() * team.length); [team[slot], team[other]] = [team[other], team[slot]]; }
      } else {
        const shuffled = [...sorted];
        for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
        team = shuffled.slice(0, options.size);
      }
      assess(team);
    }
  }
  // Independent seed set reduces selection bias; not a proof of global optimality.
  const validationTrials = 128;
  const candidates = elite.map((candidate) => evaluate(candidate.team, options, validationTrials, 1000003)).sort(compare).slice(0, 3);
  return { candidates, evaluated: seen.size, exhaustive, validationTrials, trace: simulateBattle(candidates[0].team, options, options.seed + 1000003, true) };
}
