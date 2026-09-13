"use client";

import { guideLayout } from "../../lib/content/guides";
import type { Dictionary } from "../../lib/i18n";

type Guide = Dictionary["guideEntries"]["artwork"];
type Build = NonNullable<Guide["builds"]>[number];

export function isArtworkGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Dictionary["guideEntries"]["artwork"] {
  return guideLayout(guide) === "artwork";
}

function BuildCard({
  build,
  colSet,
  colEffect,
}: {
  build: Build;
  colSet: string;
  colEffect: string;
}) {
  return (
    <article className="build-card" data-tone={build.tone}>
      <header className="build-card-head">
        <p className="phase-kicker">{build.kicker}</p>
        <h3>{build.title}</h3>
      </header>
      {build.lede ? <p className="phase-lede">{build.lede}</p> : null}
      {build.rows.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{colSet}</th>
                <th>{colEffect}</th>
              </tr>
            </thead>
            <tbody>
              {build.rows.map((row, index) => (
                <tr key={row.name}>
                  <td data-label={colSet}>
                    <span className="guide-set">
                      <span className="guide-rank" aria-hidden="true">{index + 1}</span>
                      {row.name}
                    </span>
                  </td>
                  <td data-label={colEffect}>{row.effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}

export function ArtworkGuide({ guide }: { guide: Guide }) {
  return (
    <div className="guide-wide">
      <figure className="guide-figure" data-motif="frames" aria-hidden="true">
        <span className="guide-frame guide-frame-a" />
        <span className="guide-frame guide-frame-b" />
        <span className="guide-frame guide-frame-c" />
      </figure>

      <p className="intro">{guide.intro}</p>

      <h2>{guide.spendHeading}</h2>
      <div className="rule-grid">
        {guide.steps.map((step, index) => (
          <article className="rule-card" key={step.title}>
            <span className="phase-index" aria-hidden="true">{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </article>
        ))}
      </div>

      <h2>{guide.levelsHeading}</h2>
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

      <h2>{guide.skillsHeading}</h2>
      {guide.skillsLede ? <p className="guide-lede">{guide.skillsLede}</p> : null}
      <div className="phase-grid">
        {guide.builds.map((build) => (
          <BuildCard
            key={build.tone}
            build={build}
            colSet={guide.colSet}
            colEffect={guide.colEffect}
          />
        ))}
      </div>
    </div>
  );
}
