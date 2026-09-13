/**
 * Painting sets from Autumn (Ice, S12) on Discord, 4 September 2026.
 * Short Discord names are expanded to the Heroes roster spelling where the
 * match is unambiguous. Incomplete lines are stored as printed: missing heroes
 * and stats are omitted, not invented.
 */

export const PAINTING_RARITIES = ["SSR", "SR", "R"] as const;
export type PaintingRarity = (typeof PAINTING_RARITIES)[number];

export const PAINTING_STATS = ["heroAtk", "heroHp", "allAtk", "allHp", "fs", "res"] as const;
export type PaintingStat = (typeof PAINTING_STATS)[number];

export type Painting = {
  id: string;
  name: string;
  heroes: string[];
  stats: readonly PaintingStat[];
  starStats?: readonly PaintingStat[];
  productivity: string;
};

export type PaintingSet = {
  id: string;
  name: string;
  rarity: PaintingRarity;
  effect: string;
  paintings: Painting[];
};

function idFor(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function painting(
  name: string,
  heroes: string[],
  stats: readonly PaintingStat[],
  productivity = "",
  starStats?: readonly PaintingStat[],
): Painting {
  return { id: idFor(name), name, heroes, stats, productivity, starStats };
}

function set(
  name: string,
  rarity: PaintingRarity,
  effect: string,
  paintings: Painting[],
): PaintingSet {
  return { id: idFor(name), name, rarity, effect, paintings };
}

const AH = ["allAtk", "heroAtk"] as const satisfies PaintingStat[];
const HA = ["heroAtk", "allAtk"] as const satisfies PaintingStat[];
const HP = ["allHp", "heroHp"] as const satisfies PaintingStat[];
const ALL = ["allHp", "allAtk"] as const satisfies PaintingStat[];
const ATA = ["allAtk", "allHp"] as const satisfies PaintingStat[];

export const PAINTING_SETS: PaintingSet[] = [
  set("Glory and Shadow", "SSR", "At battle start, gains 10% of max HP as a shield.", [
    painting("The Coronation of Napoleon", ["Napoleon Bonaparte", "Augustus", "Livia Drusilla", "Louis XIV"], ["heroAtk", "allAtk", "res"], "Glass"),
    painting("Napoleon Crossing The Alps", ["Napoleon Bonaparte", "Alexander the Great", "Dante", "Louis XIV"], ["heroHp", "allHp", "fs"], "Paper Mill"),
    painting("The Third of May 1808", ["Napoleon Bonaparte", "Joan of Arc", "Gawain", "Galileo Galilei"], ["heroAtk", "allAtk", "res"], "Art Workshop"),
  ]),
  set("Self-Portrait", "SSR", "Each time an ally deals skill or extra damage, Extra damage bonus +10% for 1 turn.", [
    painting("Self-Portrait", ["Da Vinci", "Michelangelo", "Galileo Galilei", "Richard I"], ["heroHp", "allHp", "fs"], "Horses"),
    painting("Self-Portrait with Fur-Trimmed Robe", ["Michelangelo", "Da Vinci", "Queen Victoria", "Hammurabi"], ["heroAtk", "res", "allAtk"], "Alcohol"),
    painting("Self-Portrait with Damaged Ear", ["Beethoven", "Tutankhamun", "Charles the Great", "Alfred the Great"], ["heroHp", "allHp", "fs"], "Leather"),
  ]),
  set("Nature in Bloom", "SSR", "On crit hit, allies' crit damage increases by extra 5–50%.", [
    painting("Almond Bloom", ["Charles Darwin", "Achilles", "Alexander the Great", "Hammurabi"], [...AH, "res"], "Copper"),
    painting("Irises", ["Charles Darwin", "Blackbeard", "Achilles", "Gilgamesh"], [...HP, "fs"], "Cloth"),
    painting("Water Lilies", ["Charles Darwin", "Confucius", "Napoleon Bonaparte", "Achilles"], [...AH, "res"], "Iron"),
  ]),
  set("Urban Proletariat", "SSR", "For the first 3 turns of battle, DoT damage +12% until battle ends.", [
    painting("The Gleaners", ["Confucius", "Richard I", "Isaac Newton", "Hector"], [...HP, "fs"], "Wood"),
    painting("The Floor Scrapers", ["Da Vinci", "Franklin", "Alexander the Great", "Joan of Arc"], [...AH, "res"], "Food"),
    painting("The Stone Breakers", ["Queen Victoria", "Richard I", "Franklin", "Alfred the Great"], [...HP, "fs"], "Stone"),
  ]),
  set("Rococo Curtain", "SSR", "First skill damage an ally takes each turn is reduced by 20%.", [
    painting("Madame de Pompadour", ["Louis XIV", "Achilles", "Augustus", "Gilgamesh"], [...HA, "res"], "Coffee Beans"),
    painting("The Swing", ["Louis XIV", "Eleanor of Aquitaine", "Tutankhamun", "Augustus"], [...HP, "fs"], "Coal"),
    painting("The Embarkation for Cythera", ["Blackbeard", "Da Vinci", "Michelangelo", "Dante"], [...HA, "res"], "Precision Parts"),
  ]),
  set("Chinese Landscape", "SSR", "Every 2 turns (if not Sealed), 15% chance to dispel 1 debuff from an ally.", [
    painting("A Thousand Li of Rivers and Mountains", ["Confucius", "Tutankhamun", "Achilles", "Joan of Arc"], [...HP, "fs"], "Steel"),
    painting("Dwelling in the Fuchun Mountains", ["Confucius", "Gawain", "Alexander the Great", "Galileo Galilei"], [...AH, "res"], "Gunpowder"),
    painting("Travelers Among Mountains and Streams", ["Morgana", "Augustus", "Franklin", "Alfred the Great"], [...HP, "fs"], "Lemons"),
  ]),
  set("Ukiya-e Masterpieces", "SSR", "Allies' Final Damage Reduction +12% until battle ends.", [
    painting("The Great Wave of Kanagawa", ["Charles the Great", "Augustus", "Columbus", "Hector"], [...AH, "res"], "Glass"),
    painting("Kabuki Actor", ["Charles the Great", "Napoleon Bonaparte", "Hector", "Dante"], [...HP, "fs"], "Paper"),
    painting("Three Beauties of the Present Day", ["Blackbeard", "Richard I", "Eleanor of Aquitaine", "Gilgamesh"], [...AH, "res"], "Art Workshop"),
  ]),
  set("Tragic Maiden", "SSR", "Allies' Final Damage Bonus +12% until battle ends.", [
    painting("Ophelia", ["William Shakespeare", "Guinevere", "Columbus", "Socrates"], [...HP, "fs"], "Horses"),
    painting("The Lady of Shalott", ["Gawain", "Morgana", "Socrates", "Nikola Tesla"], [...AH, "res"], "Alcohol"),
    painting("Romeo and Juliet", ["William Shakespeare", "Eleanor of Aquitaine", "Guinevere", "Livia Drusilla"], [...HP, "fs"], "Leather"),
  ]),
  set("Modernist New Voice", "SSR", "Collection and Cryptid Damage Reduction +12% until battle ends.", [
    painting("Composition", ["Da Vinci", "Nikola Tesla", "Beethoven", "Richard I"], [...AH, "res"], "Copper"),
    painting("Dance", ["Beethoven", "Guinevere", "Charles the Great", "Socrates"], [...HP, "fs"], "Cloth"),
    painting("Composition VIII", ["Beethoven", "Nikola Tesla", "Isaac Newton", "Blackbeard"], [...AH, "res"], "Iron"),
  ]),
  set("Beyond The Earth", "SSR", "Collection and Cryptid Damage Bonus +12% until battle ends.", [
    painting("Buzz Aldrin on the Moon", ["Galileo Galilei", "Isaac Newton", "Nikola Tesla"], [...HP, "fs"], "Wood"),
    painting("Earthrise", ["Charles Darwin", "Columbus", "Morgana", "Charles the Great"], [...AH, "res"], "Food"),
    painting("Pale Blue Dot", ["Galileo Galilei", "Isaac Newton", "Confucius", "Richard I"], [...HP, "fs"], "Stone"),
  ]),
  set("Sheltered by Night", "SR", "Every 3 turns, when an ally acts, Extra Damage Reduction +5% for 2 turns.", [
    painting("Nightshade", ["Thomas Edison", "Nikola Tesla", "Napoleon Bonaparte", "Elizabeth I"], [...AH, "heroHp"], "Glass"),
    painting("Cafe Terrace at Night", ["Thomas Edison", "Beethoven", "Andersen", "Gawain"], ["allHp"]),
    painting("Evening on Karl Johan St", ["Dante", "Morgana", "Mary I", "Hatshepsut"], [...AH, "heroHp"], "Art Workshop"),
  ]),
  set("Impression: Warmth", "SR", "Every 3 turns, when an ally acts, Extra Damage Bonus +5% for 2 turns.", [
    painting("The Umbrellas", ["Queen Victoria", "Elizabeth I", "Hammurabi", "Isabella I"], ["allHp"]),
    painting("The Dance Class", ["Louis XIV", "Queen Victoria", "Drake", "Saladin"], [...AH, "heroHp"], "Alcohol"),
    painting("Luncheon of the Boating Party", ["Franklin", "Queen Victoria", "Andersen", "Hypatia"], [...HP, "heroAtk"], "Leather"),
  ]),
  set("Roar of Steam", "SR", "Every 3 turns, when an ally acts, DoT Damage Reduction +5% for 2 turns.", [
    painting("Rain, Steam and Speed", ["James Watt", "Queen Victoria", "Nikola Tesla", "Thomas Edison"], [...AH, "heroHp"], "Copper"),
    painting("The Gare Saint-Lazare", ["James Watt", "Thomas Edison", "Queen Victoria", "Nikola Tesla"], [...HP, "heroAtk"], "Cloth"),
    painting("The Fighting Temeraire", ["Drake", "Blackbeard", "Columbus", "Noah"], [...AH, "heroHp"], "Iron"),
  ]),
  set("Echoes of Death", "SR", "Every 3 turns, DoT Bonus +5% for 2 turns.", [
    painting("The Death of Socrates", ["Socrates", "Hypatia", "Gawain", "Adam"], [...HP, "heroAtk"], "Wood"),
    painting("The Death of Marat", ["Victor Hugo", "Joan of Arc", "Morgana", "Mary I"], [...AH, "heroHp"], "Food"),
    painting("The Anatomy Lesson", ["Charles Darwin", "Da Vinci", "Hypatia", "Hatshepsut"], [...HP, "heroAtk"], "Stone"),
  ]),
  set("Faithful Companion", "SR", "Every 3 turns if not Sealed, Damage Reduction +5% for 2 turns.", [
    painting("Young Hare", ["Charles Darwin", "Noah", "Achilles", "Hatshepsut"], [...AH, "heroHp"], "Coffee"),
    painting("Friends in Need", ["Blackbeard", "Livia Drusilla", "Homer", "Mary I"], [...HP, "heroAtk"], "Coal"),
    painting("Hall of the Bulls, Lascaux", ["Adam", "Noah", "Gilgamesh", "Guinevere"], [...AH, "heroHp"], "Precision Parts"),
  ]),
  set("Heaven and Earth Surge", "SR", "Every 3 turns if not Sealed, Damage Bonus +5% for 2 turns.", [
    painting("Wanderer above the Sea of Fog", ["Beethoven", "Andersen", "Guinevere", "Elizabeth I"], [...HP, "heroAtk"], "Steel"),
    painting("The Hay Wain", ["James Watt", "Queen Victoria", "Charles Darwin", "Homer"], [...AH, "heroHp"], "Gunpowder"),
    painting("The Oxbow", ["Franklin", "Morgana", "Hannibal", "Drake"], [...HP, "heroAtk"], "Lemons"),
  ]),
  set("Gaze of An Age", "SR", "Every 3 turns if not Sealed, ATK bonus +5% for 2 turns.", [
    painting("Portrait of Charles Darwin", ["Isaac Newton", "Galileo Galilei", "Homer", "Prometheus"], [...AH, "heroHp"], "Glass"),
    painting("Portrait of Oscar Wilde", ["William Shakespeare", "Andersen", "Dante", "Prometheus"], [...HP, "heroAtk"], "Paper"),
    painting("Portrait of Abraham Lincoln", ["Franklin", "Victor Hugo", "Isaac Newton", "Wallace"], [...AH, "heroHp"], "Art Workshop"),
  ]),
  set("Wall of Mosaics", "SR", "Every 4 turns if not Sealed, gains a shield equal to 5% of max HP.", [
    painting("Empress Theodora and her Attendants", ["Hatshepsut", "Tutankhamun", "Livia Drusilla", "Catherine de'Medici"], [...HP, "heroAtk"], "Horses"),
    painting("Alexander Mosaic", ["Alexander the Great", "Hannibal", "Hector", "Wallace"], [...AH], "Alcohol"),
    painting("Madaba Mosaic Map", ["Saladin", "Noah", "Blackbeard", "Hammurabi"], [...HP, "heroAtk"], "Leather"),
  ]),
  set("Sacred Window Radiance", "SR", "Every 4 turns if not Sealed, heals 5% of max HP.", [
    painting("Rose Windows of Notre Dame", ["Victor Hugo", "Charles the Great", "Eleanor of Aquitaine", "Andersen"], [...AH, "heroHp"], "Copper"),
    painting("King's College Chapel", ["Alfred the Great", "Elizabeth I", "Mary I", "Augustus"], [...HP, "heroAtk"], "Cloth"),
    painting("Chartres Cathedral", ["Eleanor of Aquitaine", "Richard I", "Saladin", "Hannibal"], [...AH, "heroHp"], "Iron"),
  ]),
  set("Master's Sketch", "SR", "Every 4 turns if not Sealed, deals skill damage equal to 80% of ATK to the enemy.", [
    painting("Portrait of Isabella d'Este", ["Isabella I", "Catherine de'Medici", "Da Vinci", "Michelangelo"], [...HP, "heroAtk"], "Wood"),
    painting("Lion", ["Gilgamesh", "Tutankhamun", "Wallace", "Isabella I"], [...AH, "heroHp"], "Food"),
    painting("The Resurrection", ["Adam", "Prometheus", "Michelangelo", "William Shakespeare"], [...HP, "heroAtk"], "Stone"),
  ]),
  set("Monkey Society", "R", "At Turn 4, if not Sealed, Skill Damage Reduction +5% for 2 turns.", [
    painting("The Monkey Painter", ["Cervantes", "Saladin", "Mary Shelley"], ["allHp"], "Coal", ALL),
    painting("The Monkey Dentist", ["Florence Nightingale", "Thomas Edison", "Cu Chulainn"], ["allAtk"], "Precision Parts", ALL),
    painting("The Monkey Antiquarian", ["Marco Polo", "Isabella I", "Himiko"], ["allHp"], "Food", ALL),
  ]),
  set("So Delicious", "R", "At Turn 4, if not Sealed, Skill Damage Bonus +5% for 2 turns.", [
    painting("The Ricotta Eaters", ["Chaucer", "Cervantes", "Noah"], ["allHp"], "Steel", ALL),
    painting("The Beaneater", ["Cervantes", "Robin Hood", "Saladin"], ["allAtk"], "Gunpowder", ALL),
    painting("The Fat Kitchen", ["Mary I", "Anne Bonny", "Cu Chulainn"], ["allHp"], "Lemons", ALL),
    painting("The Thin Kitchen", ["Robin Hood", "Wallace", "Florence Nightingale"], ["allAtk"], "Coffee", ALL),
  ]),
  set("Hidden Face", "R", "At Turn 4, if not Sealed, ATK bonus +5% for 2 turns.", [
    painting("The Gardener", ["Mary Shelley", "James Watt", "Florence Nightingale"], ["allHp"], "Leather", ATA),
    painting("The Cook", ["Chaucer", "Catherine de'Medici", "Dido"], ["allAtk"], "Glass", ALL),
    painting("Summer", ["Marco Polo", "Adam", "Alexander Hamilton"], ["allHp"], "Paper", ALL),
    painting("Landscape Shaped Like A Face", ["Archimedes", "Prometheus", "Himiko"], ["allAtk"], "Art Workshop", ALL),
  ]),
  set("Four Seasons Reborn", "R", "At Turn 6, if not Sealed, heals 5% of max HP.", [
    painting("The Four Seasons II: Spring", ["Himiko", "Wallace", "Archimedes"], ["allHp"], "Cloth", ATA),
    painting("The Four Seasons II: Summer", ["Adam", "Anne Bonny", "Robin Hood"], ["allAtk"], "Iron", ALL),
    painting("The Four Seasons II: Autumn", ["Chaucer", "Robin Hood", "Hannibal"], ["allHp"], "Horses", ATA),
    painting("The Four Seasons II: Winter", ["Victor Hugo", "Alexander Hamilton", "Dido"], ["allAtk"], "Alcohol", ALL),
  ]),
  set("Four Seasonal Beauties", "R", "At Turn 6, if not Sealed, deals skill damage equal to 50% of ATK to the enemy.", [
    painting("The Four Seasons I: Spring", ["Catherine de'Medici", "Cervantes", "Chaucer"], ["allHp"], "Wood", ALL),
    painting("The Four Seasons I: Summer", ["Dido", "Hypatia", "Alexander Hamilton"], ["allAtk"], "Food", ALL),
    painting("The Four Seasons I: Autumn", ["Isabella I", "Dido", "Anne Bonny"], ["allHp"], "Stone", ATA),
    painting("The Four Seasons I: Winter", ["Mary Shelley", "Hannibal", "Cu Chulainn"], ["allAtk"], "Copper", ALL),
  ]),
];

/** Short Discord forms that should still match a roster name in the hero filter. */
const HERO_ALIASES: Record<string, string[]> = {
  "Alexander the Great": ["alexander"],
  "Alfred the Great": ["alfred"],
  "Anne Bonny": ["anne bonnie", "annie bonnie"],
  "Catherine de'Medici": ["catherine de medici"],
  "Charles Darwin": ["darwin"],
  "Charles the Great": ["charles"],
  "Eleanor of Aquitaine": ["eleanor"],
  "Elizabeth I": ["elizabeth"],
  "Galileo Galilei": ["galileo"],
  "Gawain": ["garwain"],
  "Hatshepsut": ["hatsheput"],
  "Isaac Newton": ["newton"],
  "Isabella I": ["isabella"],
  "Joan of Arc": ["joan"],
  "Livia Drusilla": ["livia"],
  "Napoleon Bonaparte": ["napoleon"],
  "Nikola Tesla": ["tesla"],
  "Richard I": ["richard"],
  "Thomas Edison": ["edison"],
  "Tutankhamun": ["tut"],
  "Victor Hugo": ["victor huge"],
  "William Shakespeare": ["shakespeare"],
};

function heroHaystack(name: string): string {
  return [name, ...(HERO_ALIASES[name] ?? [])].join(" ").toLowerCase();
}

export function setsByRarity(rarity: PaintingRarity): PaintingSet[] {
  return PAINTING_SETS.filter((entry) => entry.rarity === rarity);
}

export function paintingSetById(id: string): PaintingSet | undefined {
  return PAINTING_SETS.find((entry) => entry.id === id);
}

/**
 * SSR set-skill ranking from Autumn (Ice, S12) on Discord, 4 September 2026.
 * Pursuit and DoT swap the first slot; Hybrid inserts the other damage type
 * between Ukiya-e Masterpieces and Modernist New Voice.
 */
export const SET_SKILL_BUILDS = ["crit", "pursuit", "dot", "hybrid"] as const;
export type SetSkillBuild = (typeof SET_SKILL_BUILDS)[number];

export const SET_SKILL_REASONS = [
  "critBuff",
  "finalDamage",
  "cryptidBonus",
  "dispel",
  "defense",
  "finalReduce",
  "cryptidReduce",
  "shield",
  "extraDamage",
  "dotDamage",
] as const;
export type SetSkillReason = (typeof SET_SKILL_REASONS)[number];

const CRIT_SET_SKILLS = [
  { id: "nature-in-bloom", reason: "critBuff" },
  { id: "tragic-maiden", reason: "finalDamage" },
  { id: "beyond-the-earth", reason: "cryptidBonus" },
  { id: "chinese-landscape", reason: "dispel" },
  { id: "rococo-curtain", reason: "defense" },
  { id: "ukiya-e-masterpieces", reason: "finalReduce" },
  { id: "modernist-new-voice", reason: "cryptidReduce" },
  { id: "glory-and-shadow", reason: "shield" },
] as const satisfies readonly { id: string; reason: SetSkillReason }[];

export type SetSkillRow = {
  set: PaintingSet;
  reason: SetSkillReason;
  hybridSlot: boolean;
};

type SetSkillSeed = { id: string; reason: SetSkillReason };

function leadSwap(id: string, reason: SetSkillReason): SetSkillSeed[] {
  const [, ...rest] = CRIT_SET_SKILLS;
  return [{ id, reason }, ...rest];
}

export function setSkillRank(build: SetSkillBuild): SetSkillRow[] {
  const rows =
    build === "pursuit" ? leadSwap("self-portrait", "extraDamage")
    : build === "dot" ? leadSwap("urban-proletariat", "dotDamage")
    : CRIT_SET_SKILLS;
  return rows.flatMap((row) => {
    const entry = paintingSetById(row.id);
    if (!entry) return [];
    return [{
      set: entry,
      reason: row.reason,
      hybridSlot: build === "hybrid" && row.id === "ukiya-e-masterpieces",
    }];
  });
}

export type PaintingHit = {
  set: PaintingSet;
  painting: Painting;
};

export function searchPaintings(query: string): PaintingHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: PaintingHit[] = [];
  for (const entry of PAINTING_SETS) {
    for (const canvas of entry.paintings) {
      const hay = [
        canvas.name,
        entry.name,
        canvas.productivity,
        ...canvas.heroes.map(heroHaystack),
      ]
        .join(" ")
        .toLowerCase();
      if (hay.includes(needle)) hits.push({ set: entry, painting: canvas });
    }
  }
  return hits;
}

export function paintingsForHero(query: string): PaintingHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: PaintingHit[] = [];
  for (const entry of PAINTING_SETS) {
    for (const canvas of entry.paintings) {
      if (canvas.heroes.some((hero) => heroHaystack(hero).includes(needle))) {
        hits.push({ set: entry, painting: canvas });
      }
    }
  }
  return hits;
}
