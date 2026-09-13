"use client";

import Link from "next/link";
import { sectionById } from "../../lib/navigation";
import type { Dictionary } from "../../lib/i18n";
import { ToolCard } from "../components/Ui";

type Guide = Dictionary["guideEntries"]["goddesses"];
type Phase = NonNullable<Guide["phases"]>[number];
type RosterRow = NonNullable<Guide["roster"]>[number];

export function isGoddessesGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Dictionary["guideEntries"]["goddesses"] {
  return "phases" in guide && Array.isArray((guide as { phases?: unknown }).phases);
}

function initial(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}

function NameCell({ name }: { name: string }) {
  return (
    <span className="guide-name">
      <span className="guide-avatar" aria-hidden="true">{initial(name)}</span>
      {name}
    </span>
  );
}

function PhaseCard({ phase, colName, colTarget, colHint }: {
  phase: Phase;
  colName: string;
  colTarget: string;
  colHint: string;
}) {
  const showHint = phase.rows.some((row) => row.hint);
  return (
    <article className="phase-card" data-tone={phase.tone}>
      <header className="phase-card-head">
        <span className="phase-index" aria-hidden="true">{phase.tone}</span>
        <div>
          <p className="phase-kicker">{phase.title}</p>
          <h3>{phase.subtitle}</h3>
        </div>
      </header>
      {phase.lede ? <p className="phase-lede">{phase.lede}</p> : null}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{colName}</th>
              <th>{colTarget}</th>
              {showHint ? <th>{colHint}</th> : null}
            </tr>
          </thead>
          <tbody>
            {phase.rows.map((row) => (
              <tr key={row.name}>
                <td data-label={colName}><NameCell name={row.name} /></td>
                <td data-label={colTarget}><strong className="mono">{row.target}</strong></td>
                {showHint ? <td data-label={colHint}>{row.hint || "—"}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function dash(value: string): string {
  return value.trim() ? value : "—";
}

export function GoddessesGuide({ guide }: { guide: Guide }) {
  const phases = guide.phases ?? [];
  const roster = (guide.roster ?? []).filter((row: RosterRow) => row.affinity.trim() || row.obtain.trim());
  const tools = sectionById("calculators").items.filter((item) => item.href.includes("goddess"));

  return (
    <div className="guide-wide">
      <figure className="guide-figure" aria-hidden="true">
        <span className="guide-figure-moon" />
        <span className="guide-figure-orbit" />
        <span className="guide-figure-spark" />
      </figure>

      <p className="intro">{guide.intro}</p>

      <h2>{guide.orderHeading}</h2>
      <div className="phase-grid">
        {phases.map((phase) => (
          <PhaseCard
            key={phase.tone}
            phase={phase}
            colName={guide.colName}
            colTarget={guide.colTarget}
            colHint={guide.colHint}
          />
        ))}
      </div>

      <h2>{guide.rosterHeading}</h2>
      <div className="table-scroll panel guide-table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>{guide.colName}</th>
              <th>{guide.colAffinity}</th>
              <th>{guide.colObtain}</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((row) => (
              <tr key={row.name}>
                <td data-label={guide.colName}><NameCell name={row.name} /></td>
                <td data-label={guide.colAffinity}>{dash(row.affinity)}</td>
                <td data-label={guide.colObtain}>{dash(row.obtain)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{guide.toolsHeading}</h2>
      <div className="card-grid">
        {tools.map((item) => (
          <ToolCard item={item} key={item.href} />
        ))}
      </div>
      <p className="guide-more">
        <Link href="/calculators/">{guide.toolsMore}</Link>
      </p>
    </div>
  );
}
