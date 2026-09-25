"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CalculatorHeader } from "../../components/CalculatorHeader";
import { useLocale } from "../../components/LocaleProvider";
import { PremiumGate } from "../../components/PremiumGate";
import { createPersistentStore } from "../../components/persistentStore";
import {
  GODDESS_APTITUDES,
  INCOME_PLAYS,
  PLAY_RARITIES,
  REHEARSAL_EVENTS,
  deployment,
  incomePlay,
  performance,
  redCarpetPoints,
  upgradeGains,
  type Deployment,
  type IncomePlay,
  type PlayNumbers,
  type RehearsalEvent,
  type TheaterStats,
} from "../../../lib/calculators/theater-income";
import { localizedPlayName } from "../../../lib/content/goddess-theater";
import { GODDESSES, goddessPortrait } from "../../../lib/content/goddesses";

/** What a player typed; strings, so a half-typed "268." stays in the field. */
type PlayInput = { ticket?: string; visitors?: string; bonus?: string };
type Saved = {
  ticketPercent: string;
  visitorPercent: string;
  merchandise: string;
  event: RehearsalEvent;
  play: string;
  owned: string[];
  plays: Record<string, PlayInput>;
};

// The page opens on example values and every goddess whose aptitudes are recorded, so the first numbers mean something.
const DEFAULTS: Saved = {
  ticketPercent: "270",
  visitorPercent: "268.5",
  merchandise: "810",
  event: "none",
  play: "robinson-crusoe",
  owned: GODDESS_APTITUDES.map((goddess) => goddess.name),
  plays: {},
};

function parseSaved(raw: string | null): Saved | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Saved>;
    if (!value || typeof value !== "object") return null;
    const text = (field: unknown, fallback: string) => (typeof field === "string" ? field : fallback);
    return {
      ticketPercent: text(value.ticketPercent, DEFAULTS.ticketPercent),
      visitorPercent: text(value.visitorPercent, DEFAULTS.visitorPercent),
      merchandise: text(value.merchandise, DEFAULTS.merchandise),
      event: REHEARSAL_EVENTS.includes(value.event as RehearsalEvent) ? (value.event as RehearsalEvent) : "none",
      play: typeof value.play === "string" && incomePlay(value.play) ? value.play : DEFAULTS.play,
      owned: Array.isArray(value.owned) ? value.owned.filter((name): name is string => typeof name === "string") : DEFAULTS.owned,
      plays: value.plays && typeof value.plays === "object" ? (value.plays as Record<string, PlayInput>) : {},
    };
  } catch {
    return null;
  }
}

const store = createPersistentStore<Saved>({
  key: "popepoch-theater-income",
  serverValue: DEFAULTS,
  parse: parseSaved,
  fallback: () => DEFAULTS,
  serialize: JSON.stringify,
});

/** A non-negative number, or null for an empty or unusable field. */
function amount(text: string | undefined): number | null {
  if (text === undefined || text.trim() === "") return null;
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

type Resolved = {
  entry: IncomePlay;
  ticket: string;
  visitors: string;
  bonus: string;
  deploy: Deployment | null;
  /** Typed bonus, else what auto deploy reaches; known even while the base values are missing. */
  bonusPercent: number | null;
  numbers: PlayNumbers | null;
};

function resolve(entry: IncomePlay, saved: Saved): Resolved {
  const typed = saved.plays[entry.id] ?? {};
  const ticket = typed.ticket ?? (entry.ticket ? String(entry.ticket) : "");
  const visitors = typed.visitors ?? (entry.visitors ? String(entry.visitors) : "");
  const bonus = typed.bonus ?? "";
  const deploy = deployment(entry, saved.owned);
  const bonusPercent = amount(bonus) ?? deploy?.percent ?? null;
  const base = { ticket: amount(ticket), visitors: amount(visitors) };
  const numbers =
    base.ticket !== null && base.visitors !== null && bonusPercent !== null
      ? { ticket: Math.floor(base.ticket), visitors: Math.floor(base.visitors), bonusPercent }
      : null;
  return { entry, ticket, visitors, bonus, deploy, bonusPercent, numbers };
}

export default function TheaterIncomePage() {
  const { t, tf, n } = useLocale();
  const copy = t.theaterIncome;
  const saved = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const update = (patch: Partial<Saved>) => store.set({ ...saved, ...patch });
  const updatePlay = (id: string, patch: PlayInput) =>
    update({ plays: { ...saved.plays, [id]: { ...saved.plays[id], ...patch } } });

  const playTexts = t.guideEntries.goddessTheater.playTexts;
  const playName = (entry: IncomePlay) => localizedPlayName(entry.play, playTexts);

  const stats = useMemo<TheaterStats | null>(() => {
    const ticketPercent = amount(saved.ticketPercent);
    const visitorPercent = amount(saved.visitorPercent);
    const merchandise = amount(saved.merchandise);
    if (ticketPercent === null || visitorPercent === null || merchandise === null) return null;
    return { ticketPercent, visitorPercent, merchandise, event: saved.event };
  }, [saved.ticketPercent, saved.visitorPercent, saved.merchandise, saved.event]);

  const rows = useMemo(() => INCOME_PLAYS.map((entry) => resolve(entry, saved)), [saved]);
  const current = rows.find((row) => row.entry.id === saved.play) ?? rows[0];
  const result = stats && current.numbers ? performance(current.numbers, stats) : null;
  const gains = stats && current.numbers ? upgradeGains(current.numbers, stats) : null;
  const typed = saved.plays[current.entry.id];
  const factor = (percent: number, event: number) => n(1 + (percent + event) / 100, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const eventShift = (kind: "ticket" | "visitors") =>
    saved.event === `${kind}Up` ? 5 : saved.event === `${kind}Down` ? -5 : 0;
  const bonusFactor = current.numbers ? n(1 + current.numbers.bonusPercent / 100, { minimumFractionDigits: 2 }) : "";

  const invalid = (text: string) => amount(text) === null;
  const toggle = (name: string) =>
    update({ owned: saved.owned.includes(name) ? saved.owned.filter((owned) => owned !== name) : [...saved.owned, name] });
  const matchText = (count: number) => (count === 1 ? copy.matchOne : tf(copy.matchMany, { count }));

  return (
    <>
      <CalculatorHeader eyebrow={copy.eyebrow} title={t.tools.theaterIncome.name} description={copy.intro} />

      <PremiumGate>
      <section className="calculator-panel theater-panel" aria-label={t.tools.theaterIncome.name}>
        <div className="calculator-form">
          <h2 className="theater-heading">{copy.statsHeading}</h2>
          <div className="input-row">
            <div className="field">
              <label htmlFor="theater-ticket-percent">
                {copy.ticketPercent} <span className="label-note">%</span>
              </label>
              <input
                id="theater-ticket-percent"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={saved.ticketPercent}
                aria-invalid={invalid(saved.ticketPercent)}
                onChange={(event) => update({ ticketPercent: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="theater-visitor-percent">
                {copy.visitorPercent} <span className="label-note">%</span>
              </label>
              <input
                id="theater-visitor-percent"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={saved.visitorPercent}
                aria-invalid={invalid(saved.visitorPercent)}
                onChange={(event) => update({ visitorPercent: event.target.value })}
              />
            </div>
          </div>
          <div className="input-row">
            <div className="field">
              <label htmlFor="theater-merchandise">{copy.merchandise}</label>
              <input
                id="theater-merchandise"
                type="number"
                inputMode="numeric"
                min="0"
                value={saved.merchandise}
                aria-invalid={invalid(saved.merchandise)}
                onChange={(event) => update({ merchandise: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="theater-event">{copy.event}</label>
              <select id="theater-event" value={saved.event} onChange={(event) => update({ event: event.target.value as RehearsalEvent })}>
                {REHEARSAL_EVENTS.map((id) => (
                  <option key={id} value={id}>{copy.events[id]}</option>
                ))}
              </select>
            </div>
          </div>
          {!stats ? <p className="result-error">{copy.invalid}</p> : null}

          <h2 className="theater-heading">{copy.playHeading}</h2>
          <div className="field">
            <label htmlFor="theater-play">{copy.play}</label>
            <select id="theater-play" value={current.entry.id} onChange={(event) => update({ play: event.target.value })}>
              {PLAY_RARITIES.map((rarity) => (
                <optgroup key={rarity} label={rarity}>
                  {INCOME_PLAYS.filter((entry) => entry.rarity === rarity).map((entry) => (
                    <option key={entry.id} value={entry.id}>{playName(entry)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="input-row">
            <div className="field">
              <label htmlFor="theater-base-ticket">{copy.baseTicket}</label>
              <input
                id="theater-base-ticket"
                type="number"
                inputMode="numeric"
                min="0"
                value={current.ticket}
                onChange={(event) => updatePlay(current.entry.id, { ticket: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="theater-base-visitors">{copy.baseVisitors}</label>
              <input
                id="theater-base-visitors"
                type="number"
                inputMode="numeric"
                min="0"
                value={current.visitors}
                onChange={(event) => updatePlay(current.entry.id, { visitors: event.target.value })}
              />
            </div>
          </div>
          <p className="theater-note">{copy.baseNote}</p>
          <div className="field">
            <label htmlFor="theater-bonus">
              {copy.bonus} <span className="label-note">%</span>
            </label>
            <input
              id="theater-bonus"
              type="number"
              inputMode="numeric"
              min="0"
              step="10"
              value={current.bonus}
              placeholder={current.deploy ? String(current.deploy.percent) : ""}
              onChange={(event) => updatePlay(current.entry.id, { bonus: event.target.value })}
            />
          </div>
          <p className="theater-note">
            {current.deploy
              ? tf(current.deploy.exact ? copy.bonusFromGoddesses : copy.bonusAtLeast, { percent: current.deploy.percent })
              : copy.bonusUnknown}{" "}
            {copy.bonusNote}
          </p>
          {typed && Object.values(typed).some((value) => value !== undefined) ? (
            <button
              type="button"
              className="small-button"
              onClick={() => update({ plays: Object.fromEntries(Object.entries(saved.plays).filter(([id]) => id !== current.entry.id)) })}
            >
              {copy.reset}
            </button>
          ) : null}
        </div>

        <div className="result-panel" aria-live="polite">
          <span className="result-label">{tf(copy.totalFor, { play: playName(current.entry) })}</span>
          <strong className="result-number">{result ? n(result.total) : "—"}</strong>
          {result && current.numbers && stats ? (
            <>
              <div className="metric-grid">
                <div>
                  <span>{copy.ticketIncome}</span>
                  <strong>{n(result.ticketIncome)}</strong>
                </div>
                <div>
                  <span>{copy.merchandiseIncome}</span>
                  <strong>{n(result.merchandiseIncome)}</strong>
                </div>
                <div>
                  <span>{copy.redCarpet}</span>
                  <strong>{tf(copy.redCarpetRange, { low: n(redCarpetPoints(result.total)[0]), high: n(redCarpetPoints(result.total)[1]) })}</strong>
                </div>
              </div>
              <div className="result-breakdown">
                <span>{tf(copy.stepTicket, { base: n(current.numbers.ticket), factor: factor(stats.ticketPercent, eventShift("ticket")), value: n(result.ticketPrice) })}</span>
                <span>{tf(copy.stepAudience, { base: n(current.numbers.visitors), factor: factor(stats.visitorPercent, eventShift("visitors")), value: n(result.audience) })}</span>
                <span>{tf(copy.stepTicketIncome, { price: n(result.ticketPrice), audience: n(result.audience), bonus: bonusFactor, value: n(result.ticketIncome) })}</span>
                <span>{tf(copy.stepMerchandise, { merchandise: n(Math.floor(stats.merchandise)), audience: n(result.audience), bonus: bonusFactor, value: n(result.merchandiseIncome) })}</span>
              </div>
              {gains ? (
                <p className="result-note theater-upgrade">
                  {tf(copy.upgradeHint, { visitors: n(gains.visitors), ticket: n(gains.ticket) })}{" "}
                  <strong>{gains.visitors >= gains.ticket ? copy.upgradeVisitors : copy.upgradeTicket}</strong>
                </p>
              ) : null}
            </>
          ) : (
            <span className="result-note">{copy.missing}</span>
          )}
        </div>
      </section>

      <section className="surface theater-goddesses" aria-labelledby="theater-goddesses-heading">
        <div className="section-heading compact-heading">
          <h2 id="theater-goddesses-heading">{copy.goddessesHeading}</h2>
          <div className="theater-goddess-actions">
            <button type="button" className="small-button" onClick={() => update({ owned: GODDESSES.map((goddess) => goddess.name) })}>
              {copy.goddessesAll}
            </button>
            <button type="button" className="small-button" onClick={() => update({ owned: [] })}>
              {copy.goddessesNone}
            </button>
          </div>
        </div>
        <p className="theater-lede">{copy.goddessesLede}</p>
        <ul className="theater-goddess-list">
          {GODDESSES.map((goddess) => {
            const portrait = goddessPortrait(goddess.name);
            const sent = current.deploy?.goddesses.find((row) => row.name === goddess.name);
            return (
              <li key={goddess.id}>
                <button
                  type="button"
                  className="theater-goddess"
                  data-rarity={goddess.rarity}
                  aria-pressed={saved.owned.includes(goddess.name)}
                  onClick={() => toggle(goddess.name)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {portrait ? <img src={portrait} alt="" width={40} height={40} loading="lazy" decoding="async" /> : <span className="theater-goddess-blank" aria-hidden="true" />}
                  <span className="theater-goddess-text">
                    <span className="theater-goddess-name">{goddess.name}</span>
                    {sent ? <span className="theater-goddess-sent">{tf(copy.sentBonus, { percent: sent.matches * 10 })}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="theater-note">
          {current.entry.aptitudes
            ? tf(copy.playAptitudes, {
                play: playName(current.entry),
                aptitudes: current.entry.aptitudes.map((aptitude) => copy.aptitudes[aptitude]).join(" · "),
              })
            : tf(copy.playAptitudesUnknown, { play: playName(current.entry) })}
          {current.deploy && current.deploy.goddesses.length
            ? ` ${tf(copy.deployed, {
                goddesses: current.deploy.goddesses.map((row) => `${row.name} (${matchText(row.matches)})`).join(", "),
              })}`
            : null}
          {current.deploy && !current.deploy.exact ? ` ${tf(copy.unknownGoddesses, { names: current.deploy.unknown.join(", ") })}` : null}
        </p>
      </section>

      <section className="surface theater-compare" aria-labelledby="theater-compare-heading">
        <h2 id="theater-compare-heading">{copy.compareHeading}</h2>
        <p className="theater-lede">{copy.compareLede}</p>
        {PLAY_RARITIES.map((rarity) => {
          const group = rows
            .filter((row) => row.entry.rarity === rarity)
            .map((row) => ({ row, income: stats && row.numbers ? performance(row.numbers, stats).total : null }))
            .sort((a, b) => (b.income ?? -1) - (a.income ?? -1) || (b.row.bonusPercent ?? -1) - (a.row.bonusPercent ?? -1));
          const best = group[0]?.income ?? null;
          return (
            <div className="table-scroll theater-table" key={rarity}>
              <table className="data-table">
                <caption>
                  <span className="rarity" data-rarity={rarity}>{rarity}</span>
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{copy.colPlay}</th>
                    <th scope="col" className="num">{copy.colBonus}</th>
                    <th scope="col" className="num">{copy.colIncome}</th>
                    <th scope="col" className="num">{copy.colRedCarpet}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map(({ row, income }) => (
                    <tr key={row.entry.id} aria-current={row.entry.id === current.entry.id ? "true" : undefined}>
                      <th scope="row">
                        <button type="button" className="theater-row-play" onClick={() => update({ play: row.entry.id })}>
                          {playName(row.entry)}
                        </button>
                        {income !== null && income === best ? <span className="theater-best">{copy.best}</span> : null}
                      </th>
                      <td className="num">
                        {row.bonusPercent !== null
                          ? `${row.bonus.trim() === "" && row.deploy && !row.deploy.exact ? "≥ " : ""}${n(row.bonusPercent)} %`
                          : "—"}
                      </td>
                      <td className="num">{income !== null ? n(income) : <span className="theater-missing">{copy.needsValues}</span>}</td>
                      <td className="num">
                        {income !== null ? tf(copy.redCarpetRange, { low: n(redCarpetPoints(income)[0]), high: n(redCarpetPoints(income)[1]) }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </section>

      <details className="assumption">
        <summary>{copy.assumptionsTitle}</summary>
        <ul>
          {copy.assumptions.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p><strong>{copy.levelingHeading}</strong></p>
        <ul>
          {copy.leveling.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p>{copy.credit}</p>
      </details>
      <p className="assumption">{copy.storageNote}</p>
      </PremiumGate>
    </>
  );
}
