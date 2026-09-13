import type { Dictionary } from "./i18n/index.ts";

/**
 * The single source of truth for the sidebar, the section index pages, and the
 * home page. Every label is a lookup into the dictionary rather than a literal,
 * so a new language needs no change here.
 *
 * Adding a tool or guide: add one entry to the matching section's `items`. It
 * then appears in the sidebar, in the section index, and in the filter.
 */
export type NavItem = {
  href: string;
  /** Resolves the item's title in the active language. */
  label: (t: Dictionary) => string;
  description?: (t: Dictionary) => string;
  badge?: (t: Dictionary) => string;
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
    description: (t) => t.events.lede,
    icon: "events",
    items: [],
  },
  {
    id: "guides",
    href: "/guides/",
    label: (t) => t.nav.guides,
    description: (t) => t.navDescriptions.guides,
    icon: "guides",
    items: [
      {
        href: "/guides/water-supply/",
        label: (t) => t.guideEntries.waterSupply.title,
        description: (t) => t.guideEntries.waterSupply.summary,
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
        href: "/benben/",
        label: (t) => t.benben.title,
        description: (t) => t.benben.lede,
        badge: (t) => t.benben.badge,
      },
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
