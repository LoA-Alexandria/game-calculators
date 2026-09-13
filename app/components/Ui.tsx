"use client";

import Link from "next/link";
import { sectionBannerUrl } from "../../lib/content/banners";
import type { NavItem, NavSection } from "../../lib/navigation";
import { SECTION_ICONS } from "./Icons";
import { useLocale } from "./LocaleProvider";

export function SectionBanner({ id }: { id: NavSection["id"] }) {
  const src = sectionBannerUrl(id);
  const Icon = SECTION_ICONS[id];
  return (
    <div className={`section-banner section-banner-${id}`} aria-hidden="true">
      {src ? (
        // Decorative until a section supplies a real image with its own alt.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
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
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="page-head">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
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
  return (
    <Link className="tool-card" href={item.href}>
      <div className="card-topline">
        {item.badge && <span className="status">{item.badge(t)}</span>}
        <span aria-hidden="true" className="arrow">↗</span>
      </div>
      <h3>{item.label(t)}</h3>
      {item.description && <p>{item.description(t)}</p>}
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
