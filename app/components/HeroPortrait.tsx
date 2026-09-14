import type { HeroRarity } from "../../lib/content/heroes";

function initial(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return (last.charAt(0) || "?").toUpperCase();
}

/**
 * A portrait in its rarity frame, or the initial when there is no picture.
 * Without a rarity (a hero the roster does not list yet) the frame is neutral.
 */
export function HeroPortrait({
  name,
  rarity,
  src,
  className,
}: {
  name: string;
  rarity?: HeroRarity;
  src: string | null;
  className?: string;
}) {
  return (
    <span className={className ? `hero-portrait ${className}` : "hero-portrait"} data-rarity={rarity} aria-hidden="true">
      {src ? (
        // Pre-sized WebP from public/heroes or public/goddesses, or a data URL from the editor.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={120} height={121} loading="lazy" decoding="async" />
      ) : (
        <span className="hero-portrait-initial">{initial(name)}</span>
      )}
    </span>
  );
}
