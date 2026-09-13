"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { groupByBadge, sectionById, type NavGroup } from "../../lib/navigation";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead, SectionBanner } from "../components/Ui";

export default function GuidesPage() {
  const { t, tf } = useLocale();
  const pathname = usePathname();
  const section = sectionById("guides");
  const groups = groupByBadge(section.items, t, t.guides.other);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = groups.find((group) => group.id === selectedId) ?? null;

  useEffect(() => {
    const apply = () => setSelectedId(window.location.hash.replace(/^#/, "") || null);
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [pathname]);

  useDocumentTitle(selected ? selected.category : t.guides.title);

  return (
    <>
      <SectionBanner id="guides" />
      {selected ? (
        <CategoryGuides
          group={selected}
          onBack={() => {
            setSelectedId(null);
            if (window.location.hash) window.history.replaceState(null, "", pathname ?? "/guides/");
          }}
        />
      ) : (
        <>
          <PageHead eyebrow={t.navDescriptions.guides} title={t.guides.title} lede={t.guides.lede} />
          {section.items.length === 0 ? (
            <div className="empty-state">{t.guides.empty}</div>
          ) : (
            <div className="entry-list">
              {groups.map((group) => (
                <Link
                  className="entry-card"
                  href={`/guides/#${group.id}`}
                  key={group.id}
                  onClick={() => setSelectedId(group.id)}
                >
                  <h2>{group.category}</h2>
                  <p>{tf(t.guides.categoryCount, { count: group.items.length })}</p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function CategoryGuides({ group, onBack }: { group: NavGroup; onBack: () => void }) {
  const { t } = useLocale();
  return (
    <>
      <Link
        className="back-link"
        href="/guides/"
        onClick={(event) => {
          event.preventDefault();
          onBack();
        }}
      >
        <span aria-hidden="true">←</span> {t.guides.allCategories}
      </Link>
      <PageHead eyebrow={t.guides.title} title={group.category} lede={t.guides.pickGuide} />
      <div className="entry-list">
        {group.items.map((item) => (
          <Link className="entry-card" href={item.href} key={item.href}>
            <h3>{item.label(t)}</h3>
            <p>{item.description?.(t)}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
