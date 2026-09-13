"use client";

import Link from "next/link";
import { groupByBadge, sectionById } from "../../lib/navigation";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead, SectionBanner } from "../components/Ui";

export default function GuidesPage() {
  const { t } = useLocale();
  const section = sectionById("guides");
  const groups = groupByBadge(section.items, t, t.guides.other);
  useDocumentTitle(t.guides.title);

  return (
    <>
      <SectionBanner id="guides" />
      <PageHead eyebrow={t.navDescriptions.guides} title={t.guides.title} lede={t.guides.lede} />
      {section.items.length === 0 ? (
        <div className="empty-state">{t.guides.empty}</div>
      ) : (
        groups.map((group, index) => (
          <section className="guide-category" key={group.category} aria-labelledby={`guide-cat-${index}`}>
            <h2 id={`guide-cat-${index}`}>{group.category}</h2>
            <div className="entry-list">
              {group.items.map((item) => (
                <Link className="entry-card" href={item.href} key={item.href}>
                  <h3>{item.label(t)}</h3>
                  <p>{item.description?.(t)}</p>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
