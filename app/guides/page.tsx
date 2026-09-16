"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { guideArtUrls, guidePresentation } from "../../lib/content/guide-meta";
import { guideHasSnippetEditor, guideIdFromHref, isGuideEntryId, type GuideEntryId } from "../../lib/content/guides";
import { groupByBadge, sectionById, type NavGroup, type NavItem } from "../../lib/navigation";
import { useAuth } from "../components/AuthProvider";
import { GuidesIcon, PenIcon, SearchIcon, TrashIcon } from "../components/Icons";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead, SectionBanner } from "../components/Ui";
import { GuideEditor, type GuideEditorTarget } from "./GuideEditor";

/** Lower-case and without accents, so "gottin" finds Göttin. */
function fold(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}

export default function GuidesPage() {
  const { t } = useLocale();
  const { allows } = useAuth();
  const pathname = usePathname();
  const section = sectionById("guides");
  const groups = useMemo(() => groupByBadge(section.items, t, t.guides.other), [section.items, t]);
  const canWrite = allows("guides.draft");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<GuideEditorTarget | null>(null);
  useDocumentTitle(t.guides.title);

  // The sidebar links to /guides/#<category>; that picks the category here.
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.replace(/^#/, "");
      setCategory(groups.some((group) => group.id === hash) ? hash : "all");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [pathname, groups]);

  const pick = (id: string) => {
    setCategory(id);
    window.history.replaceState(null, "", id === "all" ? (pathname ?? "/guides/") : `#${id}`);
  };

  const needle = fold(query);
  const shown = groups
    .filter((group) => category === "all" || group.id === category)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !needle || fold(`${item.label(t)} ${item.description?.(t) ?? ""} ${group.category}`).includes(needle)),
    }))
    .filter((group) => group.items.length > 0);
  const editors = section.items.filter((item) => {
    const id = guideIdFromHref(item.href);
    return Boolean(id && isGuideEntryId(id, t.guideEntries) && guidePresentation(id).editor);
  }).length;

  const openEditor = (item: NavItem, action: GuideEditorTarget["action"]) => {
    const id = guideIdFromHref(item.href);
    if (!id || !isGuideEntryId(id, t.guideEntries)) return;
    setTarget({ id, action });
    window.setTimeout(() => document.getElementById("guide-editor")?.scrollIntoView({ block: "start" }), 0);
  };

  return (
    <>
      <SectionBanner id="guides" />
      <PageHead eyebrow={t.navDescriptions.guides} title={t.guides.title} lede={t.guides.lede} />

      {section.items.length === 0 ? (
        <div className="empty-state">{t.guides.empty}</div>
      ) : (
        <div className="guides-index">
          <ul className="guides-stats">
            <li><strong>{section.items.length}</strong> {t.guides.statGuides}</li>
            <li><strong>{groups.length}</strong> {t.guides.statCategories}</li>
            <li><strong>{editors}</strong> {t.guides.statEditors}</li>
          </ul>

          <div className="guides-toolbar">
            <label className="guides-search">
              <SearchIcon className="icon icon-sm" />
              <span className="visually-hidden">{t.guides.searchLabel}</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.guides.searchPlaceholder} />
            </label>
            <div className="guides-filters" role="group" aria-label={t.guides.filterLabel}>
              <button type="button" className="guides-filter" aria-pressed={category === "all"} onClick={() => pick("all")}>
                {t.guides.filterAll}
                <span className="guides-filter-count">{section.items.length}</span>
              </button>
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className="guides-filter"
                  data-category={group.id}
                  aria-pressed={category === group.id}
                  onClick={() => pick(group.id)}
                >
                  {group.category}
                  <span className="guides-filter-count">{group.items.length}</span>
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? <p className="empty-state">{t.guides.noMatch}</p> : null}
          {shown.map((group) => (
            <GuideCategory key={group.id} group={group} canWrite={canWrite} onEdit={openEditor} />
          ))}
        </div>
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

function GuideCategory({
  group,
  canWrite,
  onEdit,
}: {
  group: NavGroup;
  canWrite: boolean;
  onEdit: (item: NavItem, action: GuideEditorTarget["action"]) => void;
}) {
  const { t, tf } = useLocale();
  const ledes = t.guides.categoryLedes as Record<string, string>;
  return (
    <section className="guides-category" id={group.id} data-category={group.id} aria-labelledby={`guides-${group.id}`}>
      <header className="guides-category-head">
        <h2 id={`guides-${group.id}`}>{group.category}</h2>
        <span className="guides-category-count">
          {group.items.length === 1 ? t.guides.countGuidesOne : tf(t.guides.countGuides, { count: group.items.length })}
        </span>
        {ledes[group.id] ? <p>{ledes[group.id]}</p> : null}
      </header>
      <ul className="guides-grid">
        {group.items.map((item) => (
          <li key={item.href}>
            <GuideCard item={item} category={group.id} canWrite={canWrite} onEdit={onEdit} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function GuideCard({
  item,
  category,
  canWrite,
  onEdit,
}: {
  item: NavItem;
  category: string;
  canWrite: boolean;
  onEdit: (item: NavItem, action: GuideEditorTarget["action"]) => void;
}) {
  const { t } = useLocale();
  const rawId = guideIdFromHref(item.href);
  const id = rawId && isGuideEntryId(rawId, t.guideEntries) ? (rawId as GuideEntryId) : null;
  const art = id ? guideArtUrls(id) : [];
  const presentation = id ? guidePresentation(id) : null;
  const editor = presentation?.editor;
  const artClass = !art.length ? "guide-card-art is-glyph" : presentation?.cutout ? "guide-card-art is-cutout" : "guide-card-art";
  const snippet = canWrite && Boolean(id && guideHasSnippetEditor(id));

  return (
    <article className="guide-card" data-category={category}>
      <div className={artClass} data-count={art.length} aria-hidden="true">
        {art.length ? (
          art.map((src) => (
            // Portraits and paintings already on the site, small WebP files.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading="lazy" decoding="async" />
          ))
        ) : (
          <GuidesIcon className="guide-card-glyph" />
        )}
      </div>
      <div className="guide-card-body">
        <h3>
          {/* The link covers the whole card; the edit buttons sit above it. */}
          <Link className="guide-card-link" href={item.href}>{item.label(t)}</Link>
        </h3>
        {item.description ? <p>{item.description(t)}</p> : null}
        <div className="guide-card-foot">
          <span className="guide-card-category">{item.badge?.(t)}</span>
          {editor ? (
            <span className="guide-card-badge">
              <PenIcon className="icon icon-sm" />
              {t.guides.editorBadge}
            </span>
          ) : null}
        </div>
        {snippet ? (
          <div className="guide-card-actions">
            <button className="small-button" type="button" onClick={() => onEdit(item, "edit")}>
              <PenIcon className="icon icon-sm" />
              {t.guides.edit}
            </button>
            <button className="small-button button-danger" type="button" onClick={() => onEdit(item, "remove")}>
              <TrashIcon className="icon icon-sm" />
              {t.guides.remove}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
