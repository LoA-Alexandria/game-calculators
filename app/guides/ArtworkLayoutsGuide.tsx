"use client";

import { useId, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { guideLayout } from "../../lib/content/guides";
import {
  SET_SKILL_BUILDS,
  setSkillRank,
  type SetSkillBuild,
} from "../../lib/content/artwork";
import type { Dictionary } from "../../lib/i18n";

type Guide = Dictionary["guideEntries"]["artworkLayouts"];

export function isArtworkLayoutsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "artworkLayouts";
}

function asBuild(id: string): SetSkillBuild {
  return (SET_SKILL_BUILDS as readonly string[]).includes(id) ? id as SetSkillBuild : "crit";
}

function SetSkillTabs({ guide }: { guide: Guide }) {
  const base = useId();
  const [build, setBuild] = useState<SetSkillBuild>("crit");
  const rows = setSkillRank(build);
  const tabId = (id: SetSkillBuild) => `${base}-tab-${id}`;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = SET_SKILL_BUILDS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setBuild(SET_SKILL_BUILDS[next]);
    document.getElementById(tabId(SET_SKILL_BUILDS[next]))?.focus();
  };

  const note =
    build === "pursuit" ? guide.pursuitNote
    : build === "dot" ? guide.dotNote
    : build === "hybrid" ? guide.hybridNote
    : guide.restNote;

  return (
    <>
      <div className="build-tabs" role="tablist" aria-label={guide.setSkillsHeading}>
        {guide.setSkills.map((tab, index) => {
          const id = asBuild(tab.id);
          const selected = id === build;
          return (
            <button
              key={tab.id}
              id={tabId(id)}
              type="button"
              role="tab"
              className="build-tab"
              data-build={id}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setBuild(id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="build-dot" aria-hidden="true" />
              {tab.name}
            </button>
          );
        })}
      </div>
      <div
        className="build-panel painting-panel"
        data-build={build}
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={tabId(build)}
      >
        <ol className="set-skill-rank">
          {rows.map((row, index) => (
            <li key={row.set.id}>
              <article className="formation-rule">
                <span className="formation-rule-index" aria-hidden="true">{index + 1}</span>
                <h3>{row.set.name}</h3>
                <p>{guide.reasons[row.reason]}</p>
              </article>
              {row.hybridSlot ? (
                <p className="set-skill-insert">{guide.hybridSlot}</p>
              ) : null}
            </li>
          ))}
        </ol>
        {note ? <p className="set-skill-note">{note}</p> : null}
      </div>
    </>
  );
}

export function ArtworkLayoutsGuide({ guide }: { guide: Guide }) {
  return (
    <div className="guide-wide hero-layouts artwork-layouts">
      <p className="intro">{guide.intro}</p>
      <p className="guide-credit">
        <span>{guide.credit}</span>
        <span>{guide.creditDate}</span>
        {guide.status ? <span className="build-status">{guide.status}</span> : null}
      </p>
      <p className="callout">
        {guide.catalogueLede}{" "}
        <Link href="/guides/artwork/">{guide.catalogueLink}</Link>
      </p>

      <div className="formation-intro artwork-spend">
        <div>
          <h2>{guide.spendHeading}</h2>
          <div className="formation-rules">
            {guide.steps.map((step, index) => (
              <article className="formation-rule" key={step.title}>
                <span className="formation-rule-index" aria-hidden="true">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h2>{guide.levelsHeading}</h2>
          {guide.levelsLede ? <p className="utility-lede">{guide.levelsLede}</p> : null}
          <div className="table-scroll panel guide-table-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{guide.colRank}</th>
                  <th>{guide.colRarity}</th>
                  <th>{guide.colStat}</th>
                </tr>
              </thead>
              <tbody>
                {guide.levels.map((row) => (
                  <tr key={`${row.rarity}-${row.stat}`}>
                    <td data-label={guide.colRank}><strong className="mono">{row.rank}</strong></td>
                    <td data-label={guide.colRarity}>
                      <span className="rarity" data-rarity={row.rarity}>{row.rarity}</span>
                    </td>
                    <td data-label={guide.colStat}>{row.stat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2>{guide.setSkillsHeading}</h2>
      <p className="utility-lede">{guide.setSkillsLede}</p>
      <SetSkillTabs guide={guide} />
    </div>
  );
}
