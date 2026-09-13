/**
 * Colour schemes sit on top of light/dark. Brightness is `data-theme`;
 * the palette family is `data-scheme`. Stone is the default (current teal HUD
 * tokens). Swatches are the light-mode accent of each scheme.
 */
export const COLOR_SCHEMES = [
  { id: "stone", swatch: "#1e7d86" },
  { id: "lapis", swatch: "#3a66e8" },
  { id: "papyrus", swatch: "#9a5a18" },
  { id: "steam", swatch: "#8f4a2a" },
] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number]["id"];

export const DEFAULT_COLOR_SCHEME: ColorScheme = "stone";

export function isColorScheme(value: unknown): value is ColorScheme {
  return typeof value === "string" && COLOR_SCHEMES.some((scheme) => scheme.id === value);
}
