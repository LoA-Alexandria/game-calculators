import type { Dictionary } from "./i18n/index.ts";

/**
 * The single source of truth for the sidebar and the section index pages.
 * Every label is a lookup into the dictionary rather than a literal, so a new
 * language needs no change here.
 *
 * Adding a tool or guide: add one entry to the matching section's `items`. It
 * then appears in the sidebar, in the section index, and in the filter.
 * Guides should also set `badge` so the Guides index can group them.
 */
export type NavItem = {
  href: string;
  /** Resolves the item's title in the active language. */
  label: (t: Dictionary) => string;
  description?: (t: Dictionary) => string;
  badge?: (t: Dictionary) => string;
  /**
   * Stable grouping key for nested sidebar rows and the Guides index.
   * `badge` is the translated label shown for that group.
   */
  categoryId?: string;
};

export type NavSection = {
  id: "news" | "events" | "guides" | "calculators" | "simulations";
  href: string;
  label: (t: Dictionary) => string;
  description: (t: Dictionary) => string;
  icon: "news" | "events" | "guides" | "calculators" | "simulations";
  items: NavItem[];
};

export const SECTIONS: NavSection[] = [
  {
    id: "news",
    href: "/news/",
    label: (t) => t.nav.news,
    description: (t) => t.navDescriptions.news,
    icon: "news",
    items: [],
  },
  {
    id: "events",
    href: "/events/",
    label: (t) => t.nav.events,
    description: (t) => t.navDescriptions.events,
    icon: "events",
    /**
     * Event write-ups as a flat list. The schedule calendar lives on the
     * overview, not in this section.
     */
    items: [
      {
        href: "/events/atlantis/",
        label: (t) => t.eventGuideEntries.atlantis.title,
        description: (t) => t.eventGuideEntries.atlantis.summary,
      },
      {
        href: "/events/spring-returns/",
        label: (t) => t.eventGuideEntries.springReturns.title,
        description: (t) => t.eventGuideEntries.springReturns.summary,
      },
      {
        href: "/events/holy-grail/",
        label: (t) => t.eventGuideEntries.holyGrail.title,
        description: (t) => t.eventGuideEntries.holyGrail.summary,
      },
      {
        href: "/events/monument-of-eternity/",
        label: (t) => t.eventGuideEntries.monumentOfEternity.title,
        description: (t) => t.eventGuideEntries.monumentOfEternity.summary,
      },
      {
        href: "/events/supply-reform/",
        label: (t) => t.eventGuideEntries.supplyReform.title,
        description: (t) => t.eventGuideEntries.supplyReform.summary,
      },
      {
        href: "/events/trials-of-odin/",
        label: (t) => t.eventGuideEntries.trialsOfOdin.title,
        description: (t) => t.eventGuideEntries.trialsOfOdin.summary,
      },
      {
        href: "/events/astral-wonderland/",
        label: (t) => t.eventGuideEntries.astralWonderland.title,
        description: (t) => t.eventGuideEntries.astralWonderland.summary,
      },
      {
        href: "/events/mushroom-adventure/",
        label: (t) => t.eventGuideEntries.mushroomAdventure.title,
        description: (t) => t.eventGuideEntries.mushroomAdventure.summary,
      },
      {
        href: "/events/great-flood/",
        label: (t) => t.eventGuideEntries.greatFlood.title,
        description: (t) => t.eventGuideEntries.greatFlood.summary,
      },
      {
        href: "/events/dawn-of-rome/",
        label: (t) => t.eventGuideEntries.dawnOfRome.title,
        description: (t) => t.eventGuideEntries.dawnOfRome.summary,
      },
      {
        href: "/events/ring-toss/",
        label: (t) => t.eventGuideEntries.ringToss.title,
        description: (t) => t.eventGuideEntries.ringToss.summary,
      },
      {
        href: "/events/life-incubator/",
        label: (t) => t.eventGuideEntries.lifeIncubator.title,
        description: (t) => t.eventGuideEntries.lifeIncubator.summary,
      },
      {
        href: "/events/road-to-worldcup/",
        label: (t) => t.eventGuideEntries.roadToWorldcup.title,
        description: (t) => t.eventGuideEntries.roadToWorldcup.summary,
      },
      {
        href: "/events/duel-festival/",
        label: (t) => t.eventGuideEntries.duelFestival.title,
        description: (t) => t.eventGuideEntries.duelFestival.summary,
      },
      {
        href: "/events/mayan-ruins/",
        label: (t) => t.eventGuideEntries.mayanRuins.title,
        description: (t) => t.eventGuideEntries.mayanRuins.summary,
      },
      {
        href: "/events/peak-of-enlightenment/",
        label: (t) => t.eventGuideEntries.peakOfEnlightenment.title,
        description: (t) => t.eventGuideEntries.peakOfEnlightenment.summary,
      },
      {
        href: "/events/red-carpet/",
        label: (t) => t.eventGuideEntries.redCarpet.title,
        description: (t) => t.eventGuideEntries.redCarpet.summary,
      },
      {
        href: "/events/global-regatta/",
        label: (t) => t.eventGuideEntries.globalRegatta.title,
        description: (t) => t.eventGuideEntries.globalRegatta.summary,
      },
      {
        href: "/events/heart-of-gold/",
        label: (t) => t.eventGuideEntries.heartOfGold.title,
        description: (t) => t.eventGuideEntries.heartOfGold.summary,
      },
      {
        href: "/events/spring-returns-planting/",
        label: (t) => t.eventGuideEntries.springReturnsPlanting.title,
        description: (t) => t.eventGuideEntries.springReturnsPlanting.summary,
      },
    ],
  },
  {
    id: "guides",
    href: "/guides/",
    label: (t) => t.nav.guides,
    description: (t) => t.navDescriptions.guides,
    icon: "guides",
    items: [
      {
        href: "/guides/heroes/",
        label: (t) => t.guideEntries.heroes.title,
        description: (t) => t.guideEntries.heroes.summary,
        badge: (t) => t.guideCategories.coreElements,
        categoryId: "coreElements",
      },
      {
        href: "/guides/artwork/",
        label: (t) => t.guideEntries.artwork.title,
        description: (t) => t.guideEntries.artwork.summary,
        badge: (t) => t.guideCategories.coreElements,
        categoryId: "coreElements",
      },
      {
        href: "/guides/technology/",
        label: (t) => t.guideEntries.technology.title,
        description: (t) => t.guideEntries.technology.summary,
        badge: (t) => t.guideCategories.coreElements,
        categoryId: "coreElements",
      },
      {
        href: "/guides/collection/",
        label: (t) => t.guideEntries.collection.title,
        description: (t) => t.guideEntries.collection.summary,
        badge: (t) => t.guideCategories.coreElements,
        categoryId: "coreElements",
      },
      {
        href: "/guides/manor/",
        label: (t) => t.guideEntries.manor.title,
        description: (t) => t.guideEntries.manor.summary,
        badge: (t) => t.guideCategories.coreElements,
        categoryId: "coreElements",
      },
      {
        href: "/guides/goddesses/",
        label: (t) => t.guideEntries.goddesses.title,
        description: (t) => t.guideEntries.goddesses.summary,
        badge: (t) => t.guideCategories.coreElements,
        categoryId: "coreElements",
      },
      {
        href: "/guides/cryptides/",
        label: (t) => t.guideEntries.cryptides.title,
        description: (t) => t.guideEntries.cryptides.summary,
        badge: (t) => t.guideCategories.coreElements,
        categoryId: "coreElements",
      },
      {
        href: "/guides/buildings/",
        label: (t) => t.guideEntries.buildings.title,
        description: (t) => t.guideEntries.buildings.summary,
        badge: (t) => t.guideCategories.coreElements,
        categoryId: "coreElements",
      },
      {
        href: "/guides/goddess-theater/",
        label: (t) => t.guideEntries.goddessTheater.title,
        description: (t) => t.guideEntries.goddessTheater.summary,
        badge: (t) => t.guideCategories.buildings,
        categoryId: "buildings",
      },
      {
        href: "/guides/museion/",
        label: (t) => t.guideEntries.museion.title,
        description: (t) => t.guideEntries.museion.summary,
        badge: (t) => t.guideCategories.buildings,
        categoryId: "buildings",
      },
      {
        href: "/guides/hero-layouts/",
        label: (t) => t.guideEntries.heroLayouts.title,
        description: (t) => t.guideEntries.heroLayouts.summary,
        badge: (t) => t.guideCategories.layouts,
        categoryId: "layouts",
      },
      {
        href: "/guides/collection-layouts/",
        label: (t) => t.guideEntries.collectionLayouts.title,
        description: (t) => t.guideEntries.collectionLayouts.summary,
        badge: (t) => t.guideCategories.layouts,
        categoryId: "layouts",
      },
      {
        href: "/guides/artwork-layouts/",
        label: (t) => t.guideEntries.artworkLayouts.title,
        description: (t) => t.guideEntries.artworkLayouts.summary,
        badge: (t) => t.guideCategories.layouts,
        categoryId: "layouts",
      },
      {
        href: "/guides/hero-tier-list/",
        label: (t) => t.guideEntries.heroTierList.title,
        description: (t) => t.guideEntries.heroTierList.summary,
        badge: (t) => t.guideCategories.tierLists,
        categoryId: "tierLists",
      },
      {
        href: "/guides/hero-linking/",
        label: (t) => t.guideEntries.heroLinking.title,
        description: (t) => t.guideEntries.heroLinking.summary,
        badge: (t) => t.guideCategories.tips,
        categoryId: "tips",
      },
      {
        href: "/guides/hero-leveling/",
        label: (t) => t.guideEntries.heroLeveling.title,
        description: (t) => t.guideEntries.heroLeveling.summary,
        badge: (t) => t.guideCategories.tips,
        categoryId: "tips",
      },
      {
        href: "/guides/goddess-leveling/",
        label: (t) => t.guideEntries.goddessLeveling.title,
        description: (t) => t.guideEntries.goddessLeveling.summary,
        badge: (t) => t.guideCategories.tips,
        categoryId: "tips",
      },
      {
        href: "/guides/anecdotes/",
        label: (t) => t.guideEntries.anecdotes.title,
        description: (t) => t.guideEntries.anecdotes.summary,
        badge: (t) => t.guideCategories.tips,
        categoryId: "tips",
      },
      {
        href: "/guides/server-age-unlocks/",
        label: (t) => t.guideEntries.serverAgeUnlocks.title,
        description: (t) => t.guideEntries.serverAgeUnlocks.summary,
        badge: (t) => t.guideCategories.tips,
        categoryId: "tips",
      },
      {
        href: "/guides/ads-buy/",
        label: (t) => t.guideEntries.adsBuy.title,
        description: (t) => t.guideEntries.adsBuy.summary,
        badge: (t) => t.guideCategories.tips,
        categoryId: "tips",
      },
    ],
  },
  {
    id: "calculators",
    href: "/calculators/",
    label: (t) => t.nav.calculators,
    description: (t) => t.navDescriptions.calculators,
    icon: "calculators",
    items: [
      {
        href: "/calculators/goddess-materials/",
        label: (t) => t.tools.goddessMaterials.name,
        description: (t) => t.tools.goddessMaterials.description,
        badge: (t) => t.tools.goddessMaterials.category,
      },
      {
        href: "/calculators/goddess-xp/",
        label: (t) => t.tools.goddessXp.name,
        description: (t) => t.tools.goddessXp.description,
        badge: (t) => t.tools.goddessXp.category,
      },
      {
        href: "/calculators/red-carpet-materials/",
        label: (t) => t.tools.redCarpet.name,
        description: (t) => t.tools.redCarpet.description,
        badge: (t) => t.tools.redCarpet.category,
      },
      {
        href: "/calculators/city-upgrade/",
        label: (t) => t.tools.cityUpgrade.name,
        description: (t) => t.tools.cityUpgrade.description,
        badge: (t) => t.tools.cityUpgrade.category,
      },
      {
        href: "/calculators/grand-voyage-route/",
        label: (t) => t.tools.route.name,
        description: (t) => t.tools.route.description,
        badge: (t) => t.tools.route.category,
      },
    ],
  },
  {
    id: "simulations",
    href: "/simulations/",
    label: (t) => t.nav.simulations,
    description: (t) => t.navDescriptions.simulations,
    icon: "simulations",
    items: [
      {
        href: "/simulations/irrigation-planner/",
        label: (t) => t.tools.irrigation.name,
        description: (t) => t.tools.irrigation.description,
        badge: (t) => t.tools.irrigation.category,
      },
    ],
  },
];

export function sectionById(id: NavSection["id"]): NavSection {
  const section = SECTIONS.find((entry) => entry.id === id);
  if (!section) throw new Error(`Unknown navigation section: ${id}`);
  return section;
}

/** Total number of tools offered, used for the counter on the home page. */
export function toolCount(): number {
  return sectionById("calculators").items.length + sectionById("simulations").items.length;
}

/** Published guides, used for the counter on the home page. */
export function guideCount(): number {
  return sectionById("guides").items.length;
}

/**
 * Whether the sidebar browse panel should open for this section. Guides use
 * nested categories, so they open even with no items yet. Events stay open so
 * the index is reachable while the list is empty.
 */
export function sectionHasBrowsePanel(section: NavSection): boolean {
  if (section.id === "guides" || section.id === "events") return true;
  return section.items.length > 0;
}

export type NavGroup = {
  id: string;
  category: string;
  items: NavItem[];
};

/**
 * Groups items by `categoryId` when present, otherwise by the translated
 * badge. Order follows first appearance. Items without either land in
 * `uncategorized`.
 */
export function groupByBadge(
  items: NavItem[],
  t: Dictionary,
  uncategorized: string,
): NavGroup[] {
  const order: string[] = [];
  const groups = new Map<string, NavGroup>();
  for (const item of items) {
    const category = item.badge?.(t) ?? uncategorized;
    const id = item.categoryId ?? category;
    const existing = groups.get(id);
    if (!existing) {
      order.push(id);
      groups.set(id, { id, category, items: [item] });
      continue;
    }
    existing.items.push(item);
  }
  return order.map((id) => groups.get(id) ?? { id, category: uncategorized, items: [] });
}
