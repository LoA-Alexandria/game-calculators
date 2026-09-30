import type { Dictionary } from "../i18n/index.ts";

export type EventGuideId = keyof Dictionary["eventGuideEntries"];

/** Local page for each published event guide, shared by event cards and age unlocks. */
export const EVENT_GUIDE_HREFS: Record<EventGuideId, string> = {
  holyGrail: "/events/holy-grail/",
  trialsOfOdin: "/events/trials-of-odin/",
  dawnOfRome: "/events/dawn-of-rome/",
  atlantis: "/events/atlantis/",
  heartOfGold: "/events/heart-of-gold/",
  duelFestival: "/events/duel-festival/",
  roadToWorldcup: "/events/road-to-worldcup/",
  gloryPick: "/events/glory-pick/",
  shoppingCartRace: "/events/shopping-cart-race/",
  astralWonderland: "/events/astral-wonderland/",
  genieWish: "/events/genie-wish/",
  ringToss: "/events/ring-toss/",
  springReturns: "/events/spring-returns/",
  springReturnsPlanting: "/events/spring-returns-planting/",
  grandVoyage: "/events/grand-voyage/",
  globalRegatta: "/events/global-regatta/",
  redCarpet: "/events/red-carpet/",
  tourPerformance: "/events/tour-performance/",
  monumentOfEternity: "/events/monument-of-eternity/",
  goddessOfTime: "/events/goddess-of-time/",
  peakOfEnlightenment: "/events/peak-of-enlightenment/",
  legendOfSerenissima: "/events/legend-of-serenissima/",
  mayanRuins: "/events/mayan-ruins/",
  evolutionInstitute: "/events/evolution-institute/",
  lifeIncubator: "/events/life-incubator/",
  militarySupplies: "/events/military-supplies/",
  mushroomAdventure: "/events/mushroom-adventure/",
  supplyReform: "/events/supply-reform/",
  greatFlood: "/events/great-flood/",
};

export function eventGuideHref(id: EventGuideId): string {
  return EVENT_GUIDE_HREFS[id];
}
