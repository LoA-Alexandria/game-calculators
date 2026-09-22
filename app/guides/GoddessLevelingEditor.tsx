"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { phaseTone } from "../../lib/content/goddess-leveling";
import {
  PUBLISHED_GODDESS_LEVELING,
  addPhase,
  addRow,
  countLevelingChanges,
  exportLeveling,
  findLevelingProblems,
  hasEveryoneElse,
  moveRow,
  movePhase,
  parseLevelingDraft,
  phaseTextBlocks,
  phaseTextOf,
  removePhase,
  removeRow,
  serializeLevelingData,
  setPhaseText,
  unusedGoddesses,
  updateRow,
  type EditorLevelingRow,
  type EditorPhase,
  type GoddessLevelingEditorState,
  type LevelingProblem,
} from "../../lib/content/goddess-leveling-editor";
import { GODDESSES, goddessById, goddessImageUrl } from "../../lib/content/goddesses";
import { LOCALE_CODES, type Dictionary, type Locale } from "../../lib/i18n";
import { GODDESS_LEVELING_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, ChevronIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";

type EditorText = Dictionary["goddessLevelingEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const PUBLISHED = PUBLISHED_GODDESS_LEVELING;
const PUBLISHED_BLOCKS = phaseTextBlocks(PUBLISHED_GODDESS_LEVELING);
const EVERYONE = "*";

const draftStore = createPersistentStore<GoddessLevelingEditorState | null>({
  key: GODDESS_LEVELING_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseLevelingDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

type Ctx = {
  state: GoddessLevelingEditorState;
  commit: (next: GoddessLevelingEditorState) => void;
  e: EditorText;
  tf: Tf;
  languages: Locale[];
};

const goddessName = (e: EditorText, id: string | null) => (id === null ? e.everyoneElse : goddessById(id)?.name ?? id);

export function GoddessLevelingEditor() {
  const { t, tf } = useLocale();
  const e = t.goddessLevelingEditor;
  const { languages } = useEditorLanguages({ withDefault: true });

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED;
  const commit = (next: GoddessLevelingEditorState) => draftStore.set(next);
  const [exportOpen, setExportOpen] = useState(false);

  const changes = useMemo(() => countLevelingChanges(PUBLISHED, state), [state]);
  const problems = useMemo(() => findLevelingProblems(state), [state]);
  const ctx: Ctx = { state, commit, e, tf, languages };

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
  };

  const add = () => {
    const result = addPhase(state);
    commit(result.state);
    window.requestAnimationFrame(() => document.getElementById(`phase-${result.uid}`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  return (
    <div className="goddess-leveling-editor">
      <BackLink href="/guides/goddess-leveling/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <AllLanguagesToggle />
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0 ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={add}>
            <PlusIcon className="icon icon-sm" />
            {e.addPhase}
          </button>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>
            {e.export}
            {problems.length > 0 ? <span className="tier-edit-count" aria-label={tf(e.problemCount, { count: problems.length })}>{problems.length}</span> : null}
          </button>
        </div>
      </div>

      <ol className="gl-edit-phases">
        {state.phases.map((phase, index) => (
          <PhaseForm key={phase.uid} ctx={ctx} phase={phase} index={index} count={state.phases.length} />
        ))}
      </ol>

      {exportOpen ? <ExportDialog ctx={ctx} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}

function PhaseForm({ ctx, phase, index, count }: { ctx: Ctx; phase: EditorPhase; index: number; count: number }) {
  const { state, commit, e, tf } = ctx;
  const id = useId();
  const number = index + 1;
  const unused = unusedGoddesses(phase);

  const remove = () => {
    if (phase.rows.length > 0 && !window.confirm(tf(e.removePhaseConfirm, { number }))) return;
    commit(removePhase(state, phase.uid));
  };

  return (
    <li className="gl-edit-phase" id={`phase-${phase.uid}`} data-tone={phaseTone(index)} aria-labelledby={`${id}-title`}>
      <div className="gl-edit-phase-head">
        <span className="gl-phase-number" aria-hidden="true">{number}</span>
        <h2 id={`${id}-title`}>{tf(e.phaseLabel, { number })}</h2>
        <div className="tier-edit-row-actions">
          <button type="button" className="icon-button hero-edit-up" aria-label={tf(e.movePhaseUp, { number })} disabled={index === 0} onClick={() => commit(movePhase(state, phase.uid, -1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="icon-button hero-edit-down" aria-label={tf(e.movePhaseDown, { number })} disabled={index === count - 1} onClick={() => commit(movePhase(state, phase.uid, 1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="small-button button-danger" onClick={remove}>
            <TrashIcon className="icon icon-sm" />
            {e.removePhase}
          </button>
        </div>
      </div>

      <div className="gl-edit-texts">
        <TranslatedField
          label={e.fieldSubtitle}
          fallback={phase.subtitle}
          languages={ctx.languages}
          get={(language) => phaseTextOf(state, language, phase.uid).subtitle}
          set={(language, value) => commit(setPhaseText(state, phase.uid, language, "subtitle", value))}
        />
        <TranslatedField
          label={e.fieldLede}
          note={e.fieldLedeNote}
          multiline
          rows={2}
          fallback={phase.lede}
          languages={ctx.languages}
          get={(language) => phaseTextOf(state, language, phase.uid).lede}
          set={(language, value) => commit(setPhaseText(state, phase.uid, language, "lede", value))}
        />
      </div>

      <h3 className="gl-edit-rows-title">{e.rowsHeading}</h3>
      {phase.rows.length === 0 ? <p className="tier-small">{e.emptyRows}</p> : (
        <div className="gl-edit-rows" role="table" aria-label={e.rowsHeading}>
          <div className="gl-edit-row is-head" role="row">
            <span role="columnheader">{e.colGoddess}</span>
            <span role="columnheader">{e.colTarget}</span>
            <span role="columnheader">
              {e.colWithoutSsr} <span className="label-note">{e.colWithoutSsrNote}</span>
            </span>
            <span role="columnheader" className="visually-hidden">…</span>
          </div>
          {phase.rows.map((row, rowIndex) => (
            <RowForm key={row.uid} ctx={ctx} phase={phase} row={row} index={rowIndex} />
          ))}
        </div>
      )}

      <div className="gl-edit-add">
        <label className="visually-hidden" htmlFor={`${id}-add`}>{e.addRow}</label>
        <select
          id={`${id}-add`}
          value=""
          disabled={unused.length === 0}
          onChange={(event) => {
            if (event.target.value) commit(addRow(state, phase.uid, event.target.value));
          }}
        >
          <option value="">{e.pickGoddess}</option>
          {unused.map((goddess) => (
            <option key={goddess.id} value={goddess.id}>{goddess.name} · {goddess.rarity}</option>
          ))}
        </select>
        {hasEveryoneElse(phase) ? null : (
          <button type="button" className="small-button" onClick={() => commit(addRow(state, phase.uid, null))}>
            <PlusIcon className="icon icon-sm" />
            {e.addEveryoneElse}
          </button>
        )}
      </div>
    </li>
  );
}

function RowForm({ ctx, phase, row, index }: { ctx: Ctx; phase: EditorPhase; row: EditorLevelingRow; index: number }) {
  const { state, commit, e, tf } = ctx;
  const id = useId();
  const goddess = row.goddess ? goddessById(row.goddess) : undefined;
  const name = goddessName(e, row.goddess);
  const taken = new Set(phase.rows.filter((entry) => entry.uid !== row.uid).map((entry) => entry.goddess));

  return (
    <div className="gl-edit-row" role="row">
      <span className="gl-edit-goddess" role="cell">
        <HeroPortrait name={name} rarity={goddess?.rarity} src={goddess?.images[0] ? goddessImageUrl(goddess.images[0]) : null} className="hero-portrait-small" />
        <label className="visually-hidden" htmlFor={`${id}-goddess`}>{e.colGoddess}</label>
        <select
          id={`${id}-goddess`}
          value={row.goddess ?? EVERYONE}
          onChange={(event) => commit(updateRow(state, phase.uid, row.uid, { goddess: event.target.value === EVERYONE ? null : event.target.value }))}
        >
          {GODDESSES.map((entry) => (
            <option key={entry.id} value={entry.id} disabled={taken.has(entry.id)}>{entry.name} · {entry.rarity}</option>
          ))}
          <option value={EVERYONE} disabled={taken.has(null)}>{e.everyoneElse}</option>
        </select>
      </span>
      <span role="cell">
        <label className="visually-hidden" htmlFor={`${id}-target`}>{e.colTarget}</label>
        <input id={`${id}-target`} className="gl-edit-level" value={row.target} onChange={(event) => commit(updateRow(state, phase.uid, row.uid, { target: event.target.value }))} />
      </span>
      <span role="cell">
        <label className="visually-hidden" htmlFor={`${id}-without`}>{e.colWithoutSsr}</label>
        <input id={`${id}-without`} className="gl-edit-level" value={row.withoutSsr} placeholder="—" onChange={(event) => commit(updateRow(state, phase.uid, row.uid, { withoutSsr: event.target.value }))} />
      </span>
      <span className="tier-edit-row-actions" role="cell">
        <button type="button" className="icon-button hero-edit-up" aria-label={tf(e.moveRowUp, { goddess: name })} disabled={index === 0} onClick={() => commit(moveRow(state, phase.uid, row.uid, -1))}>
          <ChevronIcon className="icon icon-sm" />
        </button>
        <button type="button" className="icon-button hero-edit-down" aria-label={tf(e.moveRowDown, { goddess: name })} disabled={index === phase.rows.length - 1} onClick={() => commit(moveRow(state, phase.uid, row.uid, 1))}>
          <ChevronIcon className="icon icon-sm" />
        </button>
        <button type="button" className="icon-button" aria-label={tf(e.removeRow, { goddess: name })} onClick={() => commit(removeRow(state, phase.uid, row.uid))}>
          <TrashIcon className="icon icon-sm" />
        </button>
      </span>
    </div>
  );
}

function problemText(e: EditorText, tf: Tf, problem: LevelingProblem): string {
  switch (problem.code) {
    case "emptySubtitle": return tf(e.problemEmptySubtitle, { phase: problem.phase });
    case "emptyPhase": return tf(e.problemEmptyPhase, { phase: problem.phase });
    case "emptyTarget": return tf(e.problemEmptyTarget, { phase: problem.phase, goddess: goddessName(e, problem.goddess) });
    case "unknownGoddess": return tf(e.problemUnknownGoddess, { phase: problem.phase, goddess: problem.goddess });
    case "duplicateRow": return tf(e.problemDuplicateRow, { phase: problem.phase, goddess: goddessName(e, problem.goddess) });
  }
}

function ExportDialog({ ctx, problems, onClose }: { ctx: Ctx; problems: LevelingProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const { e, tf, state } = ctx;
  const json = useMemo(() => serializeLevelingData(exportLeveling(state)), [state]);
  // Only the dictionaries whose phaseTexts changed need a new block.
  const blocks = useMemo(() => {
    const all = phaseTextBlocks(state);
    return Object.fromEntries(LOCALE_CODES.filter((code) => all[code] !== PUBLISHED_BLOCKS[code]).map((code) => [code, all[code]]));
  }, [state]);

  const copy = () => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => { /* clipboard blocked */ });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "goddess-leveling.json";
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
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(e, tf, problem)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/goddess-leveling.json</code>
          <div className="tier-edit-row-actions">
            <button className="small-button" type="button" onClick={() => void copy()}>
              {copied ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied ? e.copied : e.copy}
            </button>
            <button className="small-button" type="button" onClick={downloadJson}>
              <DownloadIcon className="icon icon-sm" />
              {e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/goddess-leveling.json" />
      </div>

      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={6} />
    </dialog>
  );
}
