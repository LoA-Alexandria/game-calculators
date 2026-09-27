/** Dawn of Rome / Crown of the Nile planning key.
 *  - blue paints → blocked (not clickable)
 *  - red paints → clickable (plain / existing structure groups)
 *  - unpainted hexes → left unchanged from the prior board state
 *  Coordinate-only patch: listed unlocks/blocks, cols 27–28 locked;
 *  column 26 left exactly as on main (no bulk unlock/lock).
 */

export type RomeTileRef = readonly [col: number, row: number];

export const ROME_BLOCKED_TILES: readonly RomeTileRef[] = [[0, 0], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 15], [0, 16], [0, 17], [0, 18], [0, 19], [0, 20], [0, 24], [1, -1], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [1, 11], [1, 12], [1, 13], [1, 14], [1, 15], [1, 16], [1, 17], [1, 18], [1, 19], [1, 20], [1, 21], [1, 22], [1, 23], [1, 24], [1, 25], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 7], [2, 8], [2, 9], [2, 10], [2, 11], [2, 12], [2, 13], [2, 14], [2, 15], [2, 16], [2, 18], [2, 19], [2, 20], [2, 21], [2, 22], [2, 23], [2, 24], [2, 25], [2, 26], [3, -1], [3, 24], [3, 25], [4, 0], [4, 1], [4, 23], [4, 24], [4, 26], [5, -1], [5, 0], [5, 1], [5, 2], [5, 3], [5, 9], [5, 10], [5, 14], [5, 21], [5, 22], [5, 23], [6, 8], [6, 10], [6, 15], [6, 18], [6, 21], [6, 22], [6, 23], [6, 24], [6, 26], [7, 1], [7, 7], [8, 0], [8, 14], [8, 24], [8, 26], [9, -1], [9, 19], [9, 20], [9, 23], [9, 24], [10, 0], [10, 1], [10, 2], [10, 9], [10, 20], [10, 23], [10, 24], [10, 26], [11, -1], [11, 10], [11, 13], [11, 15], [11, 24], [12, 0], [12, 5], [12, 8], [12, 10], [12, 14], [12, 15], [12, 24], [12, 26], [13, -1], [13, 4], [13, 9], [13, 14], [13, 19], [13, 24], [13, 25], [14, 4], [14, 5], [14, 9], [14, 15], [14, 19], [14, 20], [14, 25], [14, 26], [15, 4], [15, 19], [15, 25], [16, 19], [16, 24], [16, 25], [16, 26], [17, -1], [17, 10], [17, 11], [17, 12], [17, 13], [18, 0], [18, 3], [18, 23], [19, -1], [19, 2], [19, 3], [19, 4], [19, 9], [19, 14], [19, 20], [19, 23], [20, 0], [20, 9], [20, 15], [21, 6], [21, 14], [22, 1], [22, 2], [22, 3], [22, 6], [22, 16], [22, 17], [22, 21], [22, 22], [22, 23], [23, -1], [23, 0], [23, 1], [23, 2], [23, 7], [23, 8], [23, 13], [23, 14], [23, 21], [23, 22], [23, 23], [24, 0], [24, 1], [24, 2], [24, 23], [24, 24], [25, -1], [26, 0], [26, 1], [26, 2], [26, 3], [26, 4], [26, 5], [26, 8], [26, 9], [26, 10], [26, 11], [26, 12], [26, 13], [26, 15], [26, 16], [26, 19], [26, 20], [26, 21], [26, 22], [26, 23], [26, 24], [26, 25], [27, 0], [27, 1], [27, 2], [27, 3], [27, 4], [27, 5], [27, 6], [27, 7], [27, 8], [27, 9], [27, 10], [27, 11], [27, 12], [27, 15], [27, 16], [27, 17], [27, 18], [27, 19], [27, 20], [27, 21], [27, 22], [27, 23], [27, 24], [27, 25], [28, 3], [28, 4], [28, 5], [28, 6], [28, 7], [28, 8], [28, 9], [28, 10], [28, 11], [28, 12], [28, 20]] as const;

export const ROME_OUTSIDE_TILES: readonly RomeTileRef[] = [[0, -1], [0, 1], [0, 2], [0, 3], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14], [0, 21], [0, 22], [0, 23], [0, 25], [0, 26], [1, 26], [2, -1], [3, 26], [4, -1], [4, 25], [5, 24], [5, 25], [5, 26], [6, -1], [6, 0], [6, 1], [6, 2], [6, 3], [6, 25], [7, -1], [7, 2], [7, 24], [7, 25], [7, 26], [8, -1], [8, 25], [9, 25], [9, 26], [10, -1], [10, 25], [11, 25], [11, 26], [12, -1], [12, 25], [13, 26], [14, -1], [15, -1], [15, 24], [15, 26], [16, -1], [16, 0], [17, 23], [17, 24], [17, 25], [17, 26], [18, -1], [18, 24], [18, 25], [18, 26], [19, 24], [19, 25], [19, 26], [20, -1], [20, 24], [20, 25], [20, 26], [21, -1], [21, 24], [21, 25], [21, 26], [22, -1], [22, 0], [22, 24], [22, 25], [22, 26], [23, 24], [23, 25], [23, 26], [24, -1], [24, 25], [24, 26], [25, 24], [25, 25], [25, 26], [26, -1], [26, 14], [26, 26], [27, -1], [27, 13], [27, 14], [27, 26], [28, -1], [28, 0], [28, 1], [28, 2], [28, 13], [28, 14], [28, 15], [28, 16], [28, 17], [28, 18], [28, 19], [28, 21], [28, 22], [28, 23], [28, 24], [28, 25], [28, 26]] as const;

/**
 * What stands on the map, and how many hexes each thing covers.
 *
 * The sizes come from the game: Rome 7, a guild outpost 4, a walled city 4, a
 * round city 3, a gate 2, a village 1. The hexes themselves are measured off
 * the artwork — the building's own ink was masked out of
 * `public/guilds/dawn-of-rome.webp`, and each group grown from the hex under
 * the building's centre to whichever neighbour covered most of that ink, so
 * every group is connected and sits on what it names.
 *
 * A structure is one target: painting any of its hexes paints them all.
 */
export type RomeStructureKind = "rome" | "home" | "large" | "medium" | "gate" | "small";

export type RomeStructure = {
  kind: RomeStructureKind;
  tiles: readonly RomeTileRef[];
  /**
   * The place's own name, keyed into `t.guilds.romePlaces`. The game gives
   * these in every client language, so the picture stays wordless and the
   * board writes them. The six outposts have none: a guild holds one and puts
   * its own name on it.
   */
  name?: RomePlaceName;
  /** What Crown of the Nile calls the same place. */
  nileName?: NilePlaceName;
};

export type RomePlaceName =
  | "rome" | "tibur" | "ostia" | "aricia" | "kailey" | "praeneste" | "ardea"
  | "pass" | "sutrium" | "eretum" | "tres" | "ceyni" | "arsium" | "anagni"
  | "laurentum" | "alatri" | "satricum" | "lanuvium" | "cisterna" | "velletri";

export type NilePlaceName =
  | "alexandria" | "naukratis" | "plinthine" | "sebennpolis" | "schedia" | "buto"
  | "bubastis" | "pass" | "passEast" | "antiphrae" | "taposiris" | "paraitonium"
  | "canopus" | "amun" | "herakleion" | "mareia" | "metelis" | "andropolis"
  | "xois" | "sais" | "sebennytos";

export const ROME_STRUCTURES: readonly RomeStructure[] = [
  // Rome itself, the seven hexes of the marble complex in the middle.
  { kind: "rome", tiles: [[13, 11], [13, 12], [14, 11], [14, 12], [14, 13], [15, 11], [15, 12]], name: "rome", nileName: "alexandria" },
  // The six outposts at the rim: a guild's own base, four hexes each.
  { kind: "home", tiles: [[13, 0], [14, 0], [14, 1], [15, 0]] },
  { kind: "home", tiles: [[25, 5], [25, 6], [26, 6], [26, 7]] },
  { kind: "home", tiles: [[2, 6], [2, 7], [3, 5], [3, 6]] },
  { kind: "home", tiles: [[2, 17], [2, 18], [3, 16], [3, 17]] },
  { kind: "home", tiles: [[25, 16], [25, 17], [26, 17], [26, 18]] },
  { kind: "home", tiles: [[13, 23], [14, 23], [14, 24], [15, 23]] },
  // Walled cities, four hexes.
  { kind: "large", tiles: [[17, 6], [18, 6], [18, 7], [19, 6]], name: "tibur", nileName: "naukratis" },
  { kind: "large", tiles: [[6, 12], [7, 11], [7, 12], [8, 12]], name: "ostia", nileName: "plinthine" },
  { kind: "large", tiles: [[17, 17], [18, 17], [18, 18], [19, 17]], name: "aricia", nileName: "sebennpolis" },
  // Round cities, three hexes.
  { kind: "medium", tiles: [[10, 6], [10, 7], [11, 6]], name: "kailey", nileName: "schedia" },
  { kind: "medium", tiles: [[20, 12], [21, 11], [21, 12]], name: "praeneste", nileName: "buto" },
  { kind: "medium", tiles: [[10, 17], [10, 18], [11, 17]], name: "ardea", nileName: "bubastis" },
  // Gates: the walled passes, two hexes.
  { kind: "gate", tiles: [[15, 9], [16, 10]], name: "pass", nileName: "pass" },
  { kind: "gate", tiles: [[11, 11], [11, 12]], name: "pass", nileName: "passEast" },
  { kind: "gate", tiles: [[15, 14], [16, 14]], name: "pass", nileName: "pass" },
  // Villages, one hex.
  { kind: "small", tiles: [[10, 3]], name: "sutrium", nileName: "antiphrae" },
  { kind: "small", tiles: [[18, 3]], name: "eretum", nileName: "taposiris" },
  { kind: "small", tiles: [[7, 4]], name: "tres", nileName: "paraitonium" },
  { kind: "small", tiles: [[21, 4]], name: "ceyni", nileName: "canopus" },
  { kind: "small", tiles: [[4, 10]], name: "arsium", nileName: "amun" },
  { kind: "small", tiles: [[24, 10]], name: "anagni", nileName: "herakleion" },
  { kind: "small", tiles: [[4, 13]], name: "laurentum", nileName: "mareia" },
  { kind: "small", tiles: [[24, 13]], name: "alatri", nileName: "metelis" },
  { kind: "small", tiles: [[7, 19]], name: "satricum", nileName: "andropolis" },
  { kind: "small", tiles: [[21, 19]], name: "lanuvium", nileName: "xois" },
  { kind: "small", tiles: [[10, 21]], name: "cisterna", nileName: "sais" },
  { kind: "small", tiles: [[18, 21]], name: "velletri", nileName: "sebennytos" },
] as const;

/** How many hexes each kind of structure covers. */
export const ROME_STRUCTURE_SIZES: Record<RomeStructureKind, number> = {
  rome: 7,
  home: 4,
  large: 4,
  medium: 3,
  gate: 2,
  small: 1,
};
