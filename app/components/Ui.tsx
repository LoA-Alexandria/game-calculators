"use client";

import Link from "next/link";
import { sectionBannerLogoUrl, sectionBannerUrl } from "../../lib/content/banners";
import type { NavItem, NavSection } from "../../lib/navigation";
import { useAuth } from "./AuthProvider";
import { SECTION_ICONS } from "./Icons";
import { toolIconUrl } from "../../lib/content/banners";
import { useLocale } from "./LocaleProvider";

export function SectionBanner({ id }: { id: NavSection["id"] }) {
  const src = sectionBannerUrl(id);
  const logoSrc = sectionBannerLogoUrl(id);
  const Icon = SECTION_ICONS[id];
  return (
    <div className={`section-banner section-banner-${id}`} aria-hidden="true">
      {src ? (
        <>
          {/* Decorative until a section supplies a real image with its own alt. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="section-banner-background" src={src} alt="" />
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="section-banner-logo" src={logoSrc} alt="" />
          )}
        </>
      ) : (
        <div className="section-banner-art" aria-hidden="true">
          <Icon className="icon" />
        </div>
      )}
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  lede,
  art,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  /** A banner that shows the title instead of the text; the title stays as its alt text. */
  art?: { src: string; width: number; height: number };
}) {
  return (
    <header className="page-head">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      {art ? (
        <h1 className="page-head-art">
          {/* A static export cannot optimise images; the banner is already a small WebP. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art.src} alt={title} width={art.width} height={art.height} decoding="async" fetchPriority="high" />
        </h1>
      ) : (
        <h1>{title}</h1>
      )}
      {lede && <p>{lede}</p>}
    </header>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="back-link" href={href}>
      <span aria-hidden="true">←</span> {label}
    </Link>
  );
}

export function ToolCard({ item }: { item: NavItem }) {
  const { t } = useLocale();
  const { session } = useAuth();
  const locked = Boolean(item.premium && !session?.premium);
  const href = locked ? "/premium/" : item.href;
  const icon = toolIconUrl(item.href);
  return (
    <Link className={locked ? "tool-card tool-card-premium-locked" : "tool-card"} href={href}>
      <div className="card-topline">
        <div className="card-topline-badges">
          {item.premium && !locked ? <span className="status status-premium">{t.premium.badge}</span> : null}
          {item.badge && <span className="status">{item.badge(t)}</span>}
        </div>
        <span aria-hidden="true" className="arrow">↗</span>
      </div>
      {icon ? (
        <div className="tool-card-mark" aria-hidden="true">
          {/* A static export cannot optimise images; these are small WebP already. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" width={64} height={64} loading="lazy" decoding="async" />
        </div>
      ) : null}
      <h3>{item.label(t)}</h3>
      {item.description ? (
        <div className={locked ? "tool-card-body is-blurred" : "tool-card-body"}>
          <p>{item.description(t)}</p>
        </div>
      ) : null}
      {locked ? (
        <span className="premium-price-tag">
          <span className="premium-price-tag-brand">{t.premium.badge}</span>
          <span className="premium-price-tag-meta">{t.premium.unlockHint}</span>
        </span>
      ) : null}
    </Link>
  );
}

/** A section index page: heading, then one card per entry. */
export function SectionIndex({
  section,
  title,
  lede,
  emptyMessage,
}: {
  section: NavSection;
  title: string;
  lede: string;
  emptyMessage: string;
}) {
  const { t } = useLocale();
  return (
    <>
      <SectionBanner id={section.id} />
      <PageHead eyebrow={section.description(t)} title={title} lede={lede} />
      {section.items.length === 0 ? (
        <div className="empty-state">{emptyMessage}</div>
      ) : (
        <div className="card-grid">
          {section.items.map((item) => (
            <ToolCard item={item} key={item.href} />
          ))}
        </div>
      )}
    </>
  );
}
