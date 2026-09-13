"use client";

import Link from "next/link";
import { NEWS } from "../../lib/content/news";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead, SectionBanner } from "../components/Ui";

export default function NewsPage() {
  const { t, d } = useLocale();
  useDocumentTitle(t.news.title);

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
              {entry.href && (
                <p>
                  <Link className="small-button" href={entry.href}>
                    {t.common.open} <span aria-hidden="true">→</span>
                  </Link>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
