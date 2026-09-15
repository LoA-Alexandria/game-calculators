"use client";

import { GODDESS_BANNER_IMAGES } from "../../lib/content/goddess-banner";
import { goddessImageUrl } from "../../lib/content/goddesses";

/**
 * Full-bleed collage of roster portraits for the Goddesses guide. Decorative
 * only — the portraits are already credited on the page.
 */
export function GoddessBanner({ title }: { title: string }) {
  return (
    <div className="roster-banner goddess-banner" aria-hidden="true">
      <div className="roster-banner-collage">
        {GODDESS_BANNER_IMAGES.map((file) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={file}
            className="roster-banner-shot"
            src={goddessImageUrl(file)}
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
