/**
 * Autumn's hero and Collection recommendations for the four supplied
 * Cryptid Towers. Source: Autumn (Ice, S12), Discord messages dated 21, 25,
 * and 28 September 2026, supplied by the site maintainer. Names, portraits,
 * and item art are resolved from the Core Heroes and Collection catalogues at render
 * time. The shorthand "Mask" is mapped to Golden Mask of Agamemnon and
 * "Wings" to Wings of Icarus; Cerberus follows the canonical Core spelling.
 */
export const CRYPTID_TOWER_BUILDS = [
  {
    id: "pike",
    cryptide: "cerberus",
    turn: 1,
    key: ["achilles", "guan-yu"],
    important: ["mary-i", "louis-xiv", "heracles"],
    positions: {},
    collections: [
      ["model-of-noahs-ark"],
      ["thors-hammer"],
      ["golden-mask-of-agamemnon"],
      ["olympia-olive-wreath", "brutus-dagger"],
      ["holy-hand-grenade"],
      ["galileos-telescope"],
    ],
  },
  {
    id: "archer",
    cryptide: "nidhogg",
    turn: 2,
    key: ["caesar", "miyamoto-musashi", "tutankhamun", "blackbeard", "king-arthur", "dante"],
    important: ["charles-darwin", "adam", "isabella-i"],
    positions: { caesar: "positionOne", "king-arthur": "secondLine" },
    collections: [
      ["model-of-noahs-ark"],
      ["flintstone-pedal-car", "thors-hammer"],
      ["golden-mask-of-agamemnon", "wings-of-icarus"],
      ["brutus-dagger"],
      ["holy-hand-grenade"],
      ["galileos-telescope"],
    ],
  },
  {
    id: "shield",
    cryptide: "caladrius",
    turn: 1,
    key: ["odysseus", "yi-sun-sin", "lagertha", "spartacus", "circe"],
    important: ["isaac-newton", "da-vinci", "franklin", "hermes", "andersen", "noah", "wallace", "hammurabi"],
    positions: {},
    collections: [
      ["prometheus-torch", "model-of-noahs-ark"],
      ["thors-hammer"],
      ["golden-mask-of-agamemnon", "wings-of-icarus"],
      ["brutus-dagger", "olympia-olive-wreath"],
      ["notre-dame-de-paris-replica", "holy-hand-grenade"],
      ["galileos-telescope"],
    ],
  },
  {
    id: "cavalry",
    cryptide: "sleipnir",
    turn: 2,
    key: ["joan-of-arc", "lancelot", "billy-the-kid", "pompey", "lu-bu", "morgana", "merlin"],
    important: ["queen-victoria", "richard-i"],
    positions: {},
    collections: [
      ["model-of-noahs-ark"],
      ["thors-hammer"],
      ["golden-mask-of-agamemnon", "wings-of-icarus"],
      ["olympia-olive-wreath"],
      ["holy-hand-grenade"],
      ["galileos-telescope"],
    ],
  },
] as const;

export type CryptidTowerBuildId = (typeof CRYPTID_TOWER_BUILDS)[number]["id"];
