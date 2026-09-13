import assert from "node:assert/strict";
import test from "node:test";

import { HEROES } from "../lib/content/heroes.ts";
import { LAYOUT_DATA, placedHeroes } from "../lib/content/hero-layouts.ts";
import { OVERALL_TIERS } from "../lib/content/hero-tiers.ts";
import { ROSTER_SPELLING, siteName } from "../lib/content/hero-names.ts";

test("every roster spelling in the map exists in the Heroes roster", () => {
  const roster = new Set(HEROES.map((hero) => hero.name));
  for (const [site, rosterName] of Object.entries(ROSTER_SPELLING)) {
    assert.ok(roster.has(rosterName), `${rosterName} (for ${site}) is not in the roster`);
  }
});

test("every site spelling in the map is used by the layouts or the tier list", () => {
  const used = new Set([...placedHeroes(LAYOUT_DATA), ...OVERALL_TIERS.flatMap((row) => row.entries.map((entry) => entry.hero))]);
  for (const site of Object.keys(ROSTER_SPELLING)) assert.ok(used.has(site), `${site} is not used`);
});

test("roster names resolve to the spelling the guides use", () => {
  assert.equal(siteName("Isaac Newton"), "Newton");
  assert.equal(siteName("Garwain"), "Gawain");
  assert.equal(siteName("Cu Chulainn"), "Cu Chulainn");
});
