/**
 * Published SSR set-skill rankings for Artwork layouts. Rows point at painting
 * sets in `artwork.ts` by id; readable labels live in the guide dictionary.
 *
 * Source: Autumn (Ice, S12) on Discord, 4 September 2026. Editors export a
 * replacement for `lib/data/artwork-layouts.json`.
 */

import layoutData from "../data/artwork-layouts.json" with { type: "json" };
import { paintingSetById, type PaintingSet } from "./artwork.ts";

export type LayoutRowData = {
  setId: string;
  reason: string;
  insert?: boolean;
};

export type LayoutBuildData = {
  id: string;
  note?: string;
  rows: readonly LayoutRowData[];
};

export type ArtworkLayoutData = {
  builds: readonly LayoutBuildData[];
};

export const ARTWORK_LAYOUT_DATA = layoutData as ArtworkLayoutData;

export const SET_SKILL_BUILDS = ARTWORK_LAYOUT_DATA.builds.map((build) => build.id);

export type SetSkillRow = {
  set: PaintingSet;
  reason: string;
  insert: boolean;
};

export function layoutBuild(id: string): LayoutBuildData | undefined {
  return ARTWORK_LAYOUT_DATA.builds.find((build) => build.id === id) ?? ARTWORK_LAYOUT_DATA.builds[0];
}

export function setSkillRank(buildId: string): SetSkillRow[] {
  const build = layoutBuild(buildId);
  if (!build) return [];
  return build.rows.flatMap((row) => {
    const set = paintingSetById(row.setId);
    if (!set) return [];
    return [{ set, reason: row.reason, insert: Boolean(row.insert) }];
  });
}
