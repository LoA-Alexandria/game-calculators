"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { guideHref, guideLayout } from "../../lib/content/guides";
import { searchTheaterPlays, theaterCoverUrl, type TheaterPlay, type TheaterRole } from "../../lib/content/goddess-theater";
import { goddessNamed, goddessPortrait } from "../../lib/content/goddesses";
import { fill, type Dictionary } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { PenIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["goddessTheater"];

export function isGoddessTheaterGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Dictionary["guideEntries"]["goddessTheater"] {
  return guideLayout(guide) === "goddessTheater";
}

function RoleRow({ row, guide }: { row: TheaterRole; guide: Guide }) {
  const goddess = goddessNamed(row.goddess);
  const href = goddess ? `${guideHref("goddesses")}#${encodeURIComponent(goddess.id)}` : null;
  const name = (
    <span className="guide-name">
      <HeroPortrait name={row.goddess} rarity={goddess?.rarity} src={goddessPortrait(row.goddess)} className="hero-portrait-small" />
      {row.goddess}
    </span>
  );
  return (
    <li className={row.relevant ? "theater-role is-relevant" : "theater-role"}>
      {href ? <Link href={href}>{name}</Link> : name}
      <span className="theater-role-part">{row.role}</span>
      {row.relevant ? <span className="theater-relevant">{guide.relevantLabel}</span> : null}
    </li>
  );
}

function PlayCard({ play, guide }: { play: TheaterPlay; guide: Guide }) {
  return (
    <article className="theater-play" id={play.id}>
      <header className="theater-play-head">
        {play.image ? (
          // Wiki cover already includes the rarity frame; do not crop it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="theater-cover"
            src={theaterCoverUrl(play.image)}
            alt=""
            width={96}
            height={108}
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <h3>{play.name}</h3>
      </header>
      {play.unlock === "tutorial" ? (
        <p className="theater-unlock">{guide.tutorialNote}</p>
      ) : (
        <ul className="theater-roles">
          {play.roles.map((row) => (
            <RoleRow key={`${row.goddess}-${row.role}`} row={row} guide={guide} />
          ))}
        </ul>
      )}
    </article>
  );
}

export function GoddessTheaterGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const { allows } = useAuth();
  const [query, setQuery] = useState("");
  const plays = useMemo(() => searchTheaterPlays(query), [query]);

  return (
    <div className="guide-wide theater-guide">
      <p className="intro">{guide.intro}</p>
      {guide.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      ))}

      <div className="tier-lists-head">
        <h2>{guide.playsHeading}</h2>
        {allows("guides.draft") ? (
          <Link className="small-button" href="/guides/goddess-theater/edit/">
            <PenIcon className="icon icon-sm" />
            {t.theaterEditor.openEditor}
          </Link>
        ) : null}
      </div>
      <p className="guide-lede">{guide.playsLede}</p>
      <label className="hero-search theater-search">
        <span className="visually-hidden">{guide.searchLabel}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={guide.searchPlaceholder}
        />
      </label>
      <p className="hero-count" aria-live="polite">{fill(guide.countLabel, { count: plays.length })}</p>
      {plays.length === 0 ? (
        <p className="empty-state">{guide.empty}</p>
      ) : (
        <div className="theater-grid">
          {plays.map((play) => (
            <PlayCard key={play.id} play={play} guide={guide} />
          ))}
        </div>
      )}
      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
