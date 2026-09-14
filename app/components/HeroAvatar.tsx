import { heroPortrait } from "../../lib/content/heroes";

function lastInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1]?.charAt(0) || "?").toUpperCase();
}

/**
 * The round hero badge used in chips across the guides: the roster portrait
 * when there is one, otherwise the initial it replaced. Decorative, because the
 * hero's name always sits next to it.
 */
export function HeroAvatar({
  name,
  className = "pick-avatar",
  fallback,
}: {
  name: string;
  className?: string;
  /** Text shown without a portrait; defaults to the initial of the last word. */
  fallback?: string;
}) {
  const src = heroPortrait(name);
  return (
    <span className={src ? `${className} has-portrait` : className} aria-hidden="true">
      {src ? (
        // A static export cannot run next/image optimisation; the files are already small WebP.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={120} height={121} loading="lazy" decoding="async" />
      ) : (
        fallback ?? lastInitial(name)
      )}
    </span>
  );
}
