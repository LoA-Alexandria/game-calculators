import type { Dictionary } from "../i18n/index.ts";

/**
 * Language-independent data for the Hero tier list guide: hero names, grades,
 * resources, and bonuses. Everything readable lives in
 * `guideEntries.heroTierList` and is referenced here by key, so a tier moves in
 * one place for all three languages.
 *
 * Source: Autumn's (Ice, S12) tier lists on Discord, 8 September 2026. Names
 * are spelled as in the Hero layouts guide, so both guides point at the same
 * hero. All ratings are for a hero at 0 stars without items or skins unless an
 * entry says otherwise.
 */

type TierListText = Dictionary["guideEntries"]["heroTierList"];
export type RoleKey = keyof TierListText["roles"];
export type EffectKey = keyof TierListText["effects"];
export type ResourceKey = keyof TierListText["resources"];
export type NoteKey = keyof TierListText["notes"];
export type VariantKey = keyof TierListText["variants"];

export const TIER_IDS = ["SS", "S", "A", "B", "C", "D"] as const;
export type TierId = (typeof TIER_IDS)[number];

/**
 * A grade as the source writes it: `A`, `A>S` (between the two), `SS(S+)`
 * (with a finer grade in brackets), or `C*` (see the entry's note).
 */
export type Grade = string;

const GRADE = /^(SS|S|A|B|C|D)(?:>(SS|S|A|B|C|D))?(?:\((SS\+|S\+)\))?(\*)?$/;

export type ParsedGrade = { tier: TierId; to: TierId | null; fine: string; flagged: boolean };

export function parseGrade(grade: Grade): ParsedGrade | null {
  const match = GRADE.exec(grade);
  if (!match) return null;
  return {
    tier: match[1] as TierId,
    to: (match[2] as TierId | undefined) ?? null,
    fine: match[3] ?? "",
    flagged: Boolean(match[4]),
  };
}

type Tagged = { hero: string; variant?: VariantKey; note?: NoteKey };

export type OverallEntry = Tagged & {
  battle?: Grade;
  /** Missing for SR and R heroes, which have no utility skill. */
  utility?: Grade;
  productivity?: Grade;
  linker?: boolean;
};
export type BattleEntry = Tagged & { roles: readonly RoleKey[]; linker?: boolean };
export type UtilityEntry = Tagged & { effect: EffectKey; situational?: boolean };
export type ProductivityEntry = Tagged & { bonus: readonly number[] };
export type ProductivityGroup = { resource: ResourceKey; entries: readonly ProductivityEntry[] };

export type TierRow<Entry> = { tier: TierId; ordered?: boolean; entries: readonly Entry[] };

export const OVERALL_TIERS: readonly TierRow<OverallEntry>[] = [
  {
    tier: "SS",
    ordered: true,
    entries: [
      { hero: "Joan of Arc", variant: "atUrPlus", battle: "SS(SS+)", utility: "C", productivity: "A" },
      { hero: "Odysseus", variant: "withItem", battle: "SS(S+)", utility: "A", productivity: "B" },
      { hero: "Achilles", variant: "withItem", battle: "SS", utility: "S", productivity: "A" },
    ],
  },
  {
    tier: "S",
    ordered: true,
    entries: [
      { hero: "Odysseus", variant: "withoutItem", battle: "SS", utility: "A", productivity: "B" },
      { hero: "King Arthur", battle: "SS", utility: "S", productivity: "C", linker: true },
      { hero: "Pompey", battle: "S", utility: "A", productivity: "C" },
      { hero: "Caesar", battle: "A>S", utility: "S", productivity: "A" },
      { hero: "Achilles", variant: "withoutItem", battle: "S", utility: "S", productivity: "B" },
      { hero: "Hammurabi", battle: "A", utility: "SS(S+)", productivity: "B" },
      { hero: "Joan of Arc", variant: "atUr", battle: "S", utility: "C", productivity: "A" },
      { hero: "Circe", battle: "S", utility: "A", productivity: "S" },
      { hero: "Lu Bu", battle: "S", utility: "A", productivity: "S" },
      { hero: "Lagertha", battle: "S", utility: "S", productivity: "B" },
      { hero: "Billy the Kid", variant: "withItem", battle: "S", utility: "S", productivity: "S" },
      { hero: "William Shakespeare", variant: "withItem", battle: "S", utility: "SS", productivity: "A" },
    ],
  },
  {
    tier: "A",
    entries: [
      { hero: "Spartacus", battle: "A", utility: "B", productivity: "A" },
      { hero: "Musashi", battle: "S", utility: "A", productivity: "S" },
      { hero: "Gawain", battle: "A", utility: "A", productivity: "A" },
      { hero: "Da Vinci", battle: "A", utility: "B", productivity: "C" },
      { hero: "Guan Yu", battle: "A", utility: "A", productivity: "S" },
      { hero: "Sun-Sin", battle: "B>A", utility: "A", productivity: "S" },
      { hero: "Tutankhamen", battle: "A>S", utility: "D", productivity: "A" },
      { hero: "Blackbeard", battle: "A", utility: "C", productivity: "B" },
      { hero: "Billy the Kid", variant: "withoutItem", battle: "A", utility: "S", productivity: "S" },
      { hero: "William Shakespeare", variant: "withoutItem", battle: "A", utility: "SS", productivity: "A" },
      { hero: "Newton", variant: "withItem", battle: "B", utility: "A", productivity: "A" },
      { hero: "Napoleon", variant: "withOrWithoutItem", battle: "B", utility: "A", productivity: "A" },
      { hero: "Lancelot", battle: "SS", utility: "C", productivity: "A>C", linker: true },
      { hero: "Ragnar", battle: "B", utility: "A", productivity: "C", linker: true },
      { hero: "Queen Victoria", battle: "S", utility: "B", productivity: "A" },
      { hero: "Heracles", variant: "withOrWithoutItem", battle: "A", utility: "A", productivity: "A" },
      { hero: "Merlin", variant: "withoutItem", battle: "A>S", utility: "C", productivity: "S" },
      { hero: "Morgana", variant: "withoutItem", battle: "A>S", utility: "C*", productivity: "S", note: "morganaChaplin" },
      { hero: "Cleopatra", variant: "withoutItem", battle: "A", utility: "C", productivity: "S" },
      { hero: "Tesla", battle: "A", utility: "S", productivity: "A" },
      { hero: "Charles Darwin", battle: "A", utility: "B", productivity: "A" },
    ],
  },
  {
    tier: "B",
    entries: [
      { hero: "Charles the Great", battle: "B", utility: "D", productivity: "B" },
      { hero: "Hermes", variant: "withoutItem", battle: "B", utility: "C", productivity: "S" },
      { hero: "Alexander the Great", battle: "C", utility: "B", productivity: "A" },
      { hero: "Franklin", battle: "B", utility: "B", productivity: "A" },
      { hero: "Gilgamesh", battle: "A", utility: "C>B", productivity: "A" },
      { hero: "Alfred I", battle: "B", utility: "S", productivity: "B" },
      { hero: "Livia", battle: "B", utility: "B", productivity: "A" },
      { hero: "Confucius", battle: "B", utility: "C", productivity: "C" },
      { hero: "Eleanor of Aquitaine", battle: "B", utility: "B>SS", productivity: "A" },
      { hero: "Hector", battle: "B", utility: "S", productivity: "B" },
      { hero: "Beethoven", battle: "B", utility: "C", productivity: "A" },
      { hero: "Galileo Galilei", battle: "B", utility: "A>S", productivity: "C" },
      { hero: "Dante", battle: "C", utility: "A", productivity: "A" },
      { hero: "Socrates", battle: "C", utility: "S", productivity: "C" },
    ],
  },
  {
    tier: "C",
    entries: [
      { hero: "Augustus", battle: "C", utility: "C", productivity: "A" },
      { hero: "Michelangelo", battle: "B", utility: "D", productivity: "A" },
      { hero: "Wallace", battle: "C", productivity: "A" },
      { hero: "Noah", battle: "C", productivity: "A" },
      { hero: "Prometheus", battle: "C", productivity: "A" },
      { hero: "Hypatia", battle: "C", productivity: "B" },
      { hero: "Adam", battle: "C", productivity: "B" },
      { hero: "Hatshepsut", battle: "C", productivity: "A" },
      { hero: "Hannibal", battle: "C", productivity: "A" },
      { hero: "Saladin", battle: "C", productivity: "A" },
      { hero: "Catherine de Medici", battle: "C", productivity: "C" },
      { hero: "Isabella I", battle: "C", productivity: "C" },
      { hero: "Mary I", battle: "C", productivity: "C" },
      { hero: "Elizabeth I", battle: "C", productivity: "B" },
      { hero: "Thomas Edison", battle: "D", productivity: "A" },
      { hero: "James Watt", battle: "D", productivity: "A" },
    ],
  },
  {
    tier: "D",
    entries: [
      { hero: "Victor Hugo" },
      { hero: "Andersen" },
      { hero: "Drake" },
      { hero: "Himiko" },
      { hero: "Florence Nightingale" },
      { hero: "Robin Hood" },
      { hero: "Mary Shelley" },
      { hero: "Chaucer" },
      { hero: "Anne Bonny" },
      { hero: "Alexander Hamilton" },
      { hero: "Dido" },
      { hero: "Marco Polo" },
      { hero: "Archimedes" },
      { hero: "Cervantes" },
    ],
  },
];

export const BATTLE_TIERS: readonly TierRow<BattleEntry>[] = [
  {
    tier: "SS",
    entries: [
      { hero: "Joan of Arc", variant: "atUrPlus", roles: ["crit", "scalingAtk", "execute"], note: "joanScaling" },
      { hero: "Odysseus", roles: ["dot", "dotHeal", "dotBuff"] },
      { hero: "Lancelot", roles: ["dot", "debuffToDot"], linker: true },
      { hero: "King Arthur", roles: ["dot", "dotBuff", "dmgReductionBuff"], linker: true },
    ],
  },
  {
    tier: "S",
    entries: [
      { hero: "Achilles", roles: ["crit"] },
      { hero: "Joan of Arc", variant: "atUr", roles: ["crit"] },
      { hero: "Caesar", variant: "withNidhogg", roles: ["pursuit"] },
      { hero: "Pompey", roles: ["heal", "invincibilityBarrier"] },
      { hero: "Queen Victoria", roles: ["dotHeal", "overflowShield"] },
      { hero: "Lu Bu", roles: ["execute", "silence"] },
      { hero: "Musashi", roles: ["pursuit", "execute"] },
      { hero: "Bjorn", roles: ["crit", "shieldBreak"], linker: true },
      { hero: "Circe", roles: ["thresholdExecute"] },
      { hero: "Merlin", roles: ["pursuit", "shieldBreak"] },
      { hero: "Lagertha", roles: ["heal", "crit"], linker: true },
      { hero: "Ragnar", variant: "fromDay70", roles: [], linker: true },
    ],
  },
  {
    tier: "A",
    entries: [
      { hero: "Guinevere", roles: ["dotBuffDouble"] },
      { hero: "Gawain", roles: ["dot", "execute"] },
      { hero: "Da Vinci", roles: ["shield", "atkBuff"] },
      { hero: "Guan Yu", roles: ["crit", "execute"] },
      { hero: "Sun-Sin", roles: ["dot", "dotBuff"] },
      { hero: "Tutankhamen", roles: ["crit", "buffRemoval"] },
      { hero: "Blackbeard", roles: ["crit", "healIfCrit"] },
      { hero: "Spartacus", roles: ["crit", "healBlock"] },
      { hero: "Caesar", variant: "withoutNidhogg", roles: ["pursuit"] },
      { hero: "Heracles", roles: ["buffRemoval"] },
      { hero: "Billy the Kid", roles: ["pursuit"] },
      { hero: "William Shakespeare", roles: ["pursuit", "rngHeal"] },
      { hero: "Morgana", roles: ["collectionDenial"] },
      { hero: "Cleopatra", roles: ["silence"] },
      { hero: "Charles Darwin", roles: ["critBuff"] },
      { hero: "Tesla", roles: ["deathImmunity"] },
      { hero: "Hammurabi", roles: ["silence"] },
      { hero: "Gilgamesh", roles: ["defDebuff"] },
    ],
  },
  {
    tier: "B",
    entries: [
      { hero: "Newton", roles: ["buff", "rngCritBuff"] },
      { hero: "Napoleon", roles: ["pursuit"] },
      { hero: "Charles the Great", roles: ["atkDebuff"] },
      { hero: "Ragnar", variant: "beforeDay70", roles: [], linker: true },
      { hero: "Franklin", roles: ["healBuff"] },
      { hero: "Hermes", roles: ["rngDodge"] },
      { hero: "Richard I", roles: ["dot", "rngDotBuff"] },
      { hero: "Alfred I", roles: ["dot"] },
      { hero: "Michelangelo", roles: ["shield"] },
      { hero: "Livia", roles: ["healReduction"] },
      { hero: "Confucius", roles: ["dotHeal"] },
      { hero: "Eleanor of Aquitaine", roles: ["heal"] },
      { hero: "Hector", roles: ["dot"] },
      { hero: "Beethoven", roles: ["defDebuff", "rngBuffRemoval"] },
      { hero: "Galileo Galilei", roles: ["pursuit"] },
    ],
  },
  {
    tier: "C",
    entries: [
      { hero: "Augustus", roles: ["pursuit"] },
      { hero: "Alexander the Great", roles: ["pursuit"] },
      { hero: "Dante", roles: ["rngDebuffImmunity"] },
      { hero: "Socrates", roles: ["defBuff"] },
      { hero: "Wallace", roles: ["heal"] },
      { hero: "Noah", roles: ["heal"] },
      { hero: "Prometheus", roles: ["atkBuff"] },
      { hero: "Homer", roles: ["rngBuffRemoval"] },
      { hero: "Hypatia", roles: ["defDebuff"] },
      { hero: "Adam", roles: ["defDebuff"] },
      { hero: "Hatshepsut", roles: ["noEnemyBuffs"] },
      { hero: "Hannibal", roles: ["dot"] },
      { hero: "Saladin", roles: ["crit"] },
      { hero: "Catherine de Medici", roles: ["crit"] },
      { hero: "Isabella I", roles: ["pursuit"] },
      { hero: "Mary I", roles: ["pursuit"] },
      { hero: "Elizabeth I", roles: ["pursuit"] },
      { hero: "Cu Chulainn", roles: ["crit"], note: "cuChulainn" },
    ],
  },
  {
    tier: "D",
    entries: [
      { hero: "Victor Hugo", roles: ["heal"] },
      { hero: "Thomas Edison", roles: ["rngDebuffImmunity"] },
      { hero: "James Watt", roles: ["atkDebuff"] },
      { hero: "Andersen", roles: ["dot"] },
      { hero: "Drake", roles: ["crit"] },
      { hero: "Himiko", roles: ["dot"] },
      { hero: "Florence Nightingale", roles: ["dot"] },
      { hero: "Robin Hood", roles: ["pursuit"] },
      { hero: "Mary Shelley", roles: ["atkDebuff"] },
      { hero: "Chaucer", roles: ["atkDebuff"] },
      { hero: "Anne Bonny", roles: ["atkBuff"] },
      { hero: "Alexander Hamilton", roles: ["atkBuff"] },
      { hero: "Dido", roles: ["defDebuff"] },
      { hero: "Marco Polo", roles: ["defBuff"] },
      { hero: "Archimedes", roles: ["dot"] },
      { hero: "Cervantes", roles: ["heal"] },
    ],
  },
];

export const UTILITY_TIERS: readonly TierRow<UtilityEntry>[] = [
  {
    tier: "SS",
    entries: [
      { hero: "William Shakespeare", effect: "researchTime6" },
      { hero: "Hammurabi", effect: "buildingCost6" },
    ],
  },
  {
    tier: "S",
    entries: [
      { hero: "Billy the Kid", effect: "allHeroesDamage6" },
      { hero: "King Arthur", effect: "allHeroesDamage6" },
      { hero: "Pompey", effect: "allHeroesReduction6" },
      { hero: "Lagertha", effect: "allHeroesReduction6" },
      { hero: "Achilles", effect: "mysticTowerDamage12", note: "achillesEarly" },
      { hero: "Alfred I", effect: "mysticTowerDamage12" },
      { hero: "Hector", effect: "mysticTowerTaken12" },
      { hero: "Eleanor of Aquitaine", effect: "offlineResources", situational: true, note: "eleanorOffline" },
      { hero: "Tesla", effect: "productionBuildings6" },
      { hero: "Socrates", effect: "allBuildings6" },
    ],
  },
  {
    tier: "A",
    entries: [
      { hero: "Caesar", effect: "romeNileSoldierCap30" },
      { hero: "Odysseus", effect: "atlantisEndlessPoints4" },
      { hero: "Heracles", effect: "atlantisPvpDamage12" },
      { hero: "Circe", effect: "atlantisEndless12" },
      { hero: "Ragnar", effect: "odinDamage12" },
      { hero: "Gawain", effect: "grailPower12" },
      { hero: "Napoleon", effect: "supplyReformSupply4" },
      { hero: "Newton", effect: "lifeLabEggs4" },
      { hero: "Lu Bu", effect: "greatFloodPoints4" },
      { hero: "Guan Yu", effect: "mushroomPoints4" },
      { hero: "Sun-Sin", effect: "supplyReformPoints4" },
      { hero: "Musashi", effect: "lifeLabPoints4" },
      { hero: "Dante", effect: "merchantSeaGold6" },
      { hero: "Galileo Galilei", effect: "researchCost6", note: "galileoLater" },
      { hero: "Louis XIV", effect: "merchantSeaGold6" },
      { hero: "Charles Darwin", effect: "civEvolutionPoints4" },
    ],
  },
  {
    tier: "B",
    entries: [
      { hero: "Spartacus", effect: "imperialInvasionSkill12" },
      { hero: "Da Vinci", effect: "bazaarGold3" },
      { hero: "Queen Victoria", effect: "merchantSeaStamina4" },
      { hero: "Alexander the Great", effect: "campaignLand6", note: "earlyGame" },
      { hero: "Livia", effect: "bazaarBoothSales6" },
      { hero: "Franklin", effect: "bazaarBoothSales6" },
    ],
  },
  {
    tier: "C",
    entries: [
      { hero: "Hermes", effect: "roadToCupStats5" },
      { hero: "Cleopatra", effect: "nileSoldierCap30", note: "cleopatraNile" },
      { hero: "Joan of Arc", effect: "campaignDamage12" },
      { hero: "Blackbeard", effect: "guildExpeditionStrength4" },
      { hero: "Augustus", effect: "guildBossDamage12" },
      { hero: "Alexander the Great", effect: "campaignLand6", note: "midGameOn" },
      { hero: "Merlin", effect: "duelReduction6" },
      { hero: "Bjorn", effect: "duelDamage12" },
      { hero: "Morgana", effect: "astralDamage12" },
      { hero: "Gilgamesh", effect: "recruitCost6", note: "gilgameshLate" },
      { hero: "Confucius", effect: "museionStats4" },
      { hero: "Beethoven", effect: "arenaReduction6" },
      { hero: "Columbus", effect: "expeditionGuildXp6" },
      { hero: "Lancelot", effect: "arthurAtk15" },
      { hero: "Guinevere", effect: "arthurHp15" },
    ],
  },
  {
    tier: "D",
    entries: [
      { hero: "Tutankhamen", effect: "crownGloryFortune10" },
      { hero: "Richard I", effect: "knightsAscentReduction12" },
      { hero: "Charles the Great", effect: "knightsAscentDamage12" },
      { hero: "Michelangelo", effect: "guildBossReduction12" },
    ],
  },
];

export type ProductivityRow = { tier: TierId; groups: readonly ProductivityGroup[] };

export const PRODUCTIVITY_TIERS: readonly ProductivityRow[] = [
  {
    tier: "S",
    groups: [
      {
        resource: "universal",
        entries: [
          { hero: "Hermes", bonus: [40] },
          { hero: "Guan Yu", bonus: [40] },
          { hero: "Lu Bu", bonus: [40] },
          { hero: "Musashi", bonus: [40] },
          { hero: "Sun-Sin", bonus: [40] },
          { hero: "Merlin", bonus: [40] },
          { hero: "Billy the Kid", bonus: [40] },
          { hero: "Morgana", bonus: [40] },
          { hero: "Cleopatra", bonus: [40] },
          { hero: "Circe", bonus: [40] },
        ],
      },
    ],
  },
  {
    tier: "A",
    groups: [
      { resource: "wood", entries: [{ hero: "Tutankhamen", bonus: [40] }, { hero: "Eleanor of Aquitaine", bonus: [30] }, { hero: "Prometheus", bonus: [20] }, { hero: "Cu Chulainn", bonus: [10] }] },
      { resource: "stone", entries: [{ hero: "Augustus", bonus: [40] }, { hero: "Michelangelo", bonus: [30] }, { hero: "Noah", bonus: [20] }, { hero: "Archimedes", bonus: [10] }] },
      { resource: "copper", entries: [{ hero: "Gilgamesh", bonus: [30] }, { hero: "Livia", bonus: [30] }, { hero: "Hannibal", bonus: [20] }, { hero: "Hatshepsut", bonus: [20] }] },
      { resource: "iron", entries: [{ hero: "Alexander the Great", bonus: [40] }, { hero: "Joan of Arc", bonus: [30, 40], note: "joanRarity" }, { hero: "Lancelot", bonus: [40] }, { hero: "Saladin", bonus: [20] }] },
      { resource: "leather", entries: [{ hero: "Spartacus", bonus: [40] }, { hero: "Gawain", bonus: [40] }, { hero: "Wallace", bonus: [20] }, { hero: "Robin Hood", bonus: [10] }] },
      { resource: "paper", entries: [{ hero: "Caesar", bonus: [40] }, { hero: "William Shakespeare", bonus: [40] }, { hero: "Guinevere", bonus: [40] }, { hero: "Dante", bonus: [30] }] },
      { resource: "steel", entries: [{ hero: "Napoleon", bonus: [40] }, { hero: "Newton", bonus: [40] }, { hero: "Beethoven", bonus: [30] }, { hero: "Alexander Hamilton", bonus: [10] }] },
      { resource: "coal", entries: [{ hero: "Heracles", bonus: [40] }, { hero: "Queen Victoria", bonus: [40] }, { hero: "James Watt", bonus: [20] }] },
      { resource: "precisionParts", entries: [{ hero: "Tesla", bonus: [30] }, { hero: "Franklin", bonus: [30] }, { hero: "Thomas Edison", bonus: [20] }, { hero: "Florence Nightingale", bonus: [10] }] },
    ],
  },
  {
    tier: "B",
    groups: [
      { resource: "food", entries: [{ hero: "Charles the Great", bonus: [40] }, { hero: "Hammurabi", bonus: [30] }, { hero: "Adam", bonus: [20] }, { hero: "Himiko", bonus: [10] }] },
      { resource: "horses", entries: [{ hero: "Achilles", bonus: [40] }, { hero: "Hector", bonus: [30] }, { hero: "Alfred I", bonus: [30] }, { hero: "Hypatia", bonus: [20] }] },
      { resource: "gunpowder", entries: [{ hero: "Blackbeard", bonus: [40] }, { hero: "Elizabeth I", bonus: [20] }, { hero: "Drake", bonus: [20] }, { hero: "Anne Bonny", bonus: [10] }] },
      { resource: "lemons", entries: [{ hero: "Odysseus", bonus: [40] }, { hero: "Lagertha", bonus: [40] }, { hero: "Columbus", bonus: [30] }, { hero: "Charles Darwin", bonus: [30] }] },
      { resource: "coffee", entries: [{ hero: "Louis XIV", bonus: [30] }, { hero: "Andersen", bonus: [20] }, { hero: "Victor Hugo", bonus: [20] }, { hero: "Mary Shelley", bonus: [10] }] },
    ],
  },
  {
    tier: "C",
    groups: [
      { resource: "cloth", entries: [{ hero: "Confucius", bonus: [30] }, { hero: "Catherine de Medici", bonus: [20] }, { hero: "Isabella I", bonus: [20] }, { hero: "Marco Polo", bonus: [10] }] },
      { resource: "alcohol", entries: [{ hero: "Ragnar", bonus: [40] }, { hero: "Richard I", bonus: [40] }, { hero: "Socrates", bonus: [30] }, { hero: "Chaucer", bonus: [10] }] },
      { resource: "glass", entries: [{ hero: "King Arthur", bonus: [40] }, { hero: "Galileo Galilei", bonus: [30] }, { hero: "Mary I", bonus: [20] }, { hero: "Dido", bonus: [10] }] },
      { resource: "artWorkshop", entries: [{ hero: "Pompey", bonus: [40] }, { hero: "Da Vinci", bonus: [40] }, { hero: "Homer", bonus: [20] }, { hero: "Cervantes", bonus: [10] }] },
    ],
  },
  { tier: "D", groups: [] },
];

/** Lower-case, accent-free text for the hero filter. */
export function searchable(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}

export function matchesHero(hero: string, query: string): boolean {
  const needle = searchable(query);
  return needle === "" || searchable(hero).includes(needle);
}
