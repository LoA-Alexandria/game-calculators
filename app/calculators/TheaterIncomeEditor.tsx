"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  APTITUDE_IDS,
  countIncomeChanges,
  exportIncome,
  findIncomeProblems,
  fromIncomeData,
  missingNumbers,
  parseIncomeDraft,
  serializeIncomeData,
  setPlay,
  toggleGoddessAptitude,
  togglePlayAptitude,
  type EditorGoddess,
  type EditorPlay,
  type IncomeEditorState,
  type IncomeProblem,
} from "../../lib/calculators/theater-income-editor";
import { type RawIncomeData } from "../../lib/calculators/theater-income";
import { localizedPlayName, type TheaterData } from "../../lib/content/goddess-theater";
import { goddessNamed, goddessPortrait } from "../../lib/content/goddesses";
import { THEATER_INCOME_DRAFT_STORAGE_KEY } from "../../lib/site";
import { type Dictionary } from "../../lib/i18n";
import { SaveToSite } from "../guides/SaveToSite";
import { useGuideData } from "../guides/GuideOverrides";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";

type EditorText = Dictionary["theaterIncomeEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const draftStore = createPersistentStore<IncomeEditorState | null>({
  key: THEATER_INCOME_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseIncomeDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

type Ctx = {
  state: IncomeEditorState;
  commit: (next: IncomeEditorState) => void;
  e: EditorText;
  tf: Tf;
  /** Aptitude names as the game shows them, from the calculator's own words. */
  aptitudeNames: Record<string, string>;
  playName: (id: string) => string;
};

function problemText(e: EditorText, tf: Tf, problem: IncomeProblem, ctx: Ctx): string {
  if (problem.code === "unknownPlay") return tf(e.problemUnknownPlay, { id: problem.id });
  if (problem.code === "halfRow") return tf(e.problemHalfRow, { play: ctx.playName(problem.id) });
  if (problem.code === "tooManyAptitudes") {
    return tf(e.problemTooManyAptitudes, { name: problem.name, count: problem.count });
  }
  return tf(e.problemContradiction, { name: problem.name, aptitude: ctx.aptitudeNames[problem.aptitude] ?? problem.aptitude });
}

/** The twelve aptitudes as chips, ticked or not. */
function AptitudeChips({
  ctx,
  chosen,
  label,
  onToggle,
}: {
  ctx: Ctx;
  chosen: readonly string[];
  label: string;
  onToggle: (aptitude: (typeof APTITUDE_IDS)[number]) => void;
}) {
  return (
    <div className="ti-edit-chips" role="group" aria-label={label}>
      {APTITUDE_IDS.map((aptitude) => (
        <button
          key={aptitude}
          type="button"
          className="ti-edit-chip"
          aria-pressed={chosen.includes(aptitude)}
          onClick={() => onToggle(aptitude)}
        >
          {ctx.aptitudeNames[aptitude] ?? aptitude}
        </button>
      ))}
    </div>
  );
}

function PlayRow({ ctx, play }: { ctx: Ctx; play: EditorPlay }) {
  const { state, commit, e } = ctx;
  const ids = useId();
  const missing = !play.ticket.trim() || !play.visitors.trim();

  return (
    <li className="panel ti-edit-row" data-missing={missing ? "" : undefined}>
      <div className="ti-edit-head">
        <span className="rarity" data-rarity={play.rarity}>{play.rarity}</span>
        <strong>{ctx.playName(play.id)}</strong>
        {missing ? <span className="ti-edit-missing">{e.missingHere}</span> : null}
      </div>
      <div className="ti-edit-numbers">
        <div className="field">
          <label htmlFor={`${ids}-ticket`}>{e.fieldTicket}</label>
          <input
            id={`${ids}-ticket`}
            inputMode="numeric"
            value={play.ticket}
            placeholder={e.notKnownYet}
            onChange={(event) => commit(setPlay(state, play.uid, { ticket: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-visitors`}>{e.fieldVisitors}</label>
          <input
            id={`${ids}-visitors`}
            inputMode="numeric"
            value={play.visitors}
            placeholder={e.notKnownYet}
            onChange={(event) => commit(setPlay(state, play.uid, { visitors: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-slots`}>{e.fieldSlots}</label>
          <input
            id={`${ids}-slots`}
            inputMode="numeric"
            value={play.slots}
            placeholder={state.slots}
            onChange={(event) => commit(setPlay(state, play.uid, { slots: event.target.value }))}
          />
        </div>
      </div>
      <AptitudeChips
        ctx={ctx}
        chosen={play.aptitudes}
        label={e.fieldAptitudes}
        onToggle={(aptitude) => commit(togglePlayAptitude(state, play.uid, aptitude))}
      />
    </li>
  );
}

function GoddessRow({ ctx, goddess }: { ctx: Ctx; goddess: EditorGoddess }) {
  const { state, commit, e } = ctx;
  const known = goddessNamed(goddess.name);

  return (
    <li className="panel ti-edit-row">
      <div className="ti-edit-head">
        <HeroPortrait name={goddess.name} src={goddessPortrait(goddess.name)} className="hero-portrait-small" />
        <strong>{goddess.name}</strong>
        {known ? null : <span className="ti-edit-missing">{e.notOnRoster}</span>}
      </div>
      <p className="tier-small">{e.hasLabel}</p>
      <AptitudeChips
        ctx={ctx}
        chosen={goddess.aptitudes}
        label={e.hasLabel}
        onToggle={(aptitude) => commit(toggleGoddessAptitude(state, goddess.uid, aptitude, "aptitudes"))}
      />
      <p className="tier-small">{e.lacksLabel}</p>
      <AptitudeChips
        ctx={ctx}
        chosen={goddess.lacks}
        label={e.lacksLabel}
        onToggle={(aptitude) => commit(toggleGoddessAptitude(state, goddess.uid, aptitude, "lacks"))}
      />
    </li>
  );
}

function ExportDialog({ ctx, problems, onClose }: { ctx: Ctx; problems: IncomeProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const { state, e, tf } = ctx;
  const json = useMemo(() => serializeIncomeData(exportIncome(state)), [state]);

  const copy = () => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => { /* clipboard blocked */ });
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "theater-income.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <dialog
      ref={(node) => {
        dialog.current = node;
        if (node && !node.open) node.showModal();
      }}
      className="tier-export"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="tier-edit-form-head">
        <h2 id={`${id}-title`}>{e.exportTitle}</h2>
        <button type="button" className="icon-button" aria-label={e.close} onClick={() => dialog.current?.close()}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>
      <p className="tier-small">{e.exportLede}</p>
      {problems.length > 0 ? (
        <div className="notice notice-warn tier-export-problems" role="alert">
          <div>
            <strong>{e.problemsTitle}</strong>
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(e, tf, problem, ctx)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/theater-income.json</code>
          <div className="tier-edit-row-actions">
            <button className="small-button" type="button" onClick={() => void copy()}>
              {copied ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied ? e.copied : e.copy}
            </button>
            <button className="small-button" type="button" onClick={download}>
              <DownloadIcon className="icon icon-sm" />
              {e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/theater-income.json" />
      </div>
    </dialog>
  );
}

/**
 * The measurements behind the theater income calculator.
 *
 * Every number here is read off the game's own preview while playing, so the
 * page is built for typing: the plays whose numbers nobody has taken yet come
 * first and say so, and the rest follow in the file's order.
 */
export function TheaterIncomeEditor() {
  const { t, tf } = useLocale();
  const e = t.theaterIncomeEditor;

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  // The editor opens on what the site serves, not on the built file.
  const liveData = useGuideData<RawIncomeData>("theater-income");
  const theater = useGuideData<TheaterData>("goddess-theater");
  const published = useMemo(() => fromIncomeData(liveData), [liveData]);
  const state = draft ?? published;
  const commit = (next: IncomeEditorState) => draftStore.set(next);

  const [exportOpen, setExportOpen] = useState(false);
  const savePayload = useMemo(() => exportIncome(state), [state]);
  const changes = useMemo(() => countIncomeChanges(published, state), [published, state]);
  const problems = useMemo(() => findIncomeProblems(state), [state]);
  const missing = useMemo(() => missingNumbers(state), [state]);

  const aptitudeNames = t.theaterIncome.aptitudes as Record<string, string>;
  const playName = (id: string) => {
    const play = theater.plays.find((entry) => entry.id === id);
    return play ? localizedPlayName(play, t.guideEntries.goddessTheater.playTexts) : id;
  };
  const ctx: Ctx = { state, commit, e, tf, aptitudeNames, playName };

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
  };

  // The rows still waiting for their numbers come first; the rest keep the
  // file's order, so a second pass finds a play where it was left.
  const ordered = useMemo(() => {
    const waiting = new Set(missing.map((play) => play.uid));
    return [...state.plays].sort((left, right) => Number(waiting.has(right.uid)) - Number(waiting.has(left.uid)));
  }, [state.plays, missing]);

  return (
    <div className="theater-income-editor">
      <BackLink href="/calculators/theater-income/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0
              ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}`
              : e.unchanged}
          </span>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <SaveToSite file="theater-income" data={savePayload} />
          <button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>
            {e.export}
            {problems.length > 0 ? (
              <span className="tier-edit-count" aria-label={tf(e.problemCount, { count: problems.length })}>
                {problems.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <p className="tier-small">
        {missing.length > 0
          ? tf(e.missingCount, { count: missing.length, total: state.plays.length })
          : e.nothingMissing}
      </p>

      <h2>{e.playsHeading}</h2>
      <ol className="ti-edit-list">
        {ordered.map((play) => <PlayRow key={play.uid} ctx={ctx} play={play} />)}
      </ol>

      <h2>{e.goddessesHeading}</h2>
      <p className="guide-lede">{e.goddessesLede}</p>
      <ol className="ti-edit-list">
        {state.goddesses.map((goddess) => <GoddessRow key={goddess.uid} ctx={ctx} goddess={goddess} />)}
      </ol>

      {exportOpen ? <ExportDialog ctx={ctx} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}
