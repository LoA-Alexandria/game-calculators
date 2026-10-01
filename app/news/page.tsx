"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { NEWS } from "../../lib/content/news";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead, SectionBanner } from "../components/Ui";
import styles from "./news.module.css";
import { asset, BASE_PATH } from "../../lib/site";
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
        <div className={styles.grid}>
          {NEWS.map((entry) => (
            <article className={styles.card} key={entry.id}>
              <Link className={styles.cardLink} href={`/news/${entry.id}/`}>
                <div className={styles.art} aria-hidden="true">
                  {entry.image ? (
                    <Image
                      src={entry.image.startsWith("https://") || (BASE_PATH && entry.image.startsWith(`${BASE_PATH}/`)) ? entry.image : asset(entry.image)}
                      alt=""
                      fill
                      sizes="(max-width: 700px) 100vw, 50vw"
                      unoptimized
                    />
                  ) : <span>✦</span>}
                </div>
                <div className={styles.cardContent}>
                  <time className={styles.date} dateTime={entry.date}>{d(entry.date)}</time>
                  <h2>{entry.title(t)}</h2>
                  <p className={styles.excerpt}>{entry.summary(t)}</p>
                  <span className={styles.read}>{t.common.readMore} <span aria-hidden="true">→</span></span>
                </div>
              </Link>
              {canWrite && (
                <div className="entry-actions">
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
