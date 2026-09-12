"use client";

import Link from "next/link";
import { NEWS } from "../lib/content/news";
import { sectionById, toolCount } from "../lib/navigation";
import { useDocumentTitle, useLocale } from "./components/LocaleProvider";
import { ToolCard } from "./components/Ui";

const PLANNER_HREF = "/simulations/irrigation-planner/";

export default function Home() {
  const { t, n, d } = useLocale();
  useDocumentTitle(t.nav.home);
  const calculators = sectionById("calculators");
  const simulations = sectionById("simulations");
  const planner = simulations.items.find((item) => item.href === PLANNER_HREF);
  const latest = NEWS.slice(0, 2);

  return (
    <>
      <section className="hero">
        <div className="eyebrow">{t.home.eyebrow}</div>
        <h1>{t.home.title}</h1>
        <p className="lede">{t.home.lede}</p>
        <div className="hero-actions">
          <Link className="button button-primary" href={PLANNER_HREF}>
            {t.home.primaryAction} <span aria-hidden="true">→</span>
          </Link>
          <Link className="button button-secondary" href="/calculators/">
            {t.home.secondaryAction}
          </Link>
        </div>
        <dl className="hero-stats">
          <div>
            <dt>{t.home.statTools}</dt>
            <dd>{n(toolCount())}</dd>
          </div>
          <div>
            <dt>{t.home.statSlots}</dt>
            <dd>{n(576)}</dd>
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
          {calculators.items.map((item) => (
            <ToolCard item={item} key={item.href} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t.navDescriptions.news}</div>
            <h2>{t.home.latestNews}</h2>
          </div>
          <Link className="small-button" href="/news/">{t.home.allNews}</Link>
        </div>
        <div className="entry-list">
          {latest.map((entry) => (
            <article className="entry-card" key={entry.id}>
              <div className="entry-meta">
                <time dateTime={entry.date}>{d(entry.date)}</time>
              </div>
              <h3>{entry.title(t)}</h3>
              <p>{entry.summary(t)}</p>
            </article>
          ))}
        </div>
      </section>

      <p className="assumption">{t.home.privacy}</p>
    </>
  );
}
