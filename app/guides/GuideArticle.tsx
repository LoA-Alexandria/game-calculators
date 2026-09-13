"use client";

import { useState } from "react";
import { isGuideEntryId, type GuideEntryId } from "../../lib/content/guides";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { BackLink, PageHead } from "../components/Ui";
import { PenIcon, TrashIcon } from "../components/Icons";
import { GuideEditor, type GuideEditorTarget } from "./GuideEditor";
import { GoddessesGuide, isGoddessesGuide } from "./GoddessesGuide";
import { ArtworkGuide, isArtworkGuide } from "./ArtworkGuide";
import { HeroLayoutsGuide, isHeroLayoutsGuide } from "./HeroLayoutsGuide";
import { HeroRoster, isHeroesGuide } from "./HeroRoster";

export function GuideArticle({ id }: { id: GuideEntryId }) {
  const { t } = useLocale();
  const { allows } = useAuth();
  const guide = t.guideEntries[id];
  const canWrite = allows("guides.draft");
  const [target, setTarget] = useState<GuideEditorTarget | null>(null);
  useDocumentTitle(guide.title);

  const openEditor = (action: GuideEditorTarget["action"]) => {
    setTarget({ id, action });
    window.setTimeout(() => document.getElementById("guide-editor")?.scrollIntoView({ block: "start" }), 0);
  };

  return (
    <>
      <BackLink href="/guides/" label={t.nav.guides} />
      <PageHead eyebrow={t.nav.guides} title={guide.title} />
      {canWrite && (
        <div className="entry-actions" style={{ marginTop: -8, marginBottom: 18 }}>
          <button className="small-button" type="button" onClick={() => openEditor("edit")}>
            <PenIcon className="icon icon-sm" />
            {t.guides.edit}
          </button>
          <button className="small-button button-danger" type="button" onClick={() => openEditor("remove")}>
            <TrashIcon className="icon icon-sm" />
            {t.guides.remove}
          </button>
        </div>
      )}
      <article className="article">
        {isGoddessesGuide(guide) ? (
          <GoddessesGuide guide={guide} />
        ) : isArtworkGuide(guide) ? (
          <ArtworkGuide guide={guide} />
        ) : isHeroLayoutsGuide(guide) ? (
          <HeroLayoutsGuide guide={guide} />
        ) : isHeroesGuide(guide) ? (
          <HeroRoster guide={guide} />
        ) : (
          <>
            <p className="intro">{guide.intro}</p>
            {guide.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.body.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </section>
            ))}
            {guide.note ? <p className="callout">{guide.note}</p> : null}
          </>
        )}
      </article>
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
