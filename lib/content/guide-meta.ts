/**
 * How each guide presents itself outside its own page: the pictures on its
 * card in the Guides index, and the route and button of its own editor. Guides without
 * pictures get their category's glyph instead.
 *
 * All pictures are already on the site (hero and goddess portraits, Goddess
 * Theater covers, in-game paintings), so no new artwork is needed here.
 * `tests/guide-meta.test.mjs` checks that every guide in the navigation has an
 * entry, that each picture exists, and that each editor route has a page.
 */

import type { Dictionary } from "../i18n/index.ts";
import type { GuideEntryId } from "./guides.ts";
import { asset } from "../site.ts";

export type GuidePresentation = {
  /** Up to four files under `public/`, shown side by side on the index card. */
  art: readonly string[];
  /** The guide's own editor, when it has one, and the words on its button. */
  editor?: { href: string; label: (t: Dictionary) => string };
  /** The pictures are cut-outs on a transparent background: shown whole, not cropped into tiles. */
  cutout?: boolean;
};

export const GUIDE_PRESENTATION: Record<GuideEntryId, GuidePresentation> = {
  heroes: {
    art: ["/heroes/king-arthur.webp", "/heroes/joan-of-arc.webp", "/heroes/odysseus.webp", "/heroes/merlin.webp"],
    editor: { href: "/guides/heroes/edit/", label: (t) => t.heroEditor.openEditor },
  },
  artwork: {
    art: ["/artwork/the-swing.webp", "/artwork/nightshade.webp", "/artwork/young-hare.webp"],
    editor: { href: "/guides/artwork/edit/", label: (t) => t.artworkEditor.openEditor },
  },
  technology: { art: [] },
  collection: {
    art: ["/collection/prometheus-torch.webp", "/collection/pandoras-box.webp", "/collection/aeolus-bag-of-winds.webp"],
    editor: { href: "/guides/collection/edit/", label: (t) => t.collectionEditor.openEditor },
    cutout: true,
  },
  manor: { art: [] },
  adsBuy: { art: [] },
  goddesses: {
    art: ["/goddesses/athena.webp", "/goddesses/fortuna.webp", "/goddesses/venus.webp", "/goddesses/hera.webp"],
    editor: { href: "/guides/goddesses/edit/", label: (t) => t.goddessEditor.openEditor },
  },
  goddessLeveling: {
    art: ["/goddesses/demeter.webp", "/goddesses/venus.webp", "/goddesses/medusa.webp"],
    editor: { href: "/guides/goddess-leveling/edit/", label: (t) => t.goddessLevelingEditor.openEditor },
  },
  cryptides: { art: [] },
  goddessTheater: {
    art: ["/goddess-theater/hamlet.webp", "/goddess-theater/aladdin.webp", "/goddess-theater/frankenstein.webp"],
    editor: { href: "/guides/goddess-theater/edit/", label: (t) => t.theaterEditor.openEditor },
  },
  museion: {
    art: ["/heroes/socrates.webp", "/heroes/confucius.webp", "/heroes/hammurabi.webp"],
    editor: { href: "/guides/museion/edit/", label: (t) => t.museionEditor.openEditor },
  },
  buildings: {
    art: ["/production-buildings/farm.webp", "/production-buildings/blacksmith.webp", "/buildings/tent.webp"],
    editor: { href: "/guides/buildings/edit/", label: (t) => t.buildingsEditor.openEditor },
    cutout: true,
  },
  heroLayouts: {
    art: ["/heroes/achilles.webp", "/heroes/caesar.webp", "/heroes/lancelot.webp", "/heroes/tutankhamun.webp"],
    editor: { href: "/guides/hero-layouts/edit/", label: (t) => t.layoutEditor.openEditor },
  },
  collectionLayouts: {
    art: ["/collection/thors-hammer.webp", "/collection/golden-mask-of-agamemnon.webp", "/collection/prometheus-torch.webp"],
    editor: { href: "/guides/collection-layouts/edit/", label: (t) => t.collectionLayoutsEditor.openEditor },
    cutout: true,
  },
  artworkLayouts: {
    art: ["/artwork/wanderer-above-the-sea-of-fog.webp", "/artwork/cafe-terrace-at-night.webp", "/artwork/composition-viii.webp"],
    editor: { href: "/guides/artwork-layouts/edit/", label: (t) => t.artworkLayoutEditor.openEditor },
  },
  heroTierList: {
    art: ["/heroes/joan-of-arc-3.webp", "/heroes/odysseus-2.webp", "/heroes/achilles-2.webp"],
    editor: { href: "/guides/hero-tier-list/edit/", label: (t) => t.tierEditor.openEditor },
  },
  heroLinking: {
    art: ["/heroes/king-arthur-2.webp", "/heroes/lancelot-2.webp", "/heroes/ragnar-lodbrok.webp"],
    editor: { href: "/guides/hero-linking/edit/", label: (t) => t.linkingEditor.openEditor },
  },
  heroLeveling: {
    art: ["/heroes/achilles-3.webp", "/heroes/joan-of-arc-2.webp", "/heroes/tutankhamun-2.webp"],
    editor: { href: "/guides/hero-leveling/edit/", label: (t) => t.levelingEditor.openEditor },
  },
  anecdotes: {
    art: ["/artwork/landscape-shaped-like-a-face.webp", "/heroes/socrates-2.webp", "/goddesses/muse.webp"],
    editor: { href: "/guides/anecdotes/edit/", label: (t) => t.anecdoteEditor.openEditor },
  },
  serverAgeUnlocks: {
    art: [],
    editor: { href: "/guides/server-age-unlocks/edit/", label: (t) => t.ageUnlocksEditor.openEditor },
  },
};

export function guidePresentation(id: GuideEntryId): GuidePresentation {
  return GUIDE_PRESENTATION[id] ?? { art: [] };
}

export function guideArtUrls(id: GuideEntryId): string[] {
  return guidePresentation(id).art.map((path) => asset(path));
}
