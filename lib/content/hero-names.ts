/**
 * The Heroes roster (`lib/content/heroes.ts`, from the community wiki) spells
 * some heroes differently from the Hero layouts and tier list guides, which
 * follow Autumn's lists. Until one spelling is confirmed in the game, this map
 * lets the guides recognise a roster hero they already list, so the layouts
 * editor does not offer Newton again as "Isaac Newton".
 *
 * Site spelling → roster spelling. `tests/hero-names.test.mjs` checks both
 * sides exist.
 */
export const ROSTER_SPELLING: Readonly<Record<string, string>> = {
  "Alfred I": "Alfred the Great",
  Bjorn: "Bjorn Ironside",
  "Catherine de Medici": "Catherine de'Medici",
  Gawain: "Garwain",
  Livia: "Livia Drusilla",
  Napoleon: "Napoleon Bonaparte",
  Newton: "Isaac Newton",
  Ragnar: "Ragnar Lodbrok",
  Tesla: "Nikola Tesla",
  Tutankhamen: "Tutankhamun",
};

const SITE_SPELLING: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ROSTER_SPELLING).map(([site, roster]) => [roster, site]),
);

/** The name the guides use for a hero from the roster. */
export function siteName(rosterName: string): string {
  return SITE_SPELLING[rosterName] ?? rosterName;
}
