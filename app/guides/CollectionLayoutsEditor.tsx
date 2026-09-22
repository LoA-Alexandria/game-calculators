"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  PUBLISHED_LAYOUTS,
  addNote,
  addSetup,
  countLayoutChanges,
  exportIds,
  exportLayouts,
  findLayoutProblems,
  layoutTextBlocks,
  moveSetup,
  optionByUid,
  parseLayoutsDraft,
  removeNote,
  removeSetup,
  serializeLayoutsData,
  setCredit,
  setNoteText,
  setOptionText,
  setSetupText,
  setSlot,
  setupByUid,
  toggleOptionTag,
  toggleSetupTag,
  type EditorOption,
  type EditorSetup,
  type LayoutProblem,
  type LayoutsEditorState,
} from "../../lib/content/collection-layouts-editor";
import {
  COLLECTION_AGES,
  COLLECTION_LAYOUT_TAGS,
  layoutItem,
  type CollectionAge,
  type CollectionLayoutTag,
} from "../../lib/content/collection-layouts";
import { COLLECTION_ITEMS, type CollectionTexts } from "../../lib/content/collection";
import { DEFAULT_LOCALE, LOCALE_CODES, type Dictionary, type Locale } from "../../lib/i18n";
import { COLLECTION_LAYOUTS_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, ChevronIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";

type EditorText = Dictionary["collectionLayoutsEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;
type Selection = { kind: "setup" | "option"; uid: string } | null;

const PUBLISHED = PUBLISHED_LAYOUTS;
const PUBLISHED_BLOCKS = layoutTextBlocks(PUBLISHED_LAYOUTS);

const draftStore = createPersistentStore<LayoutsEditorState | null>({
  key: COLLECTION_LAYOUTS_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseLayoutsDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function download(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
}

type Ctx = {
  state: LayoutsEditorState;
  commit: (next: LayoutsEditorState) => void;
  e: EditorText;
  guide: Dictionary["guideEntries"]["collectionLayouts"];
  names: CollectionTexts;
  tf: Tf;
  languages: Locale[];
};

function TagPicker({ tags, onToggle, ctx }: { tags: readonly CollectionLayoutTag[]; onToggle: (tag: CollectionLayoutTag) => void; ctx: Ctx }) {
  return (
    <fieldset className="cl-edit-tags">
      <legend>{ctx.e.fieldTags}</legend>
      <div className="cl-edit-tag-options">
        {COLLECTION_LAYOUT_TAGS.map((tag) => (
          <label className="cl-edit-tag" key={tag} data-tag={tag}>
            <input type="checkbox" checked={tags.includes(tag)} onChange={() => onToggle(tag)} />
            {ctx.guide.tags[tag]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CollectionLayoutsEditor() {
  const { t, tf, locale } = useLocale();
  const e = t.collectionLayoutsEditor;
  const guide = t.guideEntries.collectionLayouts;
  const names = t.guideEntries.collection.collectionTexts as CollectionTexts;
  const { languages } = useEditorLanguages({ withDefault: true });

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED;
  const commit = (next: LayoutsEditorState) => draftStore.set(next);
  const [selected, setSelected] = useState<Selection>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const ctx: Ctx = { state, commit, e, guide, names, tf, languages };
  const changes = useMemo(() => countLayoutChanges(PUBLISHED, state), [state]);
  const problems = useMemo(() => findLayoutProblems(state), [state]);
  const ids = useMemo(() => exportIds(state), [state]);

  const setup = selected?.kind === "setup" ? setupByUid(state, selected.uid) : undefined;
  const option = selected?.kind === "option" ? optionByUid(state, selected.uid) : undefined;

  const select = (next: Selection) => {
    setSelected(next);
    if (window.matchMedia("(max-width: 860px)").matches) {
      window.requestAnimationFrame(() => document.querySelector(".hero-edit-form")?.scrollIntoView({ block: "start" }));
    }
  };

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
    setSelected(null);
  };

  const add = () => {
    const result = addSetup(state);
    commit(result.state);
    select({ kind: "setup", uid: result.uid });
  };

  const titleOf = (entry: EditorSetup) => entry.title[locale]?.trim() || entry.title[DEFAULT_LOCALE].trim() || e.unnamed;
  const nameOf = (entry: EditorOption) => layoutItem(entry.item, entry.name, names).name;

  return (
    <div className="hero-editor collection-layouts-editor">
      <BackLink href="/guides/collection-layouts/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <AllLanguagesToggle />
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0 ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={add}>
            <PlusIcon className="icon icon-sm" />
            {e.addSetup}
          </button>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>
            {e.export}
            {problems.length > 0 ? <span className="tier-edit-count" aria-label={tf(e.problemCount, { count: problems.length })}>{problems.length}</span> : null}
          </button>
        </div>
      </div>

      <div className="hero-edit-board">
        <div className="hero-edit-side">
          <h2 className="cl-edit-side-title">{e.setupsHeading}</h2>
          <ul className="hero-edit-list">
            {state.setups.map((entry) => (
              <li key={entry.uid}>
                <button
                  type="button"
                  className={selected?.kind === "setup" && selected.uid === entry.uid ? "hero-edit-row is-selected" : "hero-edit-row"}
                  aria-pressed={selected?.kind === "setup" && selected.uid === entry.uid}
                  onClick={() => select({ kind: "setup", uid: entry.uid })}
                >
                  <span className="hero-edit-row-text">
                    <strong>{titleOf(entry)}</strong>
                    <span>{entry.credit}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <h2 className="cl-edit-side-title">{e.optionsHeading}</h2>
          {COLLECTION_AGES.map((age) => (
            <div key={age}>
              <p className="cl-edit-age" data-age={age}>{guide.ages[age]}</p>
              <ul className="hero-edit-list">
                {state.options.filter((entry) => entry.age === age).map((entry) => (
                  <li key={entry.uid}>
                    <button
                      type="button"
                      className={selected?.kind === "option" && selected.uid === entry.uid ? "hero-edit-row is-selected" : "hero-edit-row"}
                      aria-pressed={selected?.kind === "option" && selected.uid === entry.uid}
                      onClick={() => select({ kind: "option", uid: entry.uid })}
                    >
                      <span className="hero-edit-row-text">
                        <strong>{nameOf(entry)}</strong>
                        <span>{entry.tags.map((tag) => guide.tags[tag]).join(" · ")}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {setup ? (
          <SetupForm ctx={ctx} setup={setup} exportedId={ids.get(setup.uid) ?? ""} title={titleOf(setup)} onRemoved={() => setSelected(null)} />
        ) : option ? (
          <OptionForm ctx={ctx} option={option} title={nameOf(option)} />
        ) : (
          <div className="hero-edit-empty">
            <p>{e.selectHint}</p>
          </div>
        )}
      </div>

      {exportOpen ? <ExportDialog ctx={ctx} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}

function SetupForm({
  ctx,
  setup,
  exportedId,
  title,
  onRemoved,
}: {
  ctx: Ctx;
  setup: EditorSetup;
  exportedId: string;
  title: string;
  onRemoved: () => void;
}) {
  const id = useId();
  const { state, commit, e, guide, names, tf } = ctx;
  const index = state.setups.indexOf(setup);

  const remove = () => {
    if (!window.confirm(tf(e.removeSetupConfirm, { setup: title }))) return;
    commit(removeSetup(state, setup.uid));
    onRemoved();
  };

  return (
    <section className="hero-edit-form" aria-labelledby={`${id}-title`}>
      <div className="tier-edit-form-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <div className="tier-edit-row-actions">
          <button type="button" className="icon-button hero-edit-up" aria-label={e.moveUp} disabled={index <= 0} onClick={() => commit(moveSetup(state, setup.uid, -1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="icon-button hero-edit-down" aria-label={e.moveDown} disabled={index >= state.setups.length - 1} onClick={() => commit(moveSetup(state, setup.uid, 1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="small-button button-danger" onClick={remove}>
            <TrashIcon className="icon icon-sm" />
            {e.removeSetup}
          </button>
        </div>
      </div>

      <div className="hero-edit-fields">
        <div className="hero-edit-wide">
          <TranslatedField
            label={e.fieldTitle}
            languages={ctx.languages}
            get={(language) => setup.title[language] ?? ""}
            set={(language, value) => commit(setSetupText(state, setup.uid, "title", language, value))}
          />
          <p className="tier-small">Id: <code>{exportedId || "—"}</code></p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-credit`}>
            {e.fieldCredit} <span className="label-note">{e.fieldCreditNote}</span>
          </label>
          <input id={`${id}-credit`} value={setup.credit} onChange={(event) => commit(setCredit(state, setup.uid, event.target.value))} />
        </div>
        <div className="hero-edit-wide">
          <TranslatedField
            label={e.fieldLede}
            multiline
            rows={2}
            languages={ctx.languages}
            get={(language) => setup.lede[language] ?? ""}
            set={(language, value) => commit(setSetupText(state, setup.uid, "lede", language, value))}
          />
        </div>
      </div>

      <TagPicker tags={setup.tags} onToggle={(tag) => commit(toggleSetupTag(state, setup.uid, tag))} ctx={ctx} />

      <fieldset className="cl-edit-slots">
        <legend>{e.fieldSlots}</legend>
        <div className="cl-edit-slot-grid">
          {COLLECTION_AGES.map((age) => (
            <label className="cl-edit-slot" key={age} data-age={age}>
              <span>{guide.ages[age]}</span>
              <select value={setup.slots[age] ?? ""} onChange={(event) => commit(setSlot(state, setup.uid, age as CollectionAge, event.target.value))}>
                <option value="">{e.slotEmpty}</option>
                {state.options.filter((option) => option.age === age).map((option) => (
                  <option key={option.item} value={option.item}>{layoutItem(option.item, option.name, names).name}</option>
                ))}
                {COLLECTION_ITEMS.filter((item) => !state.options.some((option) => option.item === item.id)).map((item) => (
                  <option key={item.id} value={item.id}>{layoutItem(item.id, item.name, names).name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="cl-edit-notes">
        <legend>{e.fieldNotes}</legend>
        {setup.notes.map((note, position) => (
          <div className="cl-edit-note" key={note.uid}>
            <TranslatedField
              label={`${e.fieldNotes} ${position + 1}`}
              multiline
              rows={2}
              languages={ctx.languages}
              get={(language) => note.text[language] ?? ""}
              set={(language, value) => commit(setNoteText(state, setup.uid, note.uid, language, value))}
            />
            <button type="button" className="icon-button" aria-label={tf(e.removeNote, { number: position + 1 })} onClick={() => commit(removeNote(state, setup.uid, note.uid))}>
              <TrashIcon className="icon icon-sm" />
            </button>
          </div>
        ))}
        <button type="button" className="small-button" onClick={() => commit(addNote(state, setup.uid))}>
          <PlusIcon className="icon icon-sm" />
          {e.addNote}
        </button>
      </fieldset>
    </section>
  );
}

function OptionForm({ ctx, option, title }: { ctx: Ctx; option: EditorOption; title: string }) {
  const id = useId();
  const { state, commit, e, guide, names } = ctx;
  const known = layoutItem(option.item, option.name, names).known;

  return (
    <section className="hero-edit-form" aria-labelledby={`${id}-title`}>
      <div className="tier-edit-form-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <span className="cl-edit-age" data-age={option.age}>{guide.ages[option.age]}</span>
      </div>
      <p className="tier-small">
        {e.fieldItem}: <code>{option.item}</code>
        {known ? null : ` · ${e.itemPending}`}
      </p>
      <TagPicker tags={option.tags} onToggle={(tag) => commit(toggleOptionTag(state, option.uid, tag))} ctx={ctx} />
      <TranslatedField
        label={e.fieldNote}
        multiline
        rows={3}
        languages={ctx.languages}
        get={(language) => option.note[language] ?? ""}
        set={(language, value) => commit(setOptionText(state, option.uid, language, value))}
      />
    </section>
  );
}

function problemText(e: EditorText, guide: Ctx["guide"], tf: Tf, problem: LayoutProblem): string {
  switch (problem.code) {
    case "emptyTitle": return e.problemEmptyTitle;
    case "duplicateTitle": return tf(e.problemDuplicateTitle, { title: problem.title });
    case "emptySlot": return tf(e.problemEmptySlot, { setup: problem.setup, age: guide.ages[problem.age] });
    case "unknownItem": return tf(e.problemUnknownItem, { setup: problem.setup, item: problem.item });
    case "emptyNote": return tf(e.problemEmptyNote, { item: problem.item });
  }
}

function ExportDialog({ ctx, problems, onClose }: { ctx: Ctx; problems: LayoutProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const { e, guide, tf, state } = ctx;
  const json = useMemo(() => serializeLayoutsData(exportLayouts(state)), [state]);
  // Only the dictionaries whose blocks changed need pasting.
  const blocks = useMemo(() => {
    const all = layoutTextBlocks(state);
    return Object.fromEntries(LOCALE_CODES.filter((code) => all[code] !== PUBLISHED_BLOCKS[code]).map((code) => [code, all[code]]));
  }, [state]);

  const copy = () => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => { /* clipboard blocked */ });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    download(url, "collection-layouts.json");
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
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(e, guide, tf, problem)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/collection-layouts.json</code>
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
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/collection-layouts.json" />
      </div>

      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={8} />
    </dialog>
  );
}
