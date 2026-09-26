"use client";

import { guideLayout } from "../../lib/content/guides";
import { CRYPTID_FORMATION, CRYPTID_PRIORITY, cryptideById } from "../../lib/content/cryptid-layout";
import { cryptideImageUrl, localizedCryptideName, type CryptideTexts } from "../../lib/content/cryptides";
import { fill, type Dictionary } from "../../lib/i18n";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["cryptidLayout"];

export function isCryptidLayoutGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "cryptidLayout";
}

/**
 * Autumn's opening line-up: a row per group, the slot numbers on the left, the
 * Cryptides that go there beside them, and the reason underneath. The first row
 * holds two, so the pictures sit in a row of their own rather than in a fixed
 * first-and-second column.
 */
function Formation({ guide, texts }: { guide: Guide; texts: CryptideTexts }) {
  return (
    <ol className="cryptid-formation">
      {CRYPTID_FORMATION.map((group) => (
        <li key={group.id}>
          <span className="cryptid-formation-slot mono">
            {fill(guide.slotLabel, { slots: group.slots.join("–") })}
          </span>
          <div className="cryptid-formation-who">
            {group.cryptides.map((id) => {
              const cryptide = cryptideById(id);
              if (!cryptide) return null;
              return (
                <span className="cryptid-formation-one" key={id}>
                  {/* A static export cannot optimise images; the portrait is already a small WebP. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="cryptid-formation-art"
                    src={cryptideImageUrl(cryptide.image)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <strong>{localizedCryptideName(cryptide, texts)}</strong>
                </span>
              );
            })}
          </div>
          <p>{guide.slotReasons[group.id as keyof Guide["slotReasons"]]}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * The order to raise them in: a path of numbered steps, each showing the
 * Cryptides it is about and the rarity it pushes them to. The second step is
 * an order rather than a set, so its pictures are numbered as well.
 */
function Priority({ guide, texts }: { guide: Guide; texts: CryptideTexts }) {
  return (
    <ol className="cryptid-path">
      {CRYPTID_PRIORITY.map((step) => (
        <li key={step.id}>
          <p className="cryptid-path-line">
            <strong>{guide.prioritySteps[step.id as keyof Guide["prioritySteps"]]}</strong>
            <span className="cryptid-path-target" data-rarity={step.target}>
              {fill(guide.priorityTarget, { rarity: step.target })}
            </span>
          </p>
          <ul className="cryptid-path-who">
            {step.cryptides.map((id, index) => {
              const cryptide = cryptideById(id);
              if (!cryptide) return null;
              return (
                <li key={id}>
                  {step.ordered ? <span className="cryptid-path-rank mono">{index + 1}</span> : null}
                  {/* A static export cannot optimise images; the portrait is already a small WebP. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cryptideImageUrl(cryptide.image)} alt="" loading="lazy" decoding="async" />
                  <span>{localizedCryptideName(cryptide, texts)}</span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function CryptidLayoutGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  // Names come from the Cryptides guide, so a Cryptide is called the same on
  // both pages, in the reader's language.
  const texts = t.guideEntries.cryptides.cryptideTexts as CryptideTexts;

  return (
    <div className="guide-wide cryptid-layout-guide">
      <p className="intro">{guide.intro}</p>

      <h2>{guide.formationHeading}</h2>
      <p className="guide-lede">{guide.formationLede}</p>
      <Formation guide={guide} texts={texts} />
      <p className="callout">{guide.formationSwap}</p>

      <h2>{guide.priorityHeading}</h2>
      <p className="guide-lede">{guide.priorityLede}</p>
      <Priority guide={guide} texts={texts} />

      <h2>{guide.towerHeading}</h2>
      {guide.towerBody.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      <ul className="cryptid-tower-levels">
        {guide.towerLevels.map((row) => (
          <li key={row.tier}>
            <strong>{row.tier}</strong>
            <span className="mono">{row.target}</span>
            {row.note ? <small>{row.note}</small> : null}
          </li>
        ))}
      </ul>
      <p className="cryptid-tower-note">{guide.towerNote}</p>

      {guide.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      ))}

      <p className="hero-credit">{guide.sourceNote}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
