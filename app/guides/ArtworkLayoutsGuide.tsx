"use client";

import { useId, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { guideLayout } from "../../lib/content/guides";
import { ARTWORK_LAYOUT_DATA, setSkillRank } from "../../lib/content/artwork-layouts";
import type { Dictionary } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { useLocale } from "../components/LocaleProvider";
import { PenIcon } from "../components/Icons";

type Guide = Dictionary["guideEntries"]["artworkLayouts"];

export function isArtworkLayoutsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "artworkLayouts";
}

function labelOf(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

function SetSkillTabs({ guide }: { guide: Guide }) {
  const base = useId();
  const builds = ARTWORK_LAYOUT_DATA.builds;
  const [buildId, setBuildId] = useState(builds[0]?.id ?? "");
  const build = builds.find((entry) => entry.id === buildId) ?? builds[0];
  const rows = build ? setSkillRank(build.id) : [];
  const tabId = (id: string) => `${base}-tab-${id}`;
  const names = guide.buildNames as Record<string, string>;
  const notes = guide.notes as Record<string, string>;
  const reasons = guide.reasons as Record<string, string>;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = builds.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setBuildId(builds[next].id);
    document.getElementById(tabId(builds[next].id))?.focus();
  };

  const note = build?.note ? notes[build.note] : "";

  return (
    <>
      <div className="build-tabs" role="tablist" aria-label={guide.setSkillsHeading}>
        {builds.map((tab, index) => {
          const selected = tab.id === build?.id;
          return (
            <button
              key={tab.id}
              id={tabId(tab.id)}
              type="button"
              role="tab"
              className="build-tab"
              data-build={tab.id}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setBuildId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="build-dot" aria-hidden="true" />
              {labelOf(names, tab.id)}
            </button>
          );
        })}
      </div>
      <div
        className="build-panel painting-panel"
        data-build={build?.id}
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={build ? tabId(build.id) : undefined}
      >
        <ol className="set-skill-rank">
          {rows.map((row, index) => (
            <li key={`${row.set.id}-${index}`}>
              <article className="formation-rule">
                <span className="formation-rule-index" aria-hidden="true">{index + 1}</span>
                <h3>{row.set.name}</h3>
                <p>{labelOf(reasons, row.reason)}</p>
              </article>
              {row.insert ? (
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
  const { t } = useLocale();
  const { allows } = useAuth();

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

      <div className="tier-lists-head">
        <h2>{guide.setSkillsHeading}</h2>
        {allows("guides.draft") ? (
          <Link className="small-button" href="/guides/artwork-layouts/edit/">
            <PenIcon className="icon icon-sm" />
            {t.artworkLayoutEditor.openEditor}
          </Link>
        ) : null}
      </div>
      <p className="utility-lede">{guide.setSkillsLede}</p>
      <SetSkillTabs guide={guide} />
    </div>
  );
}
