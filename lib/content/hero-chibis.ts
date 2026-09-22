/**
 * The little in-game figure of a hero, cut out of the German client's hero
 * screen on 18 September 2026: the pedestal it stands on and the level badge
 * below it are removed, so only the figure is left. Files are
 * `public/heroes/chibi/<hero id>.webp`; a hero nobody has photographed yet is
 * simply not in this list and the guide then shows no figure.
 *
 * The artwork belongs to the game's publisher; the roster credits it, and
 * deleting the folder plus this list takes it out again.
 */

import { asset } from "../site.ts";

export const HERO_CHIBIS: readonly string[] = [
  "achilles", "adam", "alexander-the-great", "alfred-the-great", "augustus", "beethoven",
  "billy-the-kid", "bjorn-ironside", "blackbeard", "caesar", "charles-darwin",
  "charles-the-great", "circe", "cleopatra", "columbus", "confucius", "da-vinci", "dante",
  "eleanor-of-aquitaine", "franklin", "galileo-galilei", "garwain", "gilgamesh",
  "guinevere", "hammurabi", "hector", "heracles", "hermes", "homer", "isaac-newton",
  "joan-of-arc", "king-arthur", "lagertha", "lancelot", "livia-drusilla", "louis-xiv",
  "merlin", "michelangelo", "napoleon-bonaparte", "nikola-tesla", "noah", "odysseus",
  "pompey", "prometheus", "queen-victoria", "ragnar-lodbrok", "richard-i", "socrates",
  "spartacus", "tutankhamun", "wallace", "william-shakespeare",
];

const HAS_CHIBI = new Set(HERO_CHIBIS);

/** Figure URL for a hero id, or null when nobody has cut one out yet. */
export function heroChibiUrl(id: string): string | null {
  return HAS_CHIBI.has(id) ? asset(`/heroes/chibi/${id}.webp`) : null;
}
