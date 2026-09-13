"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { PAINTING_RARITIES, paintingSetById } from "../../lib/content/artwork";
import { ARTWORK_LAYOUT_DATA } from "../../lib/content/artwork-layouts";
import {
  LANGUAGES,
  addBuild,
  addRow,
  addText,
  countChanges,
  dictionarySnippet,
  findBuild,
  findProblems,
  fromLayoutData,
  moveRow,
  parseDraft,
  removeBuild,
  removeRow,
  serializeLayoutData,
  setBuildNote,
  textKeyFrom,
  toLayoutData,
  unusedSets,
  updateRow,
  type EditorState,
  type Language,
  type Problem,
  type TextGroup,
  type Translations,
} from "../../lib/content/artwork-layout-editor";
import type { Dictionary } from "../../lib/i18n";
import { ARTWORK_LAYOUT_DRAFT_STORAGE_KEY } from "../../lib/site";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, TrashIcon } from "../components/Icons";

type Guide = Dictionary["guideEntries"]["artworkLayouts"];
type EditorText = Dictionary["artworkLayoutEditor"];

const PUBLISHED = fromLayoutData(ARTWORK_LAYOUT_DATA);
const PUBLISHED_DATA = toLayoutData(PUBLISHED);

const draftStore = createPersistentStore<EditorState | null>({
  key: ARTWORK_LAYOUT_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

const NEW_TEXT = "__new__";

type Ctx = {
  state: EditorState;
  commit: (next: EditorState) => void;
  guide: Guide;
  e: EditorText;
  language: Language;
  tf: (template: string, values: Record<string, string | number>) => string;
  labelFor: (group: TextGroup, key?: string) => string;
  keysFor: (group: TextGroup) => string[];
};

function nameOf(ctx: Ctx, id: string): string {
  return ctx.labelFor("names", id) || id;
}

export function ArtworkLayoutEditor() {
  const { t, tf, locale } = useLocale();
  const guide = t.guideEntries.artworkLayouts;
  const e = t.artworkLayoutEditor;
  const language = (["en", "de", "fr"].includes(locale) ? locale : "en") as Language;

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED;
  const commit = (next: EditorState) => draftStore.set(next);

  const [buildId, setBuildId] = useState(state.builds[0]?.id ?? "");
  const [adding, setAdding] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const base = useId();

  const labelFor = (group: TextGroup, key?: string) => {
    if (!key) return "";
    const custom = state.texts[group][key];
    if (custom) return custom[language].trim() || custom.en;
    if (group === "names") return (guide.buildNames as Record<string, string>)[key] ?? key;
    if (group === "notes") return (guide.notes as Record<string, string>)[key] ?? key;
    return (guide.reasons as Record<string, string>)[key] ?? key;
  };
  const keysFor = (group: TextGroup) => {
    const published =
      group === "names" ? Object.keys(guide.buildNames)
      : group === "notes" ? Object.keys(guide.notes)
      : Object.keys(guide.reasons);
    return [...published, ...Object.keys(state.texts[group]).filter((key) => !published.includes(key))];
  };

  const ctx: Ctx = { state, commit, guide, e, language, tf, labelFor, keysFor };
  const draftData = useMemo(() => toLayoutData(state), [state]);
  const changes = useMemo(() => countChanges(PUBLISHED_DATA, draftData), [draftData]);
  const active = findBuild(state, buildId) ?? state.builds[0];
  const activeId = active?.id ?? "";

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
    setBuildId(PUBLISHED.builds[0]?.id ?? "");
  };

  const removeActive = () => {
    if (!active) return;
    if (!window.confirm(ctx.tf(e.removeBuildConfirm, { build: nameOf(ctx, active.id) }))) return;
    const next = removeBuild(state, active.id);
    commit(next);
    setBuildId(next.builds[0]?.id ?? "");
  };

  const tabId = (id: string) => `${base}-tab-${id}`;
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = state.builds.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : null;
    if (next === null) return;
    event.preventDefault();
    setBuildId(state.builds[next].id);
    document.getElementById(tabId(state.builds[next].id))?.focus();
  };

  return (
    <div className="hero-tiers tier-editor artwork-layout-editor artwork-layouts">
      <BackLink href="/guides/artwork-layouts/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <div className="build-tabs" role="tablist" aria-label={guide.setSkillsHeading}>
          {state.builds.map((build, index) => {
            const selected = build.id === activeId;
            return (
              <button
                key={build.id}
                id={tabId(build.id)}
                type="button"
                role="tab"
                className="build-tab"
                data-build={build.id}
                aria-selected={selected}
                aria-controls={`${base}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setBuildId(build.id)}
                onKeyDown={(event) => onTabKey(event, index)}
              >
                <span className="build-dot" aria-hidden="true" />
                {nameOf(ctx, build.id)}
              </button>
            );
          })}
        </div>
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0 ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={() => setAdding(true)}>{e.addBuild}</button>
          <button className="button" type="button" onClick={removeActive} disabled={state.builds.length <= 1}>{e.removeBuild}</button>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>{e.export}</button>
        </div>
      </div>

      {adding ? <AddBuildForm ctx={ctx} onDone={(id) => { setAdding(false); if (id) setBuildId(id); }} /> : null}

      {active ? (
        <div className="layout-edit-board" id={`${base}-panel`} role="tabpanel" aria-labelledby={tabId(active.id)} data-build={active.id}>
          <TextSelect
            ctx={ctx}
            group="notes"
            label={e.fieldNote}
            value={active.note}
            optional
            onPick={(key, created) => {
              const withText = created && key ? addText(state, "notes", key, created) : state;
              commit(setBuildNote(withText, active.id, key ?? ""));
            }}
          />

          <ol className="layout-edit-list">
            {active.rows.map((row, index) => {
              const set = paintingSetById(row.setId);
              return (
                <li key={row.uid} className="layout-edit-row">
                  <label className="layout-edit-rank">
                    <span className="visually-hidden">{e.fieldRank}</span>
                    <select
                      value={index}
                      aria-label={tf(e.rankOf, { name: set?.name ?? row.setId })}
                      onChange={(event) => commit(moveRow(state, active.id, row.uid, Number(event.target.value)))}
                    >
                      {active.rows.map((_, rank) => (
                        <option key={rank} value={rank}>{rank + 1}</option>
                      ))}
                    </select>
                  </label>
                  <div className="layout-edit-set">
                    <strong>{set?.name ?? row.setId}</strong>
                    {set ? <span className="rarity" data-rarity={set.rarity}>{set.rarity}</span> : null}
                  </div>
                  <TextSelect
                    ctx={ctx}
                    group="reasons"
                    label={e.fieldReason}
                    value={row.reason}
                    onPick={(key, created) => {
                      const withText = created && key ? addText(state, "reasons", key, created) : state;
                      commit(updateRow(withText, active.id, row.uid, { reason: key ?? "" }));
                    }}
                  />
                  <label className="tier-edit-check">
                    <input
                      type="checkbox"
                      checked={row.insert}
                      onChange={(event) => commit(updateRow(state, active.id, row.uid, { insert: event.target.checked }))}
                    />
                    {e.fieldInsert}
                  </label>
                  <button
                    type="button"
                    className="small-button button-danger"
                    onClick={() => commit(removeRow(state, active.id, row.uid))}
                  >
                    <TrashIcon className="icon icon-sm" />
                    {e.removeSet}
                  </button>
                </li>
              );
            })}
          </ol>
          {active.rows.length === 0 ? <p className="tier-small">{e.emptyBuild}</p> : null}
          <AddSetSelect ctx={ctx} buildId={active.id} />
        </div>
      ) : null}

      {exportOpen ? <ExportDialog ctx={ctx} data={draftData} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}

function AddSetSelect({ ctx, buildId }: { ctx: Ctx; buildId: string }) {
  const id = useId();
  const build = findBuild(ctx.state, buildId);
  if (!build) return null;
  const available = unusedSets(build);
  if (available.length === 0) return <p className="tier-small">{ctx.e.allSetsUsed}</p>;
  return (
    <div className="layout-edit-add">
      <label htmlFor={id}>{ctx.e.addSet}</label>
      <select
        id={id}
        value=""
        onChange={(event) => {
          const setId = event.target.value;
          if (!setId) return;
          const result = addRow(ctx.state, buildId, setId);
          if (result) ctx.commit(result.state);
        }}
      >
        <option value="">{ctx.e.addSetPlaceholder}</option>
        {PAINTING_RARITIES.map((rarity) => {
          const sets = available.filter((set) => set.rarity === rarity);
          if (sets.length === 0) return null;
          return (
            <optgroup key={rarity} label={rarity}>
              {sets.map((set) => (
                <option key={set.id} value={set.id}>{set.name}</option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}

function AddBuildForm({ ctx, onDone }: { ctx: Ctx; onDone: (id?: string) => void }) {
  const id = useId();
  const [value, setValue] = useState<Translations>({ en: "", de: "", fr: "" });
  const [from, setFrom] = useState("");
  const fields: [keyof Translations, string][] = [["en", ctx.e.newTextEn], ["de", ctx.e.newTextDe], ["fr", ctx.e.newTextFr]];
  return (
    <div className="layout-edit-newbuild">
      <p className="tier-edit-newtext-title">{ctx.e.addBuildTitle}</p>
      {fields.map(([language, label]) => (
        <div className="field" key={language}>
          <label htmlFor={`${id}-${language}`}>{label}</label>
          <input
            id={`${id}-${language}`}
            value={value[language]}
            onChange={(event) => setValue((current) => ({ ...current, [language]: event.target.value }))}
          />
        </div>
      ))}
      <div className="field">
        <label htmlFor={`${id}-from`}>{ctx.e.copyFrom}</label>
        <select id={`${id}-from`} value={from} onChange={(event) => setFrom(event.target.value)}>
          <option value="">{ctx.e.copyEmpty}</option>
          {ctx.state.builds.map((build) => (
            <option key={build.id} value={build.id}>{nameOf(ctx, build.id)}</option>
          ))}
        </select>
      </div>
      <p className="tier-small">{ctx.e.newTextHint}</p>
      <div className="tier-edit-row-actions">
        <button
          className="small-button"
          type="button"
          disabled={!value.en.trim()}
          onClick={() => {
            const result = addBuild(ctx.state, value, from || undefined);
            ctx.commit(result.state);
            onDone(result.id);
          }}
        >
          <CheckIcon className="icon icon-sm" />
          {ctx.e.addBuild}
        </button>
        <button className="small-button" type="button" onClick={() => onDone()}>{ctx.e.cancel}</button>
      </div>
    </div>
  );
}

function TextSelect({
  ctx,
  group,
  label,
  value,
  optional,
  onPick,
}: {
  ctx: Ctx;
  group: TextGroup;
  label: string;
  value?: string;
  optional?: boolean;
  onPick: (key: string | undefined, created?: Translations) => void;
}) {
  const id = useId();
  const [creating, setCreating] = useState(false);
  const keys = ctx.keysFor(group);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={creating ? NEW_TEXT : value ?? ""}
        onChange={(event) => {
          if (event.target.value === NEW_TEXT) { setCreating(true); return; }
          setCreating(false);
          onPick(event.target.value || undefined);
        }}
      >
        {optional || !value ? <option value="">{ctx.e.none}</option> : null}
        {value && !keys.includes(value) ? <option value={value}>{value}</option> : null}
        {keys.map((key) => <option key={key} value={key}>{ctx.labelFor(group, key)}</option>)}
        <option value={NEW_TEXT}>{ctx.e.newText}</option>
      </select>
      {creating ? (
        <NewTextForm
          ctx={ctx}
          onCancel={() => setCreating(false)}
          onAdd={(created) => {
            setCreating(false);
            onPick(textKeyFrom(created.en, [...keys, ...Object.keys(ctx.state.texts[group])]), created);
          }}
        />
      ) : null}
    </div>
  );
}

function NewTextForm({ ctx, onAdd, onCancel }: { ctx: Ctx; onAdd: (text: Translations) => void; onCancel: () => void }) {
  const id = useId();
  const [value, setValue] = useState<Translations>({ en: "", de: "", fr: "" });
  const fields: [keyof Translations, string][] = [["en", ctx.e.newTextEn], ["de", ctx.e.newTextDe], ["fr", ctx.e.newTextFr]];
  return (
    <div className="tier-edit-newtext">
      <p className="tier-edit-newtext-title">{ctx.e.newTextTitle}</p>
      {fields.map(([language, label]) => (
        <div className="field" key={language}>
          <label htmlFor={`${id}-${language}`}>{label}</label>
          <input
            id={`${id}-${language}`}
            value={value[language]}
            onChange={(event) => setValue((current) => ({ ...current, [language]: event.target.value }))}
          />
        </div>
      ))}
      <p className="tier-small">{ctx.e.newTextHint}</p>
      <div className="tier-edit-row-actions">
        <button className="small-button" type="button" disabled={!value.en.trim()} onClick={() => onAdd(value)}>
          <CheckIcon className="icon icon-sm" />
          {ctx.e.newTextAdd}
        </button>
        <button className="small-button" type="button" onClick={onCancel}>{ctx.e.cancel}</button>
      </div>
    </div>
  );
}

function problemText(ctx: Ctx, problem: Problem): string {
  switch (problem.code) {
    case "emptyBuild": return ctx.tf(ctx.e.problemEmptyBuild, { build: nameOf(ctx, problem.id) });
    case "emptyName": return ctx.tf(ctx.e.problemEmptyName, { build: problem.id || ctx.e.unnamed });
    case "unknownSet": return ctx.tf(ctx.e.problemUnknownSet, { build: nameOf(ctx, problem.id), set: problem.setId });
    case "duplicateSet": return ctx.tf(ctx.e.problemDuplicateSet, { build: nameOf(ctx, problem.id), set: paintingSetById(problem.setId)?.name ?? problem.setId });
    case "emptyReason": return ctx.tf(ctx.e.problemEmptyReason, { build: nameOf(ctx, problem.id), set: paintingSetById(problem.setId)?.name ?? problem.setId });
    case "missingText": {
      const group = { names: ctx.e.groupNames, notes: ctx.e.groupNotes, reasons: ctx.e.groupReasons }[problem.group];
      return ctx.tf(ctx.e.problemMissingText, { group, key: problem.key });
    }
  }
}

function ExportDialog({ ctx, data, onClose }: { ctx: Ctx; data: ReturnType<typeof toLayoutData>; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const json = useMemo(() => serializeLayoutData(data), [data]);
  const snippets = useMemo(() => dictionarySnippet(ctx.state.texts), [ctx.state.texts]);
  const known = useMemo(
    () => ({
      names: new Set(Object.keys(ctx.guide.buildNames)),
      notes: new Set(Object.keys(ctx.guide.notes)),
      reasons: new Set(Object.keys(ctx.guide.reasons)),
    }),
    [ctx.guide],
  );
  const problems = useMemo(() => findProblems(ctx.state, known), [ctx.state, known]);

  const copy = (key: string, value: string) =>
    navigator.clipboard?.writeText(value).then(() => setCopied(key), () => { /* clipboard blocked */ });
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "artwork-layouts.json";
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
        <h2 id={`${id}-title`}>{ctx.e.exportTitle}</h2>
        <button type="button" className="icon-button" aria-label={ctx.e.close} onClick={() => dialog.current?.close()}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>
      <p className="tier-small">{ctx.e.exportLede}</p>

      {problems.length > 0 ? (
        <div className="notice notice-warn tier-export-problems" role="alert">
          <div>
            <strong>{ctx.e.problemsTitle}</strong>
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(ctx, problem)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/artwork-layouts.json</code>
          <div className="tier-edit-row-actions">
            <button className="small-button" type="button" onClick={() => void copy("json", json)}>
              {copied === "json" ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied === "json" ? ctx.e.copied : ctx.e.copy}
            </button>
            <button className="small-button" type="button" onClick={download}>
              <DownloadIcon className="icon icon-sm" />
              {ctx.e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/artwork-layouts.json" />
      </div>

      {snippets.en ? (
        <div className="tier-export-block">
          <h3>{ctx.e.exportTexts}</h3>
          <p className="tier-small">{ctx.e.exportTextsLede}</p>
          {LANGUAGES.map((language) => (
            <div key={language} className="tier-export-snippet">
              <div className="tier-export-head">
                <code>{`lib/i18n/dictionaries/${language}.ts`}</code>
                <button className="small-button" type="button" onClick={() => void copy(language, snippets[language])}>
                  {copied === language ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
                  {copied === language ? ctx.e.copied : ctx.e.copy}
                </button>
              </div>
              <textarea readOnly value={snippets[language]} rows={4} spellCheck={false} aria-label={`lib/i18n/dictionaries/${language}.ts`} />
            </div>
          ))}
        </div>
      ) : null}
    </dialog>
  );
}
