/**
 * Goddess Theater casts from the Pop Epoch Wiki
 * (https://pop-epochmobile.fandom.com/wiki/Goddess_Theater) as of 14 September
 * 2026, with community “relevant” marks for stills. Covers in
 * `public/goddess-theater/` are the first image on each wiki card (the rarity
 * frame), not the stills beside it. Play and role names stay in English. Wiki
 * “Brunhilde” is stored as Brunhild to match the goddess roster. The Three
 * Musketeers has no cast: complete the tutorial.
 */

import roster from "../data/goddess-theater.json" with { type: "json" };
import { asset } from "../site.ts";

export type TheaterRole = {
  goddess: string;
  role: string;
  relevant?: boolean;
};

export type TheaterPlay = {
  id: string;
  name: string;
  /** File name in `public/goddess-theater/` (wiki cover, not a still). */
  image: string;
  /** `tutorial` when the wiki says to complete the tutorial instead of a cast. */
  unlock?: "tutorial";
  roles: TheaterRole[];
};

export type TheaterData = { plays: TheaterPlay[] };

export const THEATER_DATA = roster as TheaterData;
export const THEATER_PLAYS: TheaterPlay[] = THEATER_DATA.plays;

export function theaterCoverUrl(file: string): string {
  return asset(`/goddess-theater/${file}`);
}

export function searchTheaterPlays(query: string): TheaterPlay[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return THEATER_PLAYS;
  return THEATER_PLAYS.filter((play) => {
    const hay = [
      play.name,
      play.unlock ?? "",
      ...play.roles.flatMap((row) => [row.goddess, row.role]),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}
