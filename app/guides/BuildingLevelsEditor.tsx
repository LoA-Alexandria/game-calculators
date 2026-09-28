"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  PUBLISHED_LEVELS,
  addRow,
  buildingOf,
  countLevelChanges,
  exportLevels,
  findLevelProblems,
  fromLevelsData,
  parseCosts,
  parseLevelsDraft,
  removeRow,
  serializeLevelsData,
  setRow,
  setStages,
  type EditorLevelRow,
  type LevelProblem,
  type LevelsEditorState,
} from "../../lib/content/building-levels-editor";
import { buildingStageUrl, type BuildingLevelsData } from "../../lib/content/building-levels";
import { BUILDINGS_DATA, localizedBuildingName, type BuildingTexts } from "../../lib/content/buildings";
import { BUILDING_LEVELS_DRAFT_STORAGE_KEY } from "../../lib/site";
import { type Dictionary } from "../../lib/i18n";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { SaveToSite } from "./SaveToSite";
import { useGuideData } from "./GuideOverrides";

type EditorText = Dictionary["buildingLevelsEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const draftStore = createPersistentStore<LevelsEditorState | null>({
  key: BUILDING_LEVELS_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseLevelsDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

type Ctx = {
  state: LevelsEditorState;
  commit: (next: LevelsEditorState) => void;
  e: EditorText;
  tf: Tf;
  /** The building being edited; one at a time, because the file holds 4,598 rows. */
  id: string;
  nameOf: (id: string) => string;
};

function problemText(e: EditorText, tf: Tf, problem: LevelProblem, nameOf: (id: string) => string): string {
  const building = nameOf(problem.id);
  if (problem.code === "unknownBuilding") return tf(e.problemUnknownBuilding, { id: problem.id });
  if (problem.code === "noLevel") return tf(e.problemNoLevel, { building });
  if (problem.code === "duplicateLevel") return tf(e.problemDuplicateLevel, { building, level: problem.level });
  if (problem.code === "strayStage") return tf(e.problemStrayStage, { building, path: problem.path });
  return tf(e.problemBadCosts, {
    building,
    level: problem.level,
    kind: problem.kind === "upgrade" ? e.fieldUpgrade : e.fieldUpkeep,
  });
}

function LevelRow({ ctx, row }: { ctx: Ctx; row: EditorLevelRow }) {
  const { state, commit, e, id, tf } = ctx;
  const ids = useId();
  const badUpgrade = parseCosts(row.upgrade) === null;
  const badUpkeep = parseCosts(row.upkeep) === null;

  const box = (
    key: "level" | "civIndex" | "population" | "troopCapacity" | "troopLevel",
    label: string,
  ) => (
    <div className="field">
      <label htmlFor={`${ids}-${key}`}>{label}</label>
      <input
        id={`${ids}-${key}`}
        value={row[key]}
        inputMode={key === "level" ? "numeric" : undefined}
        onChange={(event) => commit(setRow(state, id, row.uid, { [key]: event.target.value }))}
      />
    </div>
  );

  return (
    <li className="panel bl-edit-row">
      <div className="bl-edit-head">
        <span className="bl-edit-level" aria-hidden="true">{row.level || "?"}</span>
        <button
          type="button"
          className="small-button button-danger"
          onClick={() => commit(removeRow(state, id, row.uid))}
        >
          <TrashIcon className="icon icon-sm" />
          {tf(e.removeRow, { level: row.level || "?" })}
        </button>
      </div>
      <div className="bl-edit-fields">
        {box("level", e.fieldLevel)}
        {box("civIndex", e.fieldCivIndex)}
        {box("population", e.fieldPopulation)}
        {box("troopCapacity", e.fieldTroopCapacity)}
        {box("troopLevel", e.fieldTroopLevel)}
      </div>
      <div className="bl-edit-fields">
        <div className="field">
          <label htmlFor={`${ids}-upgrade`}>{e.fieldUpgrade}</label>
          <textarea
            id={`${ids}-upgrade`}
            rows={3}
            spellCheck={false}
            aria-invalid={badUpgrade || undefined}
            placeholder={e.costHint}
            value={row.upgrade}
            onChange={(event) => commit(setRow(state, id, row.uid, { upgrade: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-upkeep`}>{e.fieldUpkeep}</label>
          <textarea
            id={`${ids}-upkeep`}
            rows={3}
            spellCheck={false}
            aria-invalid={badUpkeep || undefined}
            placeholder={e.costHint}
            value={row.upkeep}
            onChange={(event) => commit(setRow(state, id, row.uid, { upkeep: event.target.value }))}
          />
        </div>
      </div>
    </li>
  );
}

function ExportDialog({ ctx, problems, onClose }: { ctx: Ctx; problems: LevelProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const { state, e, tf, nameOf } = ctx;
  const json = useMemo(() => serializeLevelsData(exportLevels(state)), [state]);

  const copy = () => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => { /* clipboard blocked */ });
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "building-levels.json";
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
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(e, tf, problem, nameOf)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/building-levels.json</code>
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
        <textarea readOnly value={json} rows={10} spellCheck={false} aria-label="lib/data/building-levels.json" />
      </div>
    </dialog>
  );
}

/**
 * The level tables behind the Buildings guide.
 *
 * One building at a time: the file holds 4,598 rows across 37 buildings, and
 * nobody edits two at once. Costs are typed one resource per line, because the
 * amounts have commas in them and a comma could not separate them.
 */
export function BuildingLevelsEditor() {
  const { t, tf } = useLocale();
  const e = t.buildingLevelsEditor;

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  // The editor opens on what the site serves, not on the built file.
  const liveData = useGuideData<BuildingLevelsData>("building-levels");
  const buildings = useGuideData<typeof BUILDINGS_DATA>("buildings").buildings;
  const published = useMemo(() => fromLevelsData(liveData), [liveData]);
  const state = draft ?? published;
  const commit = (next: LevelsEditorState) => draftStore.set(next);

  const [id, setId] = useState(() => PUBLISHED_LEVELS.buildings[0]?.id ?? "");
  const [exportOpen, setExportOpen] = useState(false);
  const savePayload = useMemo(() => exportLevels(state), [state]);
  const changes = useMemo(() => countLevelChanges(published, state), [published, state]);
  const problems = useMemo(() => findLevelProblems(state), [state]);

  const texts = t.guideEntries.buildings.buildingTexts as BuildingTexts;
  const nameOf = (wanted: string) => {
    const building = buildings.find((entry) => entry.id === wanted);
    return building ? localizedBuildingName(building, texts) : wanted;
  };
  const ctx: Ctx = { state, commit, e, tf, id, nameOf };
  const building = buildingOf(state, id);
  const ownProblems = problems.filter((problem) => problem.id === id);

  const add = () => commit(addRow(state, id).state);

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
  };

  return (
    <div className="building-levels-editor">
      <BackLink href="/guides/buildings/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0
              ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}`
              : e.unchanged}
          </span>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <SaveToSite file="building-levels" data={savePayload} />
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

      <div className="field bl-edit-pick">
        <label htmlFor="bl-edit-building">{e.pickBuilding}</label>
        <select id="bl-edit-building" value={id} onChange={(event) => setId(event.target.value)}>
          {state.buildings.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {nameOf(entry.id)} · {tf(e.rowCount, { count: entry.rows.length })}
            </option>
          ))}
        </select>
      </div>

      {building ? (
        <>
          <div className="field">
            <label htmlFor="bl-edit-stages">{e.fieldStages}</label>
            <textarea
              id="bl-edit-stages"
              rows={4}
              spellCheck={false}
              value={building.stages.join("\n")}
              onChange={(event) => commit(setStages(state, id, event.target.value))}
            />
            <p className="tier-small">{e.stagesHint}</p>
          </div>
          <div className="bl-edit-stage-art">
            {building.stages.map((path) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={path} src={buildingStageUrl(path)} alt="" width={64} height={64} loading="lazy" decoding="async" />
            ))}
          </div>

          {ownProblems.length > 0 ? (
            <div className="notice notice-warn" role="alert">
              <div>
                <strong>{e.problemsTitle}</strong>
                <ul>{ownProblems.map((problem, index) => <li key={index}>{problemText(e, tf, problem, nameOf)}</li>)}</ul>
              </div>
            </div>
          ) : null}

          <div className="form-actions">
            <button className="button" type="button" onClick={add}>
              <PlusIcon className="icon icon-sm" />
              {e.addRow}
            </button>
          </div>

          <ol className="bl-edit-list">
            {building.rows.map((row) => <LevelRow key={row.uid} ctx={ctx} row={row} />)}
          </ol>
        </>
      ) : null}

      {exportOpen ? <ExportDialog ctx={ctx} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}
