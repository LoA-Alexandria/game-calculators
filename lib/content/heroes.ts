/**
 * Hero roster from the community wiki rarity pages (UR+ / UR / SSR / SR / R
 * "Hereos" slugs) as of 13 September 2026, plus in-game skill text for Merlin,
 * Morgana, Cleopatra, Heracles, Lagertha, Circe, and Bjorn Ironside from
 * screenshots the same day. No official artwork is stored here.
 *
 * Empty `skills` means the wiki card had no ability text yet. Do not invent it.
 * The fragment table is copied as printed on every rarity page (identical).
 */

export const HERO_RARITIES = ["UR+", "UR", "SSR", "SR", "R"] as const;
export type HeroRarity = (typeof HERO_RARITIES)[number];

export type HeroSkill = {
  name: string;
  text: string;
};

export type Hero = {
  id: string;
  name: string;
  rarity: HeroRarity;
  obtain: string;
  skills: HeroSkill[];
  artifact?: HeroSkill;
};

export const HERO_FRAGMENT_KEYS = [
  "green",
  "blue",
  "purple",
  "gold",
  "red",
  "goldShiny",
  "blueShiny",
  "shiny",
] as const;

export type HeroFragmentKey = (typeof HERO_FRAGMENT_KEYS)[number];

export const HERO_STAR_COSTS: { star: number; costs: number[] }[] = [
  { star: 1, costs: [25, 50, 100, 100, 200, 300, 400, 500] },
  { star: 2, costs: [25, 50, 100, 200, 200, 300, 400, 500] },
  { star: 3, costs: [25, 100, 100, 200, 300, 300, 400, 500] },
  { star: 4, costs: [25, 100, 100, 200, 300, 400, 400, 500] },
  { star: 5, costs: [50, 100, 100, 200, 300, 400, 500, 600] },
];

function idFor(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pending(rarity: HeroRarity, rows: [string, string?][]): Hero[] {
  return rows.map(([name, obtain = ""]) => ({
    id: idFor(name),
    name,
    rarity,
    obtain,
    skills: [],
  }));
}

export const HEROES: Hero[] = [
  {
    id: "hermes",
    name: "Hermes",
    rarity: "UR+",
    obtain: "Tap Football",
    skills: [
      {
        name: "Clinical Finish",
        text: "40% chance: deal 200% ATK damage, apply [Sprint] to allies for 3 turns (30% chance to dodge enemy skills; targeted skill damage/effects do not trigger).",
      },
      { name: "Divine Power", text: "All allies' attributes +5% in Road to the Cup." },
      { name: "Universal Mastery", text: "Assign to any building for Resource Productivity +40%." },
    ],
  },
  {
    id: "merlin",
    name: "Merlin",
    rarity: "UR+",
    obtain: "",
    skills: [
      {
        name: "Ice Dragon's Breath",
        text: "40% chance to activate: Merlin's dragon companion exhales a freezing breath, dealing skill damage equal to 200% of ATK and applying [Shield Break] to allies (40% of skill damage and extra damage dealt by allies ignores the target's shield for 3 turns). If the enemy has a shield, deals 1 instance of extra damage equal to 150% of ATK.",
      },
    ],
  },
  {
    id: "heracles",
    name: "Heracles",
    rarity: "UR+",
    obtain: "",
    skills: [
      {
        name: "Atlas Strength Lv. 1",
        text: "40% chance to activate: Heracles exerts his full strength for a desperate strike, dealing skill damage equal to 200% of ATK. Removes 1 buff from the enemies. If allies have more buffs than enemies, deals 1 extra damage equal to 100% of ATK.",
      },
      {
        name: "Atlas Strength Lv. 2",
        text: "40% chance to activate: Heracles exerts his full strength for a desperate strike, dealing skill damage equal to 210% of ATK. Removes 1 buff from the enemies. If allies have more buffs than enemies, deals 1 extra damage equal to 105% of ATK.",
      },
      {
        name: "Atlas Strength Lv. 3",
        text: "Activates at 10-Star. 40% chance to activate: Heracles exerts his full strength for a desperate strike, dealing skill damage equal to 220% of ATK. Removes 1 buff from the enemies. If allies have more buffs than enemies, deals 1 extra damage.",
      },
    ],
  },
  {
    id: "circe",
    name: "Circe",
    rarity: "UR+",
    obtain: "",
    skills: [
      {
        name: "Animal Companion",
        text: "40% chance to activate: Circe commands her animal companion to attack, dealing skill damage equal to 200% of ATK and applying [Curse Kill] to enemies. While this state lasts, if the target's HP falls below 10% after taking damage, they die instantly; revival, death immunity, and similar effects cannot trigger.",
      },
    ],
  },
  {
    id: "lancelot",
    name: "Lancelot",
    rarity: "UR+",
    obtain: "Deep into Atlantis",
    skills: [],
  },
  {
    id: "king-arthur",
    name: "King Arthur",
    rarity: "UR+",
    obtain: "Deep into Atlantis",
    skills: [
      {
        name: "Excalibur",
        text: "40% chance: deal 200% ATK, allies' Skill Damage Reduction +20% for 3 turns. Enemies enter [Rend] (before acting, take DoT equal to 75% of allies' ATK for 3 turns).",
      },
      { name: "Knight King", text: "All ATK damage +6% in any hero battle." },
      { name: "Glass Mastery", text: "Glass Workshop Resource Productivity +40%." },
    ],
  },
  {
    id: "odysseus",
    name: "Odysseus",
    rarity: "UR+",
    obtain: "Deep into Atlantis",
    skills: [
      {
        name: "Leviathan's Might",
        text: "40% chance: deal 200% ATK damage. Inflicts [Rend] (DoT 75% ATK for 3 turns). Allies heal 50% of total DoT taken by enemies.",
      },
      { name: "Talent of Guile", text: "Gain +4% points in Delve into Atlantis." },
      { name: "Plantation Mastery", text: "Plantation Resource Productivity +44%." },
    ],
    artifact: {
      name: "Aeolus's Bag of Winds",
      text: "For 3 turns after casting a skill, Odysseus heals allies for 50% of the damage dealt by enemies at the end of their action.",
    },
  },
  {
    id: "bjorn-ironside",
    name: "Bjorn Ironside",
    rarity: "UR+",
    obtain: "The eve of Ragnarok",
    skills: [
      {
        name: "Straight Punch",
        text: "40% chance to activate: Bjorn targets the enemy's weak point and strikes with his iron fist, dealing skill damage equal to 200% of ATK. Increases allied Crit DMG by 20% for 3 turns. This attack has a 50% chance to trigger [Critical Hit], increasing this instance of damage by 50%. If the target has a shield, this attack is guaranteed to trigger [Critical Hit].",
      },
    ],
  },
  {
    id: "ragnar-lodbrok",
    name: "Ragnar Lodbrok",
    rarity: "UR+",
    obtain: "The eve of Ragnarok",
    skills: [
      {
        name: "Viking Raid",
        text: "40% chance: deal 200% ATK damage, reduce enemies' skill damage bonus by 20% for 2 turns, 50% chance to apply [Plunder] (for 3 turns, any buff gained by target transfers to allies while retaining its status).",
      },
      { name: "Valhalla Summon", text: "Ally damage dealt +12% in Trials of Odin." },
      { name: "Brewing Mastery", text: "Brewery Resource Productivity +40%." },
    ],
  },
  {
    id: "lagertha",
    name: "Lagertha",
    rarity: "UR+",
    obtain: "The eve of Ragnarok",
    skills: [
      {
        name: "Arctic Charge Lv. 1",
        text: "40% chance to activate: Lagertha orders her companions to charge the enemy, dealing skill damage equal to 200% of ATK. This action has a 50% chance to trigger a [Critical Hit] (+50% DMG). At the end of this action, allies recover HP equal to 50% of the damage dealt.",
      },
      {
        name: "Arctic Charge Lv. 2",
        text: "40% chance to activate: Lagertha orders her companions to charge the enemy, dealing skill damage equal to 210% of ATK. This action has a 53% chance to trigger a [Critical Hit] (+50% DMG). At the end of this action, allies recover HP equal to 53% of the damage dealt.",
      },
      {
        name: "Arctic Charge Lv. 3",
        text: "Activates at 10-Star. 40% chance to activate: Lagertha orders her companions to charge the enemy, dealing skill damage equal to 220% of ATK.",
      },
    ],
  },
  {
    id: "pompey",
    name: "Pompey",
    rarity: "UR+",
    obtain: "Dawn of Rome",
    skills: [
      {
        name: "Master of Three Seas",
        text: "40% chance: deal 200% ATK, heal allies for 50% of damage dealt, 50% chance for [Barrier] (Immune to all damage for 1 turn).",
      },
      { name: "Uncrowned One", text: "All Heroes Damage Reduction +8%." },
      { name: "Creation Mastery", text: "Art Workshop Resource Productivity +52%." },
    ],
    artifact: {
      name: "Eagle Scepter",
      text: "After Pompey casts a skill, if his HP is above 50%, increases allies' skill damage bonus by 20% for 3 turns. If his HP is 50% or below, recovers HP equal to 10% of allies' Max HP.",
    },
  },
  {
    id: "spartacus",
    name: "Spartacus",
    rarity: "UR+",
    obtain: "Dawn of Rome",
    skills: [
      {
        name: "Oath of the Broken Chain",
        text: "40% chance: deal 200% ATK, 50% chance to trigger [Critical Hit] (+50% DMG). If triggered, 30% chance to apply [Heal Block] (healed HP cannot exceed 1) for 2 turns.",
      },
      { name: "Warrior's Awakening", text: "In Imperial Invasion, Skill Damage Bonus +12%." },
      { name: "Leather Mastery", text: "Tannery Resource Productivity +44%." },
    ],
    artifact: {
      name: "Broken Shackles",
      text: "Before Spartacus casts a skill, increases allies' skill damage bonus by 15%. For each debuff on enemies, allies' skill damage bonus for that turn is further increased by 15%. Stacks up to 2 times.",
    },
  },
  {
    id: "caesar",
    name: "Caesar",
    rarity: "UR+",
    obtain: "Dawn of Rome",
    skills: [
      {
        name: "Cracked Sky Dawn",
        text: "40% chance: deal 200% ATK damage. Triggers [Pursuit] (extra skill cast) dealing 40% ATK damage; trigger chance reduces by 40% each time it repeats.",
      },
      { name: "Conqueror's Will", text: "In Dawn of Rome event, soldiers cap +30%." },
      { name: "Papermaking Mastery", text: "Paper Mill Resource Productivity +44%." },
    ],
    artifact: {
      name: "Golden Throne",
      text: "When Caesar casts a skill, after triggering the 2nd extra ATK, increases allies' skill damage bonus by 10% and extra damage bonus by 50% for 3 turns.",
    },
  },
  {
    id: "cleopatra",
    name: "Cleopatra",
    rarity: "UR+",
    obtain: "",
    skills: [
      {
        name: "Majesty of the Royal Tomb Lv. 2",
        text: "40% chance to activate: Cleopatra proclaims the inviolable majesty of the royal tomb, dealing damage equal to 210% of ATK, and modifies the enemy's next action, replacing it with 1 Normal Attack by allies against them that deals 55% of Normal Attack damage.",
      },
    ],
  },
  {
    id: "morgana",
    name: "Morgana",
    rarity: "UR",
    obtain: "",
    skills: [
      {
        name: "Soul Chain",
        text: "40% chance to activate: Morgana conjures magical chains to bind the enemy, dealing skill damage equal to 200% of ATK, with a 50% chance to inflict [Strip] for 2 turns. [Strip]: While this state lasts, all collection skills except exclusive collection cannot trigger.",
      },
    ],
  },
  ...pending("UR", [
    ["Guinevere"],
    ["Garwain"],
    ["Queen Victoria"],
    ["Napoleon Bonaparte"],
    ["Isaac Newton"],
    ["Blackbeard"],
    ["Charles the Great"],
    ["Achilles"],
    ["William Shakespeare"],
    ["Tutankhamun"],
    ["Da Vinci"],
    ["Richard I"],
  ]),
  ...pending("SSR", [
    ["Beethoven"],
    ["Charles Darwin"],
    ["Nikola Tesla"],
    ["Franklin"],
    ["Louis XIV"],
    ["Columbus"],
    ["Alfred the Great"],
    ["Galileo Galilei"],
    ["Eleanor of Aquitaine"],
    ["Hector"],
    ["Hammurabi"],
    ["Joan of Arc"],
    ["Livia Drusilla"],
    ["Dante"],
    ["Socrates"],
    ["Gilgamesh"],
    ["Confucius"],
    ["Michelangelo"],
  ]),
  ...pending("SR", [
    ["Victor Hugo"],
    ["Thomas Edison"],
    ["James Watt"],
    ["Andersen"],
    ["Elizabeth I"],
    ["Drake"],
    ["Mary I"],
    ["Saladin"],
    ["Homer"],
    ["Wallace"],
    ["Isabella I"],
    ["Hatshepsut"],
    ["Hypatia"],
    ["Hannibal"],
    ["Catherine de'Medici"],
    ["Noah"],
    ["Adam"],
    ["Prometheus"],
  ]),
  ...pending("R", [
    ["Florence Nightingale"],
    ["Mary Shelley"],
    ["Alexander Hamilton"],
    ["Anne Bonny"],
    ["Chaucer"],
    ["Robin Hood"],
    ["Himiko"],
    ["Marco Polo"],
    ["Cervantes"],
    ["Dido"],
    ["Cu Chulainn"],
    ["Archimedes"],
  ]),
];

export function heroesByRarity(rarity: HeroRarity | "all"): Hero[] {
  if (rarity === "all") return HEROES;
  return HEROES.filter((hero) => hero.rarity === rarity);
}

export function searchHeroes(query: string, rarity: HeroRarity | "all"): Hero[] {
  const needle = query.trim().toLowerCase();
  const pool = heroesByRarity(rarity);
  if (!needle) return pool;
  return pool.filter((hero) => {
    const hay = [hero.name, hero.obtain, ...hero.skills.map((skill) => `${skill.name} ${skill.text}`), hero.artifact?.name ?? "", hero.artifact?.text ?? ""]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}
