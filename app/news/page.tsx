"use client";

import { useState } from "react";
import Link from "next/link";
import { NEWS } from "../../lib/content/news";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead, SectionBanner } from "../components/Ui";
import { PenIcon, TrashIcon } from "../components/Icons";
import { NewsEditor, type NewsEditorTarget } from "./NewsEditor";

export default function NewsPage() {
  const { t, d } = useLocale();
  const { allows } = useAuth();
  const canWrite = allows("news.write");
  const [target, setTarget] = useState<NewsEditorTarget | null>(null);
  useDocumentTitle(t.news.title);

  const openEditor = (next: NewsEditorTarget) => {
    setTarget(next);
    window.setTimeout(() => document.getElementById("news-editor")?.scrollIntoView({ block: "start" }), 0);
  };

  return (
    <>
      <SectionBanner id="news" />
      <PageHead eyebrow={t.navDescriptions.news} title={t.news.title} lede={t.news.lede} />
      {NEWS.length === 0 ? (
        <div className="empty-state">{t.news.empty}</div>
      ) : (
        <div className="entry-list">
          {NEWS.map((entry) => (
            <article className="entry-card" key={entry.id}>
              <div className="entry-meta">
                <time dateTime={entry.date}>{d(entry.date)}</time>
              </div>
              <h2>{entry.title(t)}</h2>
              {entry.body(t).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {(entry.href || canWrite) && (
                <div className="entry-actions">
                  {entry.href && (
                    <Link className="small-button" href={entry.href}>
                      {t.common.open} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                  {canWrite && (
                    <>
                      <button
                        className="small-button"
                        type="button"
                        onClick={() => openEditor({ entry, action: "edit" })}
                      >
                        <PenIcon className="icon icon-sm" />
                        {t.news.edit}
                      </button>
                      <button
                        className="small-button button-danger"
                        type="button"
                        onClick={() => openEditor({ entry, action: "remove" })}
                      >
                        <TrashIcon className="icon icon-sm" />
                        {t.news.remove}
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {canWrite && target && (
        <NewsEditor
          key={`${target.action}-${target.entry.id}`}
          target={target}
          onClose={() => setTarget(null)}
          showHead={false}
        />
      )}
    </>
  );
}
