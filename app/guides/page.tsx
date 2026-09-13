"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { guideHasSnippetEditor, guideIdFromHref, isGuideEntryId } from "../../lib/content/guides";
import { groupByBadge, sectionById, type NavGroup, type NavItem } from "../../lib/navigation";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead, SectionBanner } from "../components/Ui";
import { PenIcon, TrashIcon } from "../components/Icons";
import { GuideEditor, type GuideEditorTarget } from "./GuideEditor";

export default function GuidesPage() {
  const { t, tf } = useLocale();
  const { allows } = useAuth();
  const pathname = usePathname();
  const section = sectionById("guides");
  const groups = groupByBadge(section.items, t, t.guides.other);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = groups.find((group) => group.id === selectedId) ?? null;
  const canWrite = allows("guides.draft");
  const [target, setTarget] = useState<GuideEditorTarget | null>(null);

  useEffect(() => {
    const apply = () => setSelectedId(window.location.hash.replace(/^#/, "") || null);
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [pathname]);

  useDocumentTitle(selected ? selected.category : t.guides.title);

  const openEditor = (item: NavItem, action: GuideEditorTarget["action"]) => {
    const id = guideIdFromHref(item.href);
    if (!id || !isGuideEntryId(id, t.guideEntries)) return;
    setTarget({ id, action });
    window.setTimeout(() => document.getElementById("guide-editor")?.scrollIntoView({ block: "start" }), 0);
  };

  return (
    <>
      <SectionBanner id="guides" />
      {selected ? (
        <CategoryGuides
          group={selected}
          canWrite={canWrite}
          onBack={() => {
            setSelectedId(null);
            if (window.location.hash) window.history.replaceState(null, "", pathname ?? "/guides/");
          }}
          onEdit={openEditor}
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
      {canWrite && target && (
        <GuideEditor
          key={`${target.action}-${target.id}`}
          target={target}
          onClose={() => setTarget(null)}
          showHead={false}
        />
      )}
    </>
  );
}

function CategoryGuides({
  group,
  canWrite,
  onBack,
  onEdit,
}: {
  group: NavGroup;
  canWrite: boolean;
  onBack: () => void;
  onEdit: (item: NavItem, action: GuideEditorTarget["action"]) => void;
}) {
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
        {group.items.map((item) => {
          const id = guideIdFromHref(item.href);
          const showSnippetActions = canWrite && Boolean(id && guideHasSnippetEditor(id));
          return showSnippetActions ? (
            <article className="entry-card" key={item.href}>
              <Link href={item.href}>
                <h3>{item.label(t)}</h3>
                <p>{item.description?.(t)}</p>
              </Link>
              <div className="entry-actions">
                <button
                  className="small-button"
                  type="button"
                  onClick={() => onEdit(item, "edit")}
                >
                  <PenIcon className="icon icon-sm" />
                  {t.guides.edit}
                </button>
                <button
                  className="small-button button-danger"
                  type="button"
                  onClick={() => onEdit(item, "remove")}
                >
                  <TrashIcon className="icon icon-sm" />
                  {t.guides.remove}
                </button>
              </div>
            </article>
          ) : (
            <Link className="entry-card" href={item.href} key={item.href}>
              <h3>{item.label(t)}</h3>
              <p>{item.description?.(t)}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
