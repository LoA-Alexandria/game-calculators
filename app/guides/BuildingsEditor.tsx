"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  BUILDING_CATEGORIES,
  PRODUCTION_GROUPS,
  PRODUCTION_RESOURCES,
  PRODUCTION_TAGS,
  type BuildingCategory,
  type ProductionGroupId,
  type ProductionResource,
  type ProductionTag,
} from "../../lib/content/buildings";
import {
  PUBLISHED_BUILDINGS,
  addBuilding,
  buildingByUid,
  buildingTextBlocks,
  countBuildingChanges,
  exportBuildings,
  findBuildingProblems,
  moveBuilding,
  parseBuildingsDraft,
  removeBuilding,
  serializeBuildingsData,
  setBuildingFields,
  setBuildingName,
  setBuildingNote,
  type BuildingProblem,
  type BuildingsEditorState,
} from "../../lib/content/buildings-editor";
import { DEFAULT_LOCALE, fill, toLocale, type Dictionary, type Locale } from "../../lib/i18n";
import { BUILDINGS_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";

type EditorText = Dictionary["buildingsEditor"];
type Guide = Dictionary["guideEntries"]["buildings"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const draftStore = createPersistentStore<BuildingsEditorState | null>({
  key: BUILDINGS_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseBuildingsDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function download(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
}

function problemText(e: EditorText, tf: Tf, problem: BuildingProblem): string {
  switch (problem.code) {
    case "noBuildings":
      return e.problemNoBuildings;
    case "emptyName":
      return tf(e.problemEmptyName, problem.values ?? {});
    case "duplicateId":
      return tf(e.problemDuplicateId, problem.values ?? {});
    case "badCategory":
      return tf(e.problemBadCategory, problem.values ?? {});
    case "badLevelMax":
      return tf(e.problemBadLevelMax, problem.values ?? {});
    case "badGroup":
      return tf(e.problemBadGroup, problem.values ?? {});
    case "badProduces":
      return tf(e.problemBadProduces, problem.values ?? {});
    case "emptyRequires":
      return tf(e.problemEmptyRequires, problem.values ?? {});
    case "badRequires":
      return tf(e.problemBadRequires, problem.values ?? {});
    case "badTag":
      return tf(e.problemBadTag, problem.values ?? {});
    default:
      return problem.code;
  }
}

type Ctx = {
  state: BuildingsEditorState;
  commit: (next: BuildingsEditorState) => void;
  e: EditorText;
  guide: Guide;
  tf: Tf;
  languages: Locale[];
};

function BuildingEditor({ ctx, uid }: { ctx: Ctx; uid: string }) {
  const { locale } = useLocale();
  const id = useId();
  const building = buildingByUid(ctx.state, uid);
  if (!building) return null;
  const { state, commit, e, guide, languages } = ctx;
  const name =
    building.name[toLocale(locale)].trim() || building.name[DEFAULT_LOCALE].trim() || e.unnamedBuilding;
  const isProduction = building.category === "production";

  const toggleRequire = (resource: ProductionResource) => {
    const has = building.requires.includes(resource);
    const requires = has
      ? building.requires.filter((entry) => entry !== resource)
      : [...building.requires, resource];
    commit(setBuildingFields(state, uid, { requires }));
  };

  const toggleTag = (tag: ProductionTag) => {
    const has = building.tags.includes(tag);
    const tags = has ? building.tags.filter((entry) => entry !== tag) : [...building.tags, tag];
    commit(setBuildingFields(state, uid, { tags }));
  };

  return (
    <section className="production-edit-building" aria-label={name}>
      <div className="tier-edit-form-head">
        <h2>{name}</h2>
        <div className="tier-edit-row-actions">
          <button className="small-button" type="button" onClick={() => commit(moveBuilding(state, uid, -1))}>
            {e.moveUp}
          </button>
          <button className="small-button" type="button" onClick={() => commit(moveBuilding(state, uid, 1))}>
            {e.moveDown}
          </button>
          <button
            className="small-button button-danger"
            type="button"
            onClick={() => {
              if (window.confirm(fill(e.removeBuildingConfirm, { building: name }))) {
                commit(removeBuilding(state, uid));
              }
            }}
          >
            <TrashIcon className="icon icon-sm" />
            {e.removeBuilding}
          </button>
        </div>
      </div>

      <TranslatedField
        label={e.fieldName}
        languages={languages}
        get={(code) => building.name[code]}
        set={(code, value) => commit(setBuildingName(state, uid, code, value))}
      />
      <TranslatedField
        label={e.fieldNote}
        hint={e.fieldNoteHint}
        languages={languages}
        get={(code) => building.note[code]}
        set={(code, value) => commit(setBuildingNote(state, uid, code, value))}
      />

      <div className="production-edit-fields">
        <div className="field">
          <label htmlFor={`${id}-category`}>{e.fieldCategory}</label>
          <select
            id={`${id}-category`}
            value={building.category}
            onChange={(event) =>
              commit(setBuildingFields(state, uid, { category: event.target.value as BuildingCategory }))
            }
          >
            {BUILDING_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {guide.categories[category]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-level`}>{e.fieldLevelMax}</label>
          <input
            id={`${id}-level`}
            type="number"
            min={1}
            value={building.levelMax}
            onChange={(event) => commit(setBuildingFields(state, uid, { levelMax: Number(event.target.value) }))}
          />
        </div>
        {isProduction ? (
          <>
            <div className="field">
              <label htmlFor={`${id}-group`}>{e.fieldGroup}</label>
              <select
                id={`${id}-group`}
                value={building.group}
                onChange={(event) =>
                  commit(setBuildingFields(state, uid, { group: event.target.value as ProductionGroupId }))
                }
              >
                {PRODUCTION_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {guide.groups[group]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${id}-produces`}>{e.fieldProduces}</label>
              <select
                id={`${id}-produces`}
                value={building.produces}
                onChange={(event) =>
                  commit(setBuildingFields(state, uid, { produces: event.target.value as ProductionResource }))
                }
              >
                {PRODUCTION_RESOURCES.map((resource) => (
                  <option key={resource} value={resource}>
                    {guide.resources[resource]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${id}-priority`}>{e.fieldPriority}</label>
              <select
                id={`${id}-priority`}
                value={building.priority}
                onChange={(event) => commit(setBuildingFields(state, uid, { priority: Number(event.target.value) }))}
              >
                <option value={0}>{e.priorityNone}</option>
                <option value={1}>*</option>
                <option value={2}>**</option>
                <option value={3}>***</option>
              </select>
            </div>
          </>
        ) : null}
      </div>

      {isProduction ? (
        <>
          <fieldset className="production-edit-checkboxes">
            <legend>{e.fieldRequires}</legend>
            {PRODUCTION_RESOURCES.map((resource) => (
              <label key={resource} className="tier-edit-check">
                <input
                  type="checkbox"
                  checked={building.requires.includes(resource)}
                  onChange={() => toggleRequire(resource)}
                />
                {guide.resources[resource]}
              </label>
            ))}
          </fieldset>
          <fieldset className="production-edit-checkboxes">
            <legend>{e.fieldTags}</legend>
            {PRODUCTION_TAGS.map((tag) => (
              <label key={tag} className="tier-edit-check">
                <input type="checkbox" checked={building.tags.includes(tag)} onChange={() => toggleTag(tag)} />
                {guide.tags[tag]}
              </label>
            ))}
          </fieldset>
        </>
      ) : null}
    </section>
  );
}

function ExportDialog({
  open,
  onClose,
  state,
  e,
  tf,
}: {
  open: boolean;
  onClose: () => void;
  state: BuildingsEditorState;
  e: EditorText;
  tf: Tf;
}) {
  const [copied, setCopied] = useState<"json" | null>(null);
  const exported = useMemo(() => exportBuildings(state), [state]);
  const json = useMemo(() => serializeBuildingsData(exported), [exported]);
  const blocks = useMemo(() => buildingTextBlocks(state), [state]);
  const problems = useMemo(() => findBuildingProblems(state), [state]);
  if (!open) return null;

  return (
    <dialog
      className="tier-export"
      ref={(node) => {
        if (node && !node.open) node.showModal();
      }}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="tier-export-head">
        <h2>{e.exportTitle}</h2>
        <button className="icon-button" type="button" aria-label={e.close} onClick={onClose}>
          <CloseIcon className="icon" />
        </button>
      </div>
      <p>{e.exportLede}</p>
      {problems.length > 0 ? (
        <div className="callout">
          <strong>{e.problemsTitle}</strong>
          <ul>
            {problems.map((problem, index) => (
              <li key={`${problem.code}-${index}`}>{problemText(e, tf, problem)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="tier-export-block">
        <div className="tier-export-block-head">
          <h3>
            <code>lib/data/buildings.json</code>
          </h3>
          <div className="tier-edit-row-actions">
            <button
              className="small-button"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(json);
                setCopied("json");
              }}
            >
              {copied === "json" ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied === "json" ? e.copied : e.copy}
            </button>
            <button
              className="small-button"
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                download(url, "buildings.json");
                window.setTimeout(() => URL.revokeObjectURL(url), 0);
              }}
            >
              <DownloadIcon className="icon icon-sm" />
              {e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/buildings.json" />
      </div>
      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={8} />
    </dialog>
  );
}

export function BuildingsEditor() {
  const { t, tf, locale } = useLocale();
  const e = t.buildingsEditor;
  const guide = t.guideEntries.buildings;
  const { languages } = useEditorLanguages({ withDefault: true });
  const uiLocale = toLocale(locale);
  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED_BUILDINGS;
  const commit = (next: BuildingsEditorState) => draftStore.set(next);
  const [selected, setSelected] = useState<string | null>(state.buildings[0]?.uid ?? null);
  const [exportOpen, setExportOpen] = useState(false);
  const changes = useMemo(() => countBuildingChanges(PUBLISHED_BUILDINGS, state), [state]);
  const problems = useMemo(() => findBuildingProblems(state), [state]);
  const active = selected && buildingByUid(state, selected) ? selected : (state.buildings[0]?.uid ?? null);
  const ctx: Ctx = { state, commit, e, guide, tf, languages };

  return (
    <div className="hero-tiers tier-editor production-editor">
      <BackLink href="/guides/buildings/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <AllLanguagesToggle />
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0
              ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}`
              : e.unchanged}
          </span>
          <button
            className="button"
            type="button"
            onClick={() => {
              const result = addBuilding(state);
              commit(result.state);
              setSelected(result.uid);
            }}
          >
            <PlusIcon className="icon icon-sm" />
            {e.addBuilding}
          </button>
          <button
            className="button"
            type="button"
            disabled={!draft}
            onClick={() => {
              if (window.confirm(e.resetConfirm)) {
                draftStore.clear();
                setSelected(null);
              }
            }}
          >
            {e.reset}
          </button>
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

      <div className="production-edit-layout">
        <ul className="production-edit-list" aria-label={e.buildingsList}>
          {state.buildings.map((building) => {
            const label =
              building.name[uiLocale].trim() || building.name[DEFAULT_LOCALE].trim() || e.unnamedBuilding;
            return (
              <li key={building.uid}>
                <button
                  type="button"
                  className={building.uid === active ? "is-active" : undefined}
                  onClick={() => setSelected(building.uid)}
                >
                  <span>{label}</span>
                  <span className="tier-small">{guide.categories[building.category]}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="production-edit-main">
          {active ? <BuildingEditor ctx={ctx} uid={active} /> : <p className="callout">{e.selectHint}</p>}
        </div>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} state={state} e={e} tf={tf} />
    </div>
  );
}
