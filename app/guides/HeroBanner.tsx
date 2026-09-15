"use client";

import { HERO_BANNER_IMAGES } from "../../lib/content/hero-banner";
import { heroImageUrl } from "../../lib/content/heroes";

/**
 * Full-bleed collage of roster portraits for the Heroes guide. Decorative
 * only — the portraits are already credited on the page.
 */
export function HeroBanner({ title }: { title: string }) {
  return (
    <div className="roster-banner hero-banner" aria-hidden="true">
      <div className="roster-banner-collage">
        {HERO_BANNER_IMAGES.map((file) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={file}
            className="roster-banner-shot"
            src={heroImageUrl(file)}
            alt=""
            width={160}
            height={200}
          />
        ))}
      </div>
      <div className="roster-banner-veil" />
      <div className="roster-banner-mark">
        <span>{title}</span>
      </div>
    </div>
  );
}
