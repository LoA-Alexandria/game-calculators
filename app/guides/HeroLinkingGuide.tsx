"use client";

import Link from "next/link";
import { guideHref, guideLayout } from "../../lib/content/guides";
import {
  LINK_SOURCES,
  linkNote,
  linksBySource,
  priorityNote,
  LINKING_DATA,
} from "../../lib/content/hero-linking";
import { heroNamed, heroPortrait } from "../../lib/content/heroes";
import { DEFAULT_LOCALE, fill, getDictionary, type Dictionary } from "../../lib/i18n";
import { HeroPortrait } from "../components/HeroPortrait";
import { useGuideData } from "./GuideOverrides";

type Guide = Dictionary["guideEntries"]["heroLinking"];

export function isHeroLinkingGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Dictionary["guideEntries"]["heroLinking"] {
  return guideLayout(guide) === "heroLinking";
}

/** A hero's portrait and name, linked into the Heroes roster when it knows them. */
function HeroName({ hero }: { hero: string }) {
  const found = heroNamed(hero);
  const name = (
    <span className="guide-name">
      <HeroPortrait name={hero} rarity={found?.rarity} src={heroPortrait(hero)} className="hero-portrait-small" />
      {hero}
    </span>
  );
  if (!found) return name;
  return <Link href={`${guideHref("heroes")}#${encodeURIComponent(found.id)}`}>{name}</Link>;
}

export function HeroLinkingGuide({ guide }: { guide: Guide }) {
  // The build carries the guide; a published edit lies over it a moment later.
  const data = useGuideData<typeof LINKING_DATA>("hero-linking");
  // A note nobody has translated yet shows its English text rather than nothing.
  const english = getDictionary(DEFAULT_LOCALE).guideEntries.heroLinking.linkTexts;

  return (
    <div className="guide-wide linking-guide">
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
        <h2>{guide.linksHeading}</h2>
      </div>
      <p className="guide-lede">{guide.linksLede}</p>
      <div className="linking-tracks">
        {LINK_SOURCES.map((source) => {
          const links = linksBySource(source, data.links);
          if (links.length === 0) return null;
          return (
            <section className="linking-track" key={source} aria-label={guide.sources[source]}>
              <h3>{guide.sources[source]}</h3>
              <ul className="linking-list">
                {links.map((link) => {
                  const note = linkNote(link.hero, guide.linkTexts, english);
                  return (
                    <li className="linking-row" key={link.hero}>
                      <span className="linking-step">{fill(guide.stepLabel, { step: link.step })}</span>
                      <HeroName hero={link.hero} />
                      {note ? <span className="linking-note">{note}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <h2>{guide.priorityHeading}</h2>
      <p className="guide-lede">{guide.priorityLede}</p>
      <ol className="linking-list linking-priority">
        {data.priority.map((target, index) => {
          const note = priorityNote(target.hero, guide.linkTexts, english);
          return (
            <li className="linking-row" key={target.hero}>
              <span className="linking-rank">{fill(guide.rankLabel, { rank: index + 1 })}</span>
              <HeroName hero={target.hero} />
              {note ? <span className="linking-note">{note}</span> : null}
            </li>
          );
        })}
      </ol>

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
