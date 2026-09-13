"use client";

import { useState } from "react";
import Link from "next/link";
import { NEWS } from "../lib/content/news";
import { guideCount, toolCount } from "../lib/navigation";
import { useDocumentTitle, useLocale } from "./components/LocaleProvider";
import { ChevronIcon } from "./components/Icons";

export default function Home() {
  const { t, n } = useLocale();
  useDocumentTitle(t.nav.home);
  return (
    <>
      <NewsHero />
      <section className="section" aria-label={t.home.eyebrow}>
        <dl className="stat-row">
          <div>
            <dt>{t.home.statTools}</dt>
            <dd>{n(toolCount())}</dd>
          </div>
          <div>
            <dt>{t.home.statGuides}</dt>
            <dd>{n(guideCount())}</dd>
          </div>
          <div>
            <dt>{t.home.statCost}</dt>
            <dd>{t.home.statCostValue}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

/**
 * The overview leads with the news slide. Tools, events, and guides live in
 * the sidebar; the counts below only summarise what the site currently offers.
 */
function NewsHero() {
  const { t, tf, d } = useLocale();
  const entries = NEWS.slice(0, 4);
  const [index, setIndex] = useState(0);

  if (entries.length === 0) {
    return (
      <section className="hero hero-news">
        <div className="eyebrow">{t.home.latestNews}</div>
        <h1>{t.news.title}</h1>
        <p className="lede">{t.news.empty}</p>
      </section>
    );
  }

  const entry = entries[Math.min(index, entries.length - 1)];
  const move = (step: number) =>
    setIndex((current) => (current + step + entries.length) % entries.length);

  return (
    <section className="hero hero-news" aria-roledescription="carousel" aria-label={t.home.latestNews}>
      <div className="news-slide" aria-live="polite">
        <div className="news-slide-head">
          <span className="eyebrow">{t.home.latestNews}</span>
          <div className="news-slide-controls">
            <button type="button" aria-label={t.home.newsPrevious} onClick={() => move(-1)}>
              <ChevronIcon className="icon icon-sm calendar-prev" />
            </button>
            <span className="mono">{tf(t.home.newsPosition, { n: index + 1, total: entries.length })}</span>
            <button type="button" aria-label={t.home.newsNext} onClick={() => move(1)}>
              <ChevronIcon className="icon icon-sm" />
            </button>
          </div>
        </div>
        <time className="mono" dateTime={entry.date}>{d(entry.date)}</time>
        <h1>{entry.title(t)}</h1>
        <p className="lede">{entry.summary(t)}</p>
        <div className="hero-actions">
          <Link className="button button-primary" href={entry.href ?? "/news/"}>
            {t.common.readMore} <span aria-hidden="true">→</span>
          </Link>
          <Link className="button button-secondary" href="/news/">{t.home.allNews}</Link>
        </div>
      </div>
    </section>
  );
}
