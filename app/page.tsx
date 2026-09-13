"use client";

import { useState } from "react";
import Link from "next/link";
import { NEWS } from "../lib/content/news";
import { EVENTS } from "../lib/content/events";
import { activeAt, upcomingAfter } from "../lib/events";
import { sectionById, toolCount } from "../lib/navigation";
import { kindLabel } from "./components/EventCalendar";
import { useDocumentTitle, useLocale } from "./components/LocaleProvider";
import { useNow } from "./components/useNow";
import { ToolCard } from "./components/Ui";
import { ChevronIcon } from "./components/Icons";

const PLANNER_HREF = "/simulations/irrigation-planner/";

export default function Home() {
  const { t, n } = useLocale();
  useDocumentTitle(t.nav.home);
  const now = useNow();

  const calculators = sectionById("calculators");
  const simulations = sectionById("simulations");
  const guides = sectionById("guides");
  const planner = simulations.items.find((item) => item.href === PLANNER_HREF);

  const live = now ? activeAt(EVENTS, now) : [];
  const next = now ? upcomingAfter(EVENTS, now, 30, 3) : [];

  return (
    <>
      <NewsHero />

      <section className="section">
        <dl className="stat-row">
          <div>
            <dt>{t.home.statTools}</dt>
            <dd>{n(toolCount())}</dd>
          </div>
          <div>
            <dt>{t.home.statGuides}</dt>
            <dd>{n(guides.items.length)}</dd>
          </div>
          <div>
            <dt>{t.home.statEvents}</dt>
            <dd>{now === null ? "—" : n(live.length)}</dd>
          </div>
          <div>
            <dt>{t.home.statWater}</dt>
            <dd>{n(640)}</dd>
          </div>
          <div>
            <dt>{t.home.statCost}</dt>
            <dd>{t.home.statCostValue}</dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t.nav.events}</div>
            <h2>{live.length > 0 ? t.events.liveNow : t.events.upcoming}</h2>
          </div>
          <Link className="small-button" href="/events/">{t.events.openCalendar}</Link>
        </div>
        {now === null ? (
          <div className="empty-state">…</div>
        ) : (live.length > 0 ? live : next).length === 0 ? (
          <div className="empty-state">{t.events.noneUpcoming}</div>
        ) : (
          <div className="card-grid">
            {(live.length > 0 ? live : next).map((occurrence) => (
              <Link
                className={`tool-card event-card event-${occurrence.event.kind}`}
                href="/events/"
                key={`${occurrence.event.id}-${occurrence.start.toISOString()}`}
              >
                <div className="card-topline">
                  <span className="status">{kindLabel(occurrence.event.kind, t)}</span>
                  {live.length > 0 && <span className="pill pill-good">{t.events.liveNow}</span>}
                </div>
                <h3>{occurrence.event.name(t)}</h3>
                <p>{occurrence.event.summary(t)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t.home.quickAccess}</div>
            <h2>{t.nav.simulations}</h2>
          </div>
          <Link className="small-button" href={simulations.href}>{t.common.all}</Link>
        </div>
        {planner && (
          <Link className="featured" href={planner.href}>
            <div className="featured-body">
              <span className="status">{planner.badge?.(t)}</span>
              <h3>{planner.label(t)}</h3>
              <p>{planner.description?.(t)}</p>
              <div className="featured-tags">
                <span className="pill">{t.irrigation.tagSolver}</span>
                <span className="pill">{t.irrigation.tagTiers}</span>
                <span className="pill">{t.irrigation.tagWorkers}</span>
                <span className="pill">{t.irrigation.tagIo}</span>
              </div>
            </div>
            <div aria-hidden="true" className="featured-art" />
          </Link>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t.navDescriptions.calculators}</div>
            <h2>{t.nav.calculators}</h2>
          </div>
          <span className="count">{n(calculators.items.length)}</span>
        </div>
        <div className="card-grid">
          {calculators.items.map((item) => <ToolCard item={item} key={item.href} />)}
        </div>
      </section>

      <p className="assumption">{t.home.privacy}</p>
    </>
  );
}

/**
 * The overview opens with the newest entries rather than one fixed sentence, so
 * a returning reader sees what changed instead of the same headline every time.
 * Manual controls only — an auto-advancing carousel moves the thing you are
 * reading out from under you.
 */
function NewsHero() {
  const { t, tf, d } = useLocale();
  const entries = NEWS.slice(0, 4);
  const [index, setIndex] = useState(0);

  if (entries.length === 0) {
    return (
      <section className="hero">
        <div className="eyebrow">{t.home.eyebrow}</div>
        <h1>{t.home.title}</h1>
        <p className="lede">{t.home.lede}</p>
        <div className="hero-actions">
          <Link className="button button-primary" href={PLANNER_HREF}>
            {t.home.primaryAction} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    );
  }

  const entry = entries[Math.min(index, entries.length - 1)];
  const move = (step: number) =>
    setIndex((current) => (current + step + entries.length) % entries.length);

  return (
    <section className="hero hero-news" aria-roledescription="carousel" aria-label={t.home.latestNews}>
      <div className="eyebrow">{t.home.eyebrow}</div>
      <h1>{t.home.title}</h1>
      <p className="lede">{t.home.lede}</p>

      <div className="hero-actions">
        <Link className="button button-primary" href={PLANNER_HREF}>
          {t.home.primaryAction} <span aria-hidden="true">→</span>
        </Link>
        <Link className="button button-secondary" href="/calculators/">{t.home.secondaryAction}</Link>
      </div>

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
        <h2>{entry.title(t)}</h2>
        <p>{entry.summary(t)}</p>
        <Link className="news-slide-link" href={entry.href ?? "/news/"}>
          {t.common.readMore} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
