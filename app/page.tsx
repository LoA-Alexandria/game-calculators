"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { PREMIUM_PERIOD_DAYS, PREMIUM_PRICE_EUR } from "../lib/content/premium";
import { NEWS } from "../lib/content/news";
import { guideCount, toolCount } from "../lib/navigation";
import { asset } from "../lib/site";
import { useAuth } from "./components/AuthProvider";
import { useDocumentTitle, useLocale } from "./components/LocaleProvider";
import { ChevronIcon } from "./components/Icons";

export default function Home() {
  const { t, n } = useLocale();
  useDocumentTitle(t.nav.home);
  return (
    <>
      <NewsHero />
      <PremiumPromo />
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

/** The overview leads with the news slide, then Premium, then the site counts. */
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
    <section
      className="hero hero-news"
      aria-roledescription="carousel"
      aria-label={t.home.latestNews}
      style={{ "--hero-news-image": `url("${asset("/banners/guides-scene.webp")}")` } as CSSProperties}
    >
      <div className="news-slide" aria-live="polite">
        <div className="news-slide-head">
          <span className="eyebrow">{t.home.latestNews}</span>
          <div className="news-slide-controls">
            <button type="button" aria-label={t.home.newsPrevious} onClick={() => move(-1)}>
              <ChevronIcon className="icon icon-sm chevron-prev" />
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

/** Short Premium advert on the overview; buy CTA lives here instead of the topbar. */
function PremiumPromo() {
  const { t, tf } = useLocale();
  const { session } = useAuth();
  const priceVars = { price: PREMIUM_PRICE_EUR, days: PREMIUM_PERIOD_DAYS };

  if (session?.premium) {
    return (
      <section className="section home-premium" aria-labelledby="home-premium-heading">
        <div className="home-premium-panel panel is-active">
          <div className="home-premium-copy">
            <span className="eyebrow">{t.premium.badge}</span>
            <h2 id="home-premium-heading">{t.premium.activeTitle}</h2>
            <p>{t.home.premiumActiveLede}</p>
            <div className="home-premium-actions">
              <Link className="button button-secondary" href="/premium/">
                {t.home.premiumManage}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section home-premium" aria-labelledby="home-premium-heading">
      <div className="home-premium-panel panel">
        <div className="home-premium-copy">
          <span className="eyebrow">{t.premium.badge}</span>
          <h2 id="home-premium-heading">{t.home.premiumTitle}</h2>
          <p>{tf(t.home.premiumLede, priceVars)}</p>
          <ul className="home-premium-perks">
            <li>{t.home.premiumPerkTools}</li>
            <li>{t.home.premiumPerkGuild}</li>
            <li>{t.home.premiumPerkSupport}</li>
          </ul>
          <div className="home-premium-actions">
            <Link
              className="button button-primary"
              href="/premium/"
              title={tf(t.shell.buyPremiumTitle, { price: PREMIUM_PRICE_EUR })}
            >
              {tf(t.shell.buyPremium, { price: PREMIUM_PRICE_EUR })}
            </Link>
            <Link className="button button-secondary" href="/premium/">
              {t.home.premiumLearnMore}
            </Link>
          </div>
        </div>
        <p className="home-premium-price mono" aria-hidden="true">
          €{PREMIUM_PRICE_EUR}
        </p>
      </div>
    </section>
  );
}
