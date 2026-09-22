"use client";

import { useMemo, useState } from "react";
import { guideLayout } from "../../lib/content/guides";
import {
  CRYPTIDES_DATA,
  cryptideImageUrl,
  foodText,
  localizedCryptideName,
  searchCryptides,
  skillText,
  type Cryptide,
} from "../../lib/content/cryptides";
import { fill, type Dictionary } from "../../lib/i18n";

type Guide = Dictionary["guideEntries"]["cryptides"];

export function isCryptidesGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "cryptides";
}

function CryptideCard({ cryptide, guide }: { cryptide: Cryptide; guide: Guide }) {
  const name = localizedCryptideName(cryptide, guide.cryptideTexts);
  const material = guide.talentMaterials[cryptide.talentMaterial];
  const tower = guide.towers[cryptide.tower];

  return (
    <article className="cryptide-card" id={cryptide.id}>
      <header className="cryptide-card-head">
        <div className="cryptide-portrait-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cryptide-portrait" src={cryptideImageUrl(cryptide.image)} alt={name} />
          <span className="cryptide-rarity">{cryptide.rarity}</span>
        </div>
        <div className="cryptide-card-meta">
          <h3>{name}</h3>
          <p className="cryptide-tower">{fill(guide.towerLine, { tower, material })}</p>
        </div>
      </header>

      <section className="cryptide-section" aria-label={guide.skillsHeading}>
        <h4>{guide.skillsHeading}</h4>
        <ul className="cryptide-skills">
          {cryptide.skills.map((skill, index) => {
            const text = skillText(cryptide.id, skill.id, guide.cryptideTexts);
            return (
              <li key={skill.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="cryptide-icon" src={cryptideImageUrl(skill.image)} alt={text.name ?? skill.id} />
                <div>
                  <strong>
                    {fill(guide.skillRankLabel, { rank: index + 1 })} {text.name ?? skill.id}
                  </strong>
                  {text.body ? <p>{text.body}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="cryptide-section" aria-label={guide.foodsHeading}>
        <h4>{guide.foodsHeading}</h4>
        <ul className="cryptide-foods">
          {cryptide.foods.map((food) => {
            const text = foodText(cryptide.id, food.id, guide.cryptideTexts);
            return (
              <li key={food.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="cryptide-icon" src={cryptideImageUrl(food.image)} alt={text.name ?? food.id} />
                <div>
                  <strong>{text.name ?? food.id}</strong>
                  <p>{fill(guide.foodGrowth, { growth: food.growth })}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </article>
  );
}

export function CryptidesGuide({ guide }: { guide: Guide }) {
  const [query, setQuery] = useState("");
  const cryptides = useMemo(() => searchCryptides(query, guide.cryptideTexts), [guide.cryptideTexts, query]);
  const talent = CRYPTIDES_DATA.talent;

  return (
    <div className="guide-wide cryptides-guide">
      <p className="intro">{guide.intro}</p>
      {guide.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      ))}

      <h2>{guide.talentHeading}</h2>
      <p className="guide-lede">{guide.talentLede}</p>
      <ul className="cryptide-talent-rules">
        <li>{fill(guide.talentUnlock, { count: talent.unlockCost })}</li>
        <li>{fill(guide.talentDrop, { count: talent.dropAmount, levels: talent.dropEveryLevels })}</li>
      </ul>
      <ul className="cryptide-talent-map">
        {CRYPTIDES_DATA.cryptides.map((cryptide) => (
          <li key={cryptide.id}>
            <strong>{localizedCryptideName(cryptide, guide.cryptideTexts)}</strong>
            <span>
              {fill(guide.towerLine, {
                tower: guide.towers[cryptide.tower],
                material: guide.talentMaterials[cryptide.talentMaterial],
              })}
            </span>
          </li>
        ))}
      </ul>

      <h2>{guide.cryptidesHeading}</h2>
      <p className="guide-lede">{guide.cryptidesLede}</p>
      <div className="hero-filters cryptide-filters">
        <label className="visually-hidden" htmlFor="cryptide-search">
          {guide.searchLabel}
        </label>
        <input
          id="cryptide-search"
          type="search"
          value={query}
          placeholder={guide.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="tier-small">{fill(guide.countLabel, { count: cryptides.length })}</span>
      </div>
      {cryptides.length === 0 ? (
        <p className="callout">{guide.empty}</p>
      ) : (
        <div className="cryptide-grid">
          {cryptides.map((cryptide) => (
            <CryptideCard key={cryptide.id} cryptide={cryptide} guide={guide} />
          ))}
        </div>
      )}

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
