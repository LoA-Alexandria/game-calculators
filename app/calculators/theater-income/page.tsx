"use client";

import { useMemo, useRef, useSyncExternalStore } from "react";
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
  energyEfficiency,
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
import { PLAY_ENERGY, rarityAppearanceChance, simulateTheaterRun, theaterBuildingForLevel, theaterTierForLevel, type RarityReward } from "../../../lib/calculators/theater-session";
import { localizedPlayName } from "../../../lib/content/goddess-theater";
import { GODDESSES, goddessPortrait } from "../../../lib/content/goddesses";

/** What a player typed; strings, so a half-typed "268." stays in the field. */
type PlayInput = { ticket?: string; visitors?: string; bonus?: string };
type TheaterRunMode = "single" | "mass";
type Saved = {
  ticketPercent: string;
  visitorPercent: string;
  merchandise: string;
  event: RehearsalEvent;
  play: string;
  owned: string[];
  plays: Record<string, PlayInput>;
  theaterLevel: string;
  startingEnergy: string[];
  startingPlays: string[];
  lipsticks: string;
  lipstickSlot: string;
  runMode: TheaterRunMode;
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
  theaterLevel: "15",
  startingEnergy: ["300", "300", "300", "300", "300"],
  startingPlays: ["happy-prince", "happy-prince", "happy-prince", "happy-prince", "happy-prince"],
  lipsticks: "0",
  lipstickSlot: "0",
  runMode: "single",
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
      theaterLevel: text(value.theaterLevel, DEFAULTS.theaterLevel),
      startingEnergy: Array.isArray(value.startingEnergy)
        ? value.startingEnergy.map((energy) => (typeof energy === "string" ? energy : "300")).slice(0, 5).concat(DEFAULTS.startingEnergy).slice(0, 5)
        : DEFAULTS.startingEnergy,
      startingPlays: Array.isArray(value.startingPlays)
        ? value.startingPlays.map((play) => (typeof play === "string" ? play : "")).slice(0, 5).concat(DEFAULTS.startingPlays).slice(0, 5)
        : DEFAULTS.startingPlays,
      lipsticks: text(value.lipsticks, DEFAULTS.lipsticks),
      lipstickSlot: text(value.lipstickSlot, DEFAULTS.lipstickSlot),
      runMode: value.runMode === "mass" ? "mass" : "single",
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

function resolve(entry: IncomePlay, saved: Saved, goddessSlots: number): Resolved {
  const typed = saved.plays[entry.id] ?? {};
  const ticket = typed.ticket ?? (entry.ticket ? String(entry.ticket) : "");
  const visitors = typed.visitors ?? (entry.visitors ? String(entry.visitors) : "");
  const bonus = typed.bonus ?? "";
  const deploy = deployment(entry, saved.owned, goddessSlots);
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
  const logRef = useRef<HTMLDialogElement>(null);

  const playTexts = t.guideEntries.goddessTheater.playTexts;
  const playName = (entry: IncomePlay) => localizedPlayName(entry.play, playTexts);

  const stats = useMemo<TheaterStats | null>(() => {
    const ticketPercent = amount(saved.ticketPercent);
    const visitorPercent = amount(saved.visitorPercent);
    const merchandise = amount(saved.merchandise);
    if (ticketPercent === null || visitorPercent === null || merchandise === null) return null;
    return { ticketPercent, visitorPercent, merchandise, event: saved.event };
  }, [saved.ticketPercent, saved.visitorPercent, saved.merchandise, saved.event]);

  const level = amount(saved.theaterLevel);
  const validLevel = level !== null && Number.isSafeInteger(level) && level >= 1;
  const singleGoddessSlots = validLevel ? theaterBuildingForLevel(level).goddessSlots : 0;
  const rows = useMemo(() => INCOME_PLAYS.map((entry) => resolve(entry, saved, singleGoddessSlots)), [saved, singleGoddessSlots]);
  const current = rows.find((row) => row.entry.id === saved.play) ?? rows[0];
  const result = stats && current.numbers ? performance(current.numbers, stats) : null;
  const gains = stats && current.numbers ? upgradeGains(current.numbers, stats) : null;
  const typed = saved.plays[current.entry.id];
  const factor = (percent: number, event: number) => n(1 + (percent + event) / 100, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const eventShift = (kind: "ticket" | "visitors") =>
    saved.event === `${kind}Up` ? 5 : saved.event === `${kind}Down` ? -5 : 0;
  const bonusFactor = current.numbers ? n(1 + current.numbers.bonusPercent / 100, { minimumFractionDigits: 2 }) : "";

  const simulation = useMemo(() => {
    if (!stats || level === null || !Number.isSafeInteger(level) || level < 1) return null;
    const building = theaterBuildingForLevel(level);
    const details = INCOME_PLAYS.flatMap((entry) => {
      const values = saved.plays[entry.id] ?? {};
      const ticket = amount(values.ticket) ?? (entry.ticket ?? null);
      const visitors = amount(values.visitors) ?? (entry.visitors ?? null);
      const deploy = deployment(entry, saved.owned, building.goddessSlots);
      // Mass mode always auto-deploys the best currently owned goddesses; the
      // manual bonus override from Single mode does not change that assignment.
      const bonusPercent = deploy?.percent ?? null;
      if (ticket === null || visitors === null || bonusPercent === null) return [];
      const numbers = { ticket: Math.floor(ticket), visitors: Math.floor(visitors), bonusPercent };
      const income = performance(numbers, stats);
      const [low, high] = redCarpetPoints(income.total);
      return [{ entry, numbers, deploy, income, low, high, average: (low + high) / 2 }];
    });
    const rewardSets = PLAY_RARITIES.map((rarity) => {
      const known = details.filter(({ entry }) => entry.rarity === rarity);
      return { rarity, known };
    });
    const knownPlays = details.length;
    const rewards = Object.fromEntries(rewardSets.filter(({ known }) => known.length > 0).map(({ rarity, known }) => [rarity, {
      low: known.reduce((sum, reward) => sum + reward.low, 0) / known.length,
      average: known.reduce((sum, reward) => sum + reward.average, 0) / known.length,
      high: known.reduce((sum, reward) => sum + reward.high, 0) / known.length,
    }])) as Partial<Record<(typeof PLAY_RARITIES)[number], RarityReward>>;
    const energy = saved.startingEnergy.slice(0, building.theaterSlots).map((value) => amount(value));
    const lipsticks = amount(saved.lipsticks);
    const enteredLipstickSlot = amount(saved.lipstickSlot);
    const lipstickSlot = enteredLipstickSlot === null ? null : Math.min(enteredLipstickSlot, building.theaterSlots - 1);
    if (energy.length !== building.theaterSlots || energy.some((value) => value === null || !Number.isInteger(value) || value > 5_000)) return { building, tier: theaterTierForLevel(level), projection: null, knownPlays };
    if (lipsticks === null || !Number.isSafeInteger(lipsticks) || lipsticks > 10_000 || enteredLipstickSlot === null || lipstickSlot === null || !Number.isInteger(enteredLipstickSlot) || enteredLipstickSlot < 0) return { building, tier: theaterTierForLevel(level), projection: null, knownPlays };
    const startingPlays = saved.startingPlays.slice(0, building.theaterSlots).map((id) => details.find(({ entry }) => entry.id === id));
    if (startingPlays.length !== building.theaterSlots || startingPlays.some((play) => !play)) return { building, tier: theaterTierForLevel(level), projection: null, knownPlays, details, startingPlays: [] };
    try {
      return {
        building,
        tier: theaterTierForLevel(level),
        projection: simulateTheaterRun({
          level,
          startingEnergy: energy as number[],
          startingPlays: startingPlays.map((play) => ({ rarity: play!.entry.rarity, reward: { low: play!.low, average: play!.average, high: play!.high } })),
          lipsticks,
          lipstickSlot,
          rewards,
        }),
        knownPlays,
        details,
        startingPlays,
      };
    } catch {
      return { building, tier: theaterTierForLevel(level), projection: null, knownPlays, details, startingPlays };
    }
  }, [stats, level, saved]);

  const invalid = (text: string) => amount(text) === null;
  const toggle = (name: string) =>
    update({ owned: saved.owned.includes(name) ? saved.owned.filter((owned) => owned !== name) : [...saved.owned, name] });
  const matchText = (count: number) => (count === 1 ? copy.matchOne : tf(copy.matchMany, { count }));
  const deployedNames = (deploy: Deployment | null) => {
    const names = deploy?.goddesses.map((row) => `${row.name} (${matchText(row.matches)})`).join(", ") || copy.simulation.none;
    return deploy && !deploy.exact ? `${names} · ${copy.simulation.goddessUncertain}` : names;
  };

  return (
    <>
      <CalculatorHeader eyebrow={copy.eyebrow} title={t.tools.theaterIncome.name} description={copy.intro} />

      <PremiumGate>
      <div className="theater-calculator">
      <fieldset className="theater-mode">
        <legend>{copy.simulation.mode}</legend>
        <label>
          <input type="radio" name="theater-run-mode" value="single" checked={saved.runMode === "single"} onChange={() => update({ runMode: "single" })} />
          <span>{copy.simulation.single}</span>
        </label>
        <label>
          <input type="radio" name="theater-run-mode" value="mass" checked={saved.runMode === "mass"} onChange={() => update({ runMode: "mass" })} />
          <span>{copy.simulation.mass}</span>
        </label>
      </fieldset>
      {saved.runMode === "single" ? (
        <>
      <section className="calculator-panel theater-panel" aria-label={t.tools.theaterIncome.name}>
        <div className="calculator-form">
          <h2 className="theater-heading">{copy.statsHeading}</h2>
          <div className="field">
            <label htmlFor="theater-level-single">{copy.simulation.level}</label>
            <input id="theater-level-single" type="number" min="1" step="1" value={saved.theaterLevel} onChange={(event) => update({ theaterLevel: event.target.value })} />
            {validLevel ? <p className="theater-note">{tf(copy.simulation.singleSlots, { slots: singleGoddessSlots })}</p> : <p className="result-error">{copy.simulation.levelError}</p>}
          </div>
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
            .map((row) => {
              const income = stats && row.numbers ? performance(row.numbers, stats).total : null;
              const energy = PLAY_ENERGY[row.entry.rarity];
              return { row, income, energy, efficiency: income === null ? null : energyEfficiency(income, energy) };
            })
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
                    <th scope="col" className="num">{copy.colEnergyCost}</th>
                    <th scope="col" className="num">{copy.colIncome}</th>
                    <th scope="col" className="num">{copy.colCoinsPerEnergy}</th>
                    <th scope="col" className="num">{copy.colRedCarpet}</th>
                    <th scope="col" className="num">{copy.colRedCarpetPerEnergy}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map(({ row, income, energy, efficiency }) => (
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
                      <td className="num">{n(energy)} {copy.simulation.energyUnit}</td>
                      <td className="num">{income !== null ? n(income) : <span className="theater-missing">{copy.needsValues}</span>}</td>
                      <td className="num">{efficiency ? n(efficiency.museCoins, { maximumFractionDigits: 1 }) : "—"}</td>
                      <td className="num">
                        {income !== null ? tf(copy.redCarpetRange, { low: n(redCarpetPoints(income)[0]), high: n(redCarpetPoints(income)[1]) }) : "—"}
                      </td>
                      <td className="num">
                        {efficiency ? tf(copy.redCarpetRange, { low: n(efficiency.redCarpet[0], { maximumFractionDigits: 1 }), high: n(efficiency.redCarpet[1], { maximumFractionDigits: 1 }) }) : "—"}
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
        </>
      ) : (
        <section className="surface theater-session" aria-labelledby="theater-session-heading">
          <div className="section-heading compact-heading">
            <h2 id="theater-session-heading">{copy.simulation.heading}</h2>
          </div>
          <p className="theater-lede">{copy.simulation.massLede}</p>
          <div className="theater-mass-config">
            <div className="theater-mass-group">
              <h3>{copy.statsHeading}</h3>
              <div className="input-row theater-session-inputs">
                <div className="field"><label htmlFor="theater-ticket-percent-mass">{copy.ticketPercent} %</label><input id="theater-ticket-percent-mass" type="number" min="0" step="0.5" value={saved.ticketPercent} onChange={(event) => update({ ticketPercent: event.target.value })} /></div>
                <div className="field"><label htmlFor="theater-visitor-percent-mass">{copy.visitorPercent} %</label><input id="theater-visitor-percent-mass" type="number" min="0" step="0.5" value={saved.visitorPercent} onChange={(event) => update({ visitorPercent: event.target.value })} /></div>
                <div className="field"><label htmlFor="theater-merchandise-mass">{copy.merchandise}</label><input id="theater-merchandise-mass" type="number" min="0" value={saved.merchandise} onChange={(event) => update({ merchandise: event.target.value })} /></div>
                <div className="field"><label htmlFor="theater-event-mass">{copy.event}</label><select id="theater-event-mass" value={saved.event} onChange={(event) => update({ event: event.target.value as RehearsalEvent })}>{REHEARSAL_EVENTS.map((id) => <option key={id} value={id}>{copy.events[id]}</option>)}</select></div>
              </div>
            </div>
            <div className="theater-mass-group">
              <div className="section-heading compact-heading"><h3>{copy.goddessesHeading}</h3><div className="theater-goddess-actions"><button type="button" className="small-button" onClick={() => update({ owned: GODDESSES.map((goddess) => goddess.name) })}>{copy.goddessesAll}</button><button type="button" className="small-button" onClick={() => update({ owned: [] })}>{copy.goddessesNone}</button></div></div>
              <div className="theater-mass-goddesses">{GODDESSES.map((goddess) => {
                const portrait = goddessPortrait(goddess.name);
                return <button type="button" key={goddess.id} className="theater-goddess" data-rarity={goddess.rarity} aria-pressed={saved.owned.includes(goddess.name)} onClick={() => toggle(goddess.name)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {portrait ? <img src={portrait} alt="" width={34} height={34} loading="lazy" decoding="async" /> : <span className="theater-goddess-blank" aria-hidden="true" />}
                  <span>{goddess.name}</span>
                </button>;
              })}</div>
              <p className="theater-note">{copy.simulation.goddessAuto}</p>
            </div>
          </div>
          <div className="input-row theater-session-inputs">
            <div className="field">
              <label htmlFor="theater-level">{copy.simulation.level}</label>
              <input id="theater-level" type="number" min="1" step="1" value={saved.theaterLevel} onChange={(event) => update({ theaterLevel: event.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="theater-lipsticks">{copy.simulation.lipsticks}</label>
              <input id="theater-lipsticks" type="number" min="0" max="10000" step="1" value={saved.lipsticks} onChange={(event) => update({ lipsticks: event.target.value })} />
            </div>
          </div>
          {simulation && level !== null ? (
            <>
              <p className="theater-session-status">
                {tf(copy.simulation.levelStatus, {
                  building: copy.simulation.buildings[simulation.building.id],
                  tier: simulation.tier,
                  theaters: simulation.building.theaterSlots,
                  goddesses: simulation.building.goddessSlots,
                })}
              </p>
              <div className="input-row theater-session-inputs theater-run-fields">
                <div className="field">
                  <label htmlFor="theater-lipstick-slot">{copy.simulation.lipstickSlot}</label>
                  <select id="theater-lipstick-slot" value={String(Math.min(Number(saved.lipstickSlot) || 0, simulation.building.theaterSlots - 1))} onChange={(event) => update({ lipstickSlot: event.target.value })}>
                    {Array.from({ length: simulation.building.theaterSlots }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}
                  </select>
                </div>
                <div className="theater-energy-fields">
                  {Array.from({ length: simulation.building.theaterSlots }, (_, index) => (
                  <div className="theater-slot-card" key={index}>
                      <h3>{tf(copy.simulation.slotHeading, { slot: index + 1 })}</h3>
                      <div className="field"><label htmlFor={`theater-energy-${index}`}>{tf(copy.simulation.energySlot, { slot: index + 1 })}</label>
                      <input
                        id={`theater-energy-${index}`}
                        type="number"
                        min="0"
                        max="5000"
                        step="1"
                        value={saved.startingEnergy[index] ?? "300"}
                        onChange={(event) => {
                          const startingEnergy = [...saved.startingEnergy];
                          startingEnergy[index] = event.target.value;
                          update({ startingEnergy });
                        }}
                      />
                      </div>
                      <div className="field"><label htmlFor={`theater-start-play-${index}`}>{copy.simulation.startPlay}</label><select id={`theater-start-play-${index}`} value={saved.startingPlays[index] ?? ""} onChange={(event) => { const startingPlays = [...saved.startingPlays]; startingPlays[index] = event.target.value; update({ startingPlays }); }}><option value="">{copy.simulation.choosePlay}</option>{PLAY_RARITIES.map((rarity) => <optgroup key={rarity} label={rarity}>{INCOME_PLAYS.filter((entry) => entry.rarity === rarity && simulation.details?.some((row) => row.entry.id === entry.id)).map((entry) => <option key={entry.id} value={entry.id}>{playName(entry)}</option>)}</optgroup>)}</select></div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="theater-note">{copy.simulation.energyCap} {copy.simulation.lipstickCap}</p>
              <p className="theater-session-odds"><strong>{copy.simulation.chances}:</strong> {PLAY_RARITIES.filter((rarity) => simulation.building.rarityChances[rarity] > 0).map((rarity) => { const chance = simulation.building.rarityChances[rarity]; const menuChance = rarityAppearanceChance(chance); return `${rarity} ${tf(copy.simulation.chancePerOffer, { chance: n(chance), menuChance: n(menuChance, { maximumFractionDigits: 1 }) })} · ${PLAY_ENERGY[rarity]} ${copy.simulation.energyUnit}`; }).join(" · ")}</p>
            </>
          ) : <p className="result-error">{stats ? copy.simulation.levelError : copy.invalid}</p>}
          {simulation?.projection ? (
            <div className="theater-session-result" aria-live="polite">
              <h3>{copy.simulation.resultHeading}</h3>
              <div className="theater-session-metrics">
                <div><span>{copy.simulation.minimum}</span><strong>{n(simulation.projection.minimum)}</strong></div>
                <div><span>{copy.simulation.average}</span><strong>{n(simulation.projection.average)}</strong></div>
                <div><span>{copy.simulation.maximum}</span><strong>{n(simulation.projection.maximum)}</strong></div>
              </div>
              <button type="button" className="theater-log-trigger" onClick={() => logRef.current?.showModal()}>{copy.simulation.openLog}</button>
              <dialog className="theater-log-dialog" ref={logRef} aria-labelledby="theater-log-title">
                <div className="theater-log-header"><div><p className="eyebrow">{copy.simulation.logEyebrow}</p><h2 id="theater-log-title">{copy.simulation.logTitle}</h2></div><button type="button" className="small-button" onClick={() => logRef.current?.close()}>{copy.simulation.closeLog}</button></div>
                <p className="theater-note">{copy.simulation.runAssumptions}</p>
                <div className="theater-log-summary"><div><span>{copy.simulation.minimum}</span><strong>{n(simulation.projection.minimum)}</strong></div><div><span>{copy.simulation.average}</span><strong>{n(simulation.projection.average)}</strong></div><div><span>{copy.simulation.maximum}</span><strong>{n(simulation.projection.maximum)}</strong></div><div><span>{copy.simulation.logSettings}</span><strong>{copy.ticketPercent}: {n(stats?.ticketPercent ?? 0)} % · {copy.visitorPercent}: {n(stats?.visitorPercent ?? 0)} % · {copy.merchandise}: {n(stats?.merchandise ?? 0)} · {copy.events[saved.event]}</strong></div></div>
                <div className="theater-log-slots">{simulation.startingPlays?.map((play, index) => { const projection = simulation.projection!.slots[index]; const startCost = PLAY_ENERGY[play!.entry.rarity]; return <article className="theater-log-slot" key={index}><h3>{tf(copy.simulation.slotHeading, { slot: index + 1 })} · {playName(play!.entry)}</h3><p>{tf(copy.simulation.logEnergy, { energy: n(projection.energy), remaining: n(projection.energy - startCost) })}</p><p>{tf(copy.simulation.logGoddesses, { goddesses: deployedNames(play!.deploy) })} · {tf(copy.simulation.logBonus, { bonus: n(play!.numbers.bonusPercent) })}</p><p>{tf(copy.simulation.logIncome, { ticket: n(play!.income.ticketIncome), merchandise: n(play!.income.merchandiseIncome), total: n(play!.income.total) })} · {tf(copy.simulation.logRedCarpet, { low: n(play!.low), high: n(play!.high) })}</p></article>; })}</div>
                <p className="theater-log-data-note">{copy.simulation.logDataNote}</p>
                <h3>{copy.simulation.logKnownPlays}</h3><div className="table-scroll theater-log-table"><table className="data-table"><thead><tr><th scope="col">{copy.colPlay}</th><th scope="col">{copy.simulation.logGoddessColumn}</th><th scope="col" className="num">{copy.baseTicket}</th><th scope="col" className="num">{copy.simulation.logAdjustedTicket}</th><th scope="col" className="num">{copy.baseVisitors}</th><th scope="col" className="num">{copy.simulation.logAdjustedVisitors}</th><th scope="col" className="num">{copy.bonus}</th><th scope="col" className="num">{copy.ticketIncome}</th><th scope="col" className="num">{copy.merchandiseIncome}</th><th scope="col" className="num">{copy.simulation.logTotal}</th><th scope="col" className="num">{copy.redCarpet}</th></tr></thead><tbody>{simulation.details?.map((row) => <tr key={row.entry.id}><th scope="row">{playName(row.entry)} <span className="rarity" data-rarity={row.entry.rarity}>{row.entry.rarity}</span></th><td>{deployedNames(row.deploy)}</td><td className="num">{n(row.numbers.ticket)}</td><td className="num">{n(row.income.ticketPrice)}</td><td className="num">{n(row.numbers.visitors)}</td><td className="num">{n(row.income.audience)}</td><td className="num">{n(row.numbers.bonusPercent)} %</td><td className="num">{n(row.income.ticketIncome)}</td><td className="num">{n(row.income.merchandiseIncome)}</td><td className="num">{n(row.income.total)}</td><td className="num">{tf(copy.redCarpetRange, { low: n(row.low), high: n(row.high) })}</td></tr>)}</tbody></table></div>
              </dialog>
              {simulation.knownPlays < INCOME_PLAYS.length ? <p className="theater-note theater-session-warning">{tf(copy.simulation.dataWarning, { known: simulation.knownPlays, total: INCOME_PLAYS.length })}</p> : null}
              <details className="theater-session-details"><summary>{copy.assumptionsTitle}</summary><p>{copy.simulation.runAssumptions}</p></details>
            </div>
          ) : stats && level !== null && Number.isSafeInteger(level) && level >= 1 ? <p className="result-note">{copy.simulation.invalidRun}</p> : null}
        </section>
      )}
      </div>
      </PremiumGate>
    </>
  );
}
