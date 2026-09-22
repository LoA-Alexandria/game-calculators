"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { guideTitleBanner } from "../../lib/content/banners";
import { guidePresentation } from "../../lib/content/guide-meta";
import { guideCategoryId, guideHasSnippetEditor, guideHref, isGuideEntryId, type GuideEntryId } from "../../lib/content/guides";
import { toLocale, type Dictionary } from "../../lib/i18n";
import { isTextGuide, textGuideEntry, type TextGuideDraft } from "../../lib/content/text-guide-editor";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PenIcon, TrashIcon } from "../components/Icons";
import { TextGuideEditor } from "../components/TextGuideEditor";
import { GuideEditor, type GuideEditorTarget } from "./GuideEditor";
import { AdsBuyGuide, isAdsBuyGuide } from "./AdsBuyGuide";
import { GoddessesGuide, isGoddessesGuide } from "./GoddessesGuide";
import { ArtworkGuide, isArtworkGuide } from "./ArtworkGuide";
import { ArtworkLayoutsGuide, isArtworkLayoutsGuide } from "./ArtworkLayoutsGuide";
import { HeroLayoutsGuide, isHeroLayoutsGuide } from "./HeroLayoutsGuide";
import { HeroRoster, isHeroesGuide } from "./HeroRoster";
import { HeroTierListGuide, isHeroTierListGuide } from "./HeroTierListGuide";
import { GoddessTheaterGuide, isGoddessTheaterGuide } from "./GoddessTheaterGuide";
import { HeroLinkingGuide, isHeroLinkingGuide } from "./HeroLinkingGuide";
import { AnecdotesGuide, isAnecdotesGuide } from "./AnecdotesGuide";
import { ServerAgeUnlocksGuide, isServerAgeUnlocksGuide } from "./ServerAgeUnlocksGuide";
import { MuseionGuide, isMuseionGuide } from "./MuseionGuide";
import { HeroLevelingGuide, isHeroLevelingGuide } from "./HeroLevelingGuide";
import { GoddessLevelingGuide, isGoddessLevelingGuide } from "./GoddessLevelingGuide";
import { CollectionGuide, isCollectionGuide } from "./CollectionGuide";
import { CollectionLayoutsGuide, isCollectionLayoutsGuide } from "./CollectionLayoutsGuide";
import { BuildingsGuide, isBuildingsGuide } from "./BuildingsGuide";
import { CryptidesGuide, isCryptidesGuide } from "./CryptidesGuide";
import { HeroBanner } from "./HeroBanner";
import { GoddessBanner } from "./GoddessBanner";

type AnyGuide = Dictionary["guideEntries"][GuideEntryId];

/**
 * The same head on every guide: where it sits (Guides › category), its title or
 * title banner, the one-line summary, who wrote it, and the way into its
 * editor. The guides themselves start with their own content.
 */
function GuideHeader({
  id,
  guide,
  canSnippet,
  onSnippet,
  onTextEdit,
}: {
  id: GuideEntryId;
  guide: AnyGuide;
  canSnippet: boolean;
  onSnippet: (action: GuideEditorTarget["action"]) => void;
  /** Opens the text editor of a guide that is only text and has no editor of its own. */
  onTextEdit?: () => void;
}) {
  const { t } = useLocale();
  const { allows } = useAuth();
  const category = guideCategoryId(guideHref(id), t.guideCategories);
  const banner = guideTitleBanner(id);
  const editor = guidePresentation(id).editor;
  // Only guides with a dated byline carry a short credit; the others keep longer source notes on the page.
  const byline = "creditDate" in guide ? (guide as { credit?: string; creditDate?: string; status?: string }) : null;
  const canEdit = Boolean(editor && allows("guides.draft"));

  return (
    <header className="guide-head" data-category={category}>
      <nav className="guide-crumbs" aria-label={t.nav.guides}>
        <Link href="/guides/">{t.nav.guides}</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/guides/#${category}`}>{t.guideCategories[category]}</Link>
      </nav>
      {banner ? (
        <h1 className="guide-head-art">
          {/* A static export cannot optimise images; the banner is already a small WebP. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner.src} alt={guide.title} width={banner.width} height={banner.height} decoding="async" fetchPriority="high" />
        </h1>
      ) : (
        <h1>{guide.title}</h1>
      )}
      <p className="guide-head-lede">{guide.summary}</p>
      {byline || canEdit || canSnippet || onTextEdit ? (
        <div className="guide-head-meta">
          {byline?.credit ? <span className="guide-chip is-credit">{byline.credit}</span> : null}
          {byline?.creditDate ? <span className="guide-chip">{byline.creditDate}</span> : null}
          {byline?.status ? <span className="guide-chip is-status">{byline.status}</span> : null}
          {canEdit || canSnippet || onTextEdit ? (
            <span className="guide-head-actions">
              {onTextEdit ? (
                <button className="button" type="button" onClick={onTextEdit}>
                  <PenIcon className="icon icon-sm" />
                  {t.guides.edit}
                </button>
              ) : null}
              {canEdit && editor ? (
                <Link className="button button-primary" href={editor.href}>
                  <PenIcon className="icon icon-sm" />
                  {editor.label(t)}
                </Link>
              ) : null}
              {canSnippet ? (
                <>
                  <button className="button" type="button" onClick={() => onSnippet("edit")}>
                    <PenIcon className="icon icon-sm" />
                    {t.guides.edit}
                  </button>
                  <button className="button button-danger" type="button" onClick={() => onSnippet("remove")}>
                    <TrashIcon className="icon icon-sm" />
                    {t.guides.remove}
                  </button>
                </>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

export function GuideArticle({ id }: { id: GuideEntryId }) {
  const { t, locale } = useLocale();
  const { allows } = useAuth();
  const published = t.guideEntries[id];
  const canWrite = allows("guides.draft") && guideHasSnippetEditor(id);
  // A guide that is only text and has neither its own editor nor the snippet one
  // (Ads / Buy) gets the text editor, with the page itself as the preview.
  const textGuide = useMemo(
    () => !guidePresentation(id).editor && !guideHasSnippetEditor(id) && isTextGuide("guideEntries", id),
    [id],
  );
  const canTextEdit = allows("guides.draft") && textGuide;
  const [textEditing, setTextEditing] = useState(false);
  const [textDraft, setTextDraft] = useState<TextGuideDraft | null>(null);
  const guide = textDraft
    ? ({ ...published, ...textGuideEntry(textDraft, toLocale(locale)) } as typeof published)
    : published;
  const [target, setTarget] = useState<GuideEditorTarget | null>(null);
  const heroesGuide = isHeroesGuide(guide);
  const goddessesGuide = isGoddessesGuide(guide);
  const category = guideCategoryId(guideHref(id), t.guideCategories);
  useDocumentTitle(guide.title);

  const openEditor = (action: GuideEditorTarget["action"]) => {
    setTarget({ id, action });
    window.setTimeout(() => document.getElementById("guide-editor")?.scrollIntoView({ block: "start" }), 0);
  };

  return (
    <>
      {heroesGuide && !guideTitleBanner(id) ? <HeroBanner title={guide.title} /> : null}
      {goddessesGuide && !guideTitleBanner(id) ? <GoddessBanner title={guide.title} /> : null}
      <GuideHeader
        id={id}
        guide={guide}
        canSnippet={canWrite}
        onSnippet={openEditor}
        onTextEdit={
          canTextEdit && !textEditing
            ? () => {
                setTextEditing(true);
                window.setTimeout(() => document.getElementById("text-guide-editor")?.scrollIntoView({ block: "start" }), 0);
              }
            : undefined
        }
      />
      <article className="article" data-category={category}>
        {goddessesGuide ? (
          <GoddessesGuide guide={guide} />
        ) : isGoddessTheaterGuide(guide) ? (
          <GoddessTheaterGuide guide={guide} />
        ) : isHeroLinkingGuide(guide) ? (
          <HeroLinkingGuide guide={guide} />
        ) : isAnecdotesGuide(guide) ? (
          <AnecdotesGuide guide={guide} />
        ) : isServerAgeUnlocksGuide(guide) ? (
          <ServerAgeUnlocksGuide guide={guide} />
        ) : isMuseionGuide(guide) ? (
          <MuseionGuide guide={guide} />
        ) : isHeroLevelingGuide(guide) ? (
          <HeroLevelingGuide guide={guide} />
        ) : isGoddessLevelingGuide(guide) ? (
          <GoddessLevelingGuide guide={guide} />
        ) : isCollectionGuide(guide) ? (
          <CollectionGuide guide={guide} />
        ) : isCollectionLayoutsGuide(guide) ? (
          <CollectionLayoutsGuide guide={guide} />
        ) : isBuildingsGuide(guide) ? (
          <BuildingsGuide guide={guide} />
        ) : isCryptidesGuide(guide) ? (
          <CryptidesGuide guide={guide} />
        ) : isAdsBuyGuide(guide) ? (
          <AdsBuyGuide guide={guide} />
        ) : isArtworkLayoutsGuide(guide) ? (
          <ArtworkLayoutsGuide guide={guide} />
        ) : isArtworkGuide(guide) ? (
          <ArtworkGuide guide={guide} />
        ) : isHeroLayoutsGuide(guide) ? (
          <HeroLayoutsGuide guide={guide} />
        ) : heroesGuide ? (
          <HeroRoster guide={guide} />
        ) : isHeroTierListGuide(guide) ? (
          <HeroTierListGuide guide={guide} />
        ) : (
          <div className="guide-wide guide-plain">
            <p className="intro">{guide.intro}</p>
            <div className="guide-sections">
              {guide.sections.map((section) => (
                <section className="guide-section-card" key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.body.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </section>
              ))}
            </div>
            {guide.note ? <p className="callout">{guide.note}</p> : null}
          </div>
        )}
      </article>
      {canTextEdit && textEditing ? (
        <TextGuideEditor
          catalog="guideEntries"
          id={id}
          onDraft={setTextDraft}
          onClose={() => {
            setTextEditing(false);
            setTextDraft(null);
          }}
        />
      ) : null}
      {canWrite && target && isGuideEntryId(target.id, t.guideEntries) && (
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
