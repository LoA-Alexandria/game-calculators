"use client";

import Link from "next/link";
import { guideLayout } from "../../lib/content/guides";
import type { Dictionary } from "../../lib/i18n";

type Guide = Dictionary["guideEntries"]["artworkLayouts"];

export function isArtworkLayoutsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "artworkLayouts";
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
    </div>
  );
}
