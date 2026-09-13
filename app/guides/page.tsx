"use client";

import Link from "next/link";
import { sectionById } from "../../lib/navigation";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead, SectionBanner } from "../components/Ui";

export default function GuidesPage() {
  const { t } = useLocale();
  const section = sectionById("guides");
  useDocumentTitle(t.guides.title);

  return (
    <>
      <SectionBanner id="guides" />
      <PageHead eyebrow={t.navDescriptions.guides} title={t.guides.title} lede={t.guides.lede} />
      {section.items.length === 0 ? (
        <div className="empty-state">{t.guides.empty}</div>
      ) : (
        <div className="entry-list">
          {section.items.map((item) => (
            <Link className="entry-card" href={item.href} key={item.href}>
              <h2>{item.label(t)}</h2>
              <p>{item.description?.(t)}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
