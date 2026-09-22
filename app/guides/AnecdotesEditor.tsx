"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import {
  ANECDOTE_DATA,
  ANECDOTE_GROUPS,
  anecdoteImageUrl,
  chainPosition,
  localizedAnecdote,
  type AnecdoteGroup,
} from "../../lib/content/anecdotes";
import {
  ANECDOTE_IMAGE_MAX_EDGE,
  PUBLISHED_ANECDOTES,
  addAnecdote,
  addStep,
  addSubstep,
  afterOptions,
  anecdoteByUid,
  anecdoteTextBlocks,
  countAnecdoteChanges,
  exportAnecdotes,
  exportIds,
  exportedAnecdoteTexts,
  findAnecdoteProblems,
  moveAnecdote,
  moveStep,
  parseAnecdoteDraft,
  removeAnecdote,
  removeImage,
  removeStep,
  removeSubstep,
  serializeAnecdoteData,
  setAfter,
  setAnecdoteText,
  setGroup,
  setImage,
  setStepText,
  setSubstepText,
  setThanks,
  type AnecdoteEditorState,
  type AnecdoteExport,
  type AnecdoteProblem,
  type EditorAnecdote,
} from "../../lib/content/anecdotes-editor";
import { DEFAULT_LOCALE, LOCALE_CODES, fill, type Dictionary, type Locale } from "../../lib/i18n";
import { ANECDOTE_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, ChevronIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { AnecdoteCard } from "./AnecdotesGuide";

type EditorText = Dictionary["anecdoteEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const PUBLISHED_EXPORT = exportAnecdotes(PUBLISHED_ANECDOTES, ANECDOTE_DATA);
const PUBLISHED_TEXTS = exportedAnecdoteTexts(PUBLISHED_ANECDOTES);
const PUBLISHED_BLOCKS = anecdoteTextBlocks(PUBLISHED_ANECDOTES);

const draftStore = createPersistentStore<AnecdoteEditorState | null>({
  key: ANECDOTE_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseAnecdoteDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function imageSrc(anecdote: EditorAnecdote): string | null {
  if (anecdote.image?.data) return anecdote.image.data;
  if (anecdote.image?.file) return anecdoteImageUrl(anecdote.image.file);
  return null;
}

/** Shrinks a picture to at most ANECDOTE_IMAGE_MAX_EDGE on its long side and re-encodes it as WebP. */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, ANECDOTE_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.85);
  // Older Safari cannot encode WebP and silently returns PNG instead.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

/** False only when the browser refuses the draft for size; storage that is off entirely keeps it in memory. */
function fitsStorage(next: AnecdoteEditorState): boolean {
  try {
    localStorage.setItem(ANECDOTE_DRAFT_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch (error) {
    return !(error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED"));
  }
}

function download(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
}

type Ctx = {
  state: AnecdoteEditorState;
  commit: (next: AnecdoteEditorState) => void;
  t: Dictionary;
  e: EditorText;
  tf: Tf;
  language: Locale;
  /** The languages the fields are shown in; the first one is always English. */
  languages: Locale[];
  exported: AnecdoteExport;
};

export function AnecdotesEditor() {
  const { t, tf } = useLocale();
  const e = t.anecdoteEditor;
  const guide = t.guideEntries.anecdotes;
  // English is the wording in the JSON, so it is always shown.
  const { language, languages } = useEditorLanguages({ withDefault: true });

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED_ANECDOTES;
  const commit = (next: AnecdoteEditorState) => draftStore.set(next);

  const [group, setGroupFilter] = useState<AnecdoteGroup | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const exported = useMemo(() => exportAnecdotes(state, ANECDOTE_DATA), [state]);
  const texts = useMemo(() => exportedAnecdoteTexts(state), [state]);
  const changes = useMemo(() => countAnecdoteChanges(PUBLISHED_ANECDOTES, state), [state]);
  const problems = useMemo(() => findAnecdoteProblems(state), [state]);
  const ctx: Ctx = { state, commit, t, e, tf, language, languages, exported };

  const needle = query.trim().toLowerCase();
  const visible = state.anecdotes.filter((anecdote) => {
    if (group !== "all" && anecdote.group !== group) return false;
    if (!needle) return true;
    const hay = [anecdote.name, anecdote.prerequisite, anecdote.reward, anecdote.note, ...anecdote.steps.flatMap((step) => [step.text, ...step.substeps.map((substep) => substep.text)])]
      .flatMap((text) => LOCALE_CODES.map((code) => text[code]))
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
  const active = selected ? anecdoteByUid(state, selected) : undefined;

  const statusOf = (anecdote: EditorAnecdote): "new" | "changed" | null => {
    const index = state.anecdotes.indexOf(anecdote);
    const row = exported.data.anecdotes[index];
    const before = PUBLISHED_EXPORT.data.anecdotes.find((entry) => entry.id === row.id);
    if (!anecdote.id || !before) return "new";
    if (JSON.stringify(before) !== JSON.stringify(row)) return "changed";
    const translated = LOCALE_CODES.some((code) => JSON.stringify(PUBLISHED_TEXTS[code][row.id]) !== JSON.stringify(texts[code][row.id]));
    return translated ? "changed" : null;
  };

  const select = (uid: string) => {
    setSelected(uid);
    // On a phone the form sits below the list, so bring it into view.
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
    const result = addAnecdote(state, group === "all" ? "general" : group);
    commit(result.state);
    setQuery("");
    select(result.uid);
  };

  return (
    <div className="hero-editor anecdote-editor">
      <BackLink href="/guides/anecdotes/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar hero-edit-toolbar">
        <div className="hero-filters" role="group" aria-label={guide.filterLabel}>
          <button type="button" className="hero-filter" aria-pressed={group === "all"} onClick={() => setGroupFilter("all")}>
            {guide.groupAll}
          </button>
          {ANECDOTE_GROUPS.map((entry) => (
            <button key={entry} type="button" className="hero-filter" aria-pressed={group === entry} onClick={() => setGroupFilter(entry)}>
              {guide.groups[entry]}
            </button>
          ))}
        </div>
        <AllLanguagesToggle />
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0 ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={add}>
            <PlusIcon className="icon icon-sm" />
            {e.addAnecdote}
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
          <label className="hero-search">
            <span className="visually-hidden">{e.searchLabel}</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={e.searchPlaceholder} />
          </label>
          <p className="hero-count">{fill(guide.countLabel, { count: visible.length })}</p>
          {visible.length === 0 ? <p className="tier-small">{e.emptyList}</p> : (
            <ul className="hero-edit-list">
              {visible.map((anecdote) => {
                const status = statusOf(anecdote);
                const src = imageSrc(anecdote);
                const steps = anecdote.steps.length;
                return (
                  <li key={anecdote.uid}>
                    <button
                      type="button"
                      className={anecdote.uid === active?.uid ? "hero-edit-row is-selected" : "hero-edit-row"}
                      aria-pressed={anecdote.uid === active?.uid}
                      onClick={() => select(anecdote.uid)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {src ? <img className="anecdote-thumb" src={src} alt="" width={40} height={40} /> : <span className="anecdote-thumb is-empty" aria-hidden="true" />}
                      <span className="hero-edit-row-text">
                        <strong>{anecdote.name[language].trim() || anecdote.name[DEFAULT_LOCALE].trim() || e.unnamed}</strong>
                        <span>
                          <span className="anecdote-group" data-group={anecdote.group}>{guide.groups[anecdote.group]}</span>
                          {steps === 1 ? e.stepCountOne : tf(e.stepCount, { count: steps })}
                        </span>
                      </span>
                      {status ? <span className={`hero-edit-badge is-${status}`}>{status === "new" ? e.badgeNew : e.badgeChanged}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {active ? (
          <AnecdoteForm
            ctx={ctx}
            anecdote={active}
            onRemoved={() => setSelected(null)}
            onGroup={(next) => { if (group !== "all") setGroupFilter(next); }}
          />
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

function AnecdoteForm({
  ctx,
  anecdote,
  onRemoved,
  onGroup,
}: {
  ctx: Ctx;
  anecdote: EditorAnecdote;
  onRemoved: () => void;
  onGroup: (group: AnecdoteGroup) => void;
}) {
  const id = useId();
  const { state, commit, e, tf, t, languages } = ctx;
  const guide = t.guideEntries.anecdotes;
  const name = anecdote.name[DEFAULT_LOCALE].trim() || e.unnamed;
  const groupLabel = guide.groups[anecdote.group];
  const sameGroup = state.anecdotes.filter((entry) => entry.group === anecdote.group);
  const position = sameGroup.indexOf(anecdote);
  const exportId = exportIds(state).get(anecdote.uid) ?? "";
  const options = afterOptions(state, anecdote.uid);

  const remove = () => {
    if (!window.confirm(tf(e.removeConfirm, { anecdote: name }))) return;
    commit(removeAnecdote(state, anecdote.uid));
    onRemoved();
  };

  const text = (field: "name" | "prerequisite" | "reward" | "note") => ({
    languages,
    get: (locale: Locale) => anecdote[field][locale],
    set: (locale: Locale, value: string) => commit(setAnecdoteText(state, anecdote.uid, field, locale, value)),
  });

  return (
    <section className="hero-edit-form anecdote-edit-form" aria-labelledby={`${id}-title`}>
      <div className="tier-edit-form-head">
        <h2 id={`${id}-title`}>{name}</h2>
        <div className="tier-edit-row-actions">
          <button type="button" className="icon-button hero-edit-up" aria-label={tf(e.moveUp, { group: groupLabel })} disabled={position <= 0} onClick={() => commit(moveAnecdote(state, anecdote.uid, -1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="icon-button hero-edit-down" aria-label={tf(e.moveDown, { group: groupLabel })} disabled={position >= sameGroup.length - 1} onClick={() => commit(moveAnecdote(state, anecdote.uid, 1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="small-button button-danger" onClick={remove} disabled={state.anecdotes.length <= 1}>
            <TrashIcon className="icon icon-sm" />
            {e.removeAnecdote}
          </button>
        </div>
      </div>

      <ImageField ctx={ctx} anecdote={anecdote} />

      <div className="hero-edit-fields">
        <div className="hero-edit-wide">
          <TranslatedField label={e.fieldName} {...text("name")} />
          <p className="tier-small">
            {e.fieldId}: <code>{exportId || "—"}</code>
            {anecdote.id ? null : ` · ${e.idFromName}`}
          </p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-group`}>{e.fieldGroup}</label>
          <select
            id={`${id}-group`}
            value={anecdote.group}
            onChange={(event) => {
              const next = event.target.value as AnecdoteGroup;
              commit(setGroup(state, anecdote.uid, next));
              onGroup(next);
            }}
          >
            {ANECDOTE_GROUPS.map((entry) => <option key={entry} value={entry}>{guide.groups[entry]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-after`}>{e.fieldAfter}</label>
          <select id={`${id}-after`} value={anecdote.after} onChange={(event) => commit(setAfter(state, anecdote.uid, event.target.value))}>
            <option value="">{e.afterNone}</option>
            {ANECDOTE_GROUPS.map((entry) => {
              const inGroup = options.filter((option) => option.group === entry);
              if (inGroup.length === 0) return null;
              return (
                <optgroup key={entry} label={guide.groups[entry]}>
                  {inGroup.map((option) => (
                    <option key={option.uid} value={option.uid}>{option.name[DEFAULT_LOCALE].trim() || e.unnamed}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div className="hero-edit-wide">
          <TranslatedField label={e.fieldPrerequisite} hint={e.fieldPrerequisiteHint} multiline rows={2} {...text("prerequisite")} />
        </div>
        <div>
          <TranslatedField label={e.fieldReward} hint={e.fieldRewardHint} {...text("reward")} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-thanks`}>{e.fieldThanks}</label>
          <input id={`${id}-thanks`} value={anecdote.thanks} onChange={(event) => commit(setThanks(state, anecdote.uid, event.target.value))} />
          <p className="tier-small">{e.fieldThanksHint}</p>
        </div>
      </div>

      <StepsField ctx={ctx} anecdote={anecdote} />

      <TranslatedField label={e.fieldNote} hint={e.fieldNoteHint} multiline rows={2} {...text("note")} />

      <Preview ctx={ctx} anecdote={anecdote} />
    </section>
  );
}

function StepsField({ ctx, anecdote }: { ctx: Ctx; anecdote: EditorAnecdote }) {
  const { state, commit, e, tf, languages } = ctx;
  const count = anecdote.steps.length;
  return (
    <fieldset className="hero-edit-skills anecdote-edit-steps">
      <legend>{e.stepsHeading}</legend>
      <p className="tier-small">{e.stepsHint}</p>
      {count === 0 ? <p className="tier-small">{e.noSteps}</p> : (
        <ol>
          {anecdote.steps.map((step, index) => {
            const number = index + 1;
            return (
              <li key={step.uid} className="hero-edit-skill anecdote-edit-step">
                <span className="anecdote-edit-number" aria-hidden="true">{number}</span>
                <div className="anecdote-edit-step-body">
                  <TranslatedField
                    label={tf(e.stepLabel, { step: number })}
                    multiline
                    rows={2}
                    languages={languages}
                    get={(locale) => step.text[locale]}
                    set={(locale, value) => commit(setStepText(state, anecdote.uid, step.uid, locale, value))}
                  />
                  {step.substeps.length > 0 ? (
                    <ul className="anecdote-edit-substeps">
                      {step.substeps.map((substep, position) => {
                        const letter = LETTERS[position] ?? String(position + 1);
                        return (
                          <li key={substep.uid}>
                            <TranslatedField
                              label={tf(e.substepLabel, { step: number, letter })}
                              languages={languages}
                              get={(locale) => substep.text[locale]}
                              set={(locale, value) => commit(setSubstepText(state, anecdote.uid, step.uid, substep.uid, locale, value))}
                            />
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={tf(e.removeSubstep, { step: number, letter })}
                              onClick={() => commit(removeSubstep(state, anecdote.uid, step.uid, substep.uid))}
                            >
                              <CloseIcon className="icon icon-sm" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  <div className="tier-edit-row-actions">
                    <button type="button" className="small-button" onClick={() => commit(addSubstep(state, anecdote.uid, step.uid))}>
                      <PlusIcon className="icon icon-sm" />
                      {e.addSubstep}
                    </button>
                    <button type="button" className="icon-button" aria-label={tf(e.addStepAfter, { step: number })} onClick={() => commit(addStep(state, anecdote.uid, index))}>
                      <PlusIcon className="icon icon-sm" />
                    </button>
                    <button type="button" className="icon-button hero-edit-up" aria-label={tf(e.moveStepUp, { step: number })} disabled={index === 0} onClick={() => commit(moveStep(state, anecdote.uid, step.uid, -1))}>
                      <ChevronIcon className="icon icon-sm" />
                    </button>
                    <button type="button" className="icon-button hero-edit-down" aria-label={tf(e.moveStepDown, { step: number })} disabled={index === count - 1} onClick={() => commit(moveStep(state, anecdote.uid, step.uid, 1))}>
                      <ChevronIcon className="icon icon-sm" />
                    </button>
                    <button type="button" className="icon-button" aria-label={tf(e.removeStep, { step: number })} onClick={() => commit(removeStep(state, anecdote.uid, step.uid))}>
                      <TrashIcon className="icon icon-sm" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <button type="button" className="small-button" onClick={() => commit(addStep(state, anecdote.uid))}>
        <PlusIcon className="icon icon-sm" />
        {e.addStep}
      </button>
    </fieldset>
  );
}

function ImageField({ ctx, anecdote }: { ctx: Ctx; anecdote: EditorAnecdote }) {
  const { e } = ctx;
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const src = imageSrc(anecdote);

  const addFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      if (!file.type.startsWith("image/")) { setError(e.uploadNotImage); return; }
      if (file.size > MAX_UPLOAD_BYTES) { setError(e.uploadTooBig); return; }
      let data: string;
      try {
        data = await shrinkImage(file);
      } catch {
        setError(e.uploadNotImage);
        return;
      }
      // Read the store again: the draft may have changed while the picture was encoding.
      const next = setImage(draftStore.getSnapshot() ?? PUBLISHED_ANECDOTES, anecdote.uid, data);
      if (!fitsStorage(next)) {
        setError(e.storageFull);
        return;
      }
      draftStore.set(next);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    void addFile(event.dataTransfer.files);
  };

  return (
    <fieldset
      className={dragging ? "hero-edit-images is-dragging" : "hero-edit-images"}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <legend>{e.imageHeading}</legend>
      <div className="anecdote-edit-image">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" />
        ) : null}
        <button type="button" className="hero-edit-drop" onClick={() => input.current?.click()} disabled={busy}>
          <UploadIcon className="icon" />
          <strong>{src ? e.replaceImage : e.uploadImage}</strong>
          <small>{e.dropHint}</small>
        </button>
        {anecdote.image ? (
          <button type="button" className="small-button button-danger" onClick={() => ctx.commit(removeImage(ctx.state, anecdote.uid))}>
            <TrashIcon className="icon icon-sm" />
            {e.removeImage}
          </button>
        ) : null}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          hidden
          onChange={(event) => {
            void addFile(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      <p className="tier-small">{e.imageHint}</p>
      {error ? <p className="notice notice-warn" role="alert">{error}</p> : null}
    </fieldset>
  );
}

/** The card as readers in the page's language will see it once exported. */
function Preview({ ctx, anecdote }: { ctx: Ctx; anecdote: EditorAnecdote }) {
  const { state, exported, language, t, e } = ctx;
  const guide = t.guideEntries.anecdotes;
  const texts = useMemo(() => exportedAnecdoteTexts(state)[language], [state, language]);
  const rows = exported.data.anecdotes;
  const row = rows[state.anecdotes.indexOf(anecdote)];
  if (!row) return null;
  const nameOf = (target: string) => {
    const found = rows.find((entry) => entry.id === target);
    return found ? localizedAnecdote(found, texts).name : target;
  };
  return (
    <section className="anecdote-edit-preview">
      <h3>{e.previewHeading}</h3>
      <AnecdoteCard
        anecdote={localizedAnecdote(row, texts)}
        guide={guide}
        after={row.after ? { id: row.after, name: nameOf(row.after) } : null}
        next={rows.filter((entry) => entry.after === row.id).map((entry) => ({ id: entry.id, name: nameOf(entry.id) }))}
        chain={chainPosition(row.id, rows)}
        image={imageSrc(anecdote)}
        headingLevel={3}
        showGroup
      />
    </section>
  );
}

function problemText(ctx: Ctx, problem: AnecdoteProblem): string {
  const { e, tf, t } = ctx;
  switch (problem.code) {
    case "emptyName": return tf(e.problemEmptyName, { group: t.guideEntries.anecdotes.groups[problem.group] });
    case "duplicateName": return tf(e.problemDuplicateName, { name: problem.name });
    case "nothingToDo": return tf(e.problemNothingToDo, { anecdote: problem.anecdote });
    case "emptyStep": return tf(e.problemEmptyStep, { anecdote: problem.anecdote, step: problem.step });
    case "emptySubstep": return tf(e.problemEmptySubstep, { anecdote: problem.anecdote, step: problem.step });
  }
}

function ExportDialog({ ctx, problems, onClose }: { ctx: Ctx; problems: AnecdoteProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const { e, tf, exported: result } = ctx;
  const json = useMemo(() => serializeAnecdoteData(result.data), [result]);
  // Only the dictionaries whose anecdoteTexts changed need a new block.
  const blocks = useMemo(() => {
    const all = anecdoteTextBlocks(ctx.state);
    return Object.fromEntries(LOCALE_CODES.filter((code) => all[code] !== PUBLISHED_BLOCKS[code]).map((code) => [code, all[code]]));
  }, [ctx.state]);

  const copy = (key: string, value: string) =>
    navigator.clipboard?.writeText(value).then(() => setCopied(key), () => { /* clipboard blocked */ });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    download(url, "anecdotes.json");
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const downloadAll = () => {
    result.uploads.forEach((upload, index) => {
      window.setTimeout(() => download(upload.data, upload.file), index * 300);
    });
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
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(ctx, problem)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      {result.uploads.length > 0 ? (
        <div className="tier-export-block">
          <div className="tier-export-head">
            <strong>{tf(e.uploadsHeading, { count: result.uploads.length })}</strong>
            <div className="tier-edit-row-actions">
              <button className="small-button" type="button" onClick={downloadAll}>
                <DownloadIcon className="icon icon-sm" />
                {e.downloadAll}
              </button>
            </div>
          </div>
          <ul className="hero-export-files">
            {result.uploads.map((upload) => (
              <li key={upload.file}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={upload.data} alt="" width={40} height={40} />
                <span>
                  <code>public/anecdotes/{upload.file}</code>
                  <small>{upload.anecdote}</small>
                </span>
                <button className="small-button" type="button" onClick={() => download(upload.data, upload.file)}>
                  <DownloadIcon className="icon icon-sm" />
                  {e.download}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.removedFiles.length > 0 ? (
        <div className="tier-export-block">
          <div className="tier-export-head">
            <strong>{tf(e.removedHeading, { count: result.removedFiles.length })}</strong>
          </div>
          <ul className="hero-export-removed">
            {result.removedFiles.map((file) => <li key={file}><code>public/anecdotes/{file}</code></li>)}
          </ul>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/anecdotes.json</code>
          <div className="tier-edit-row-actions">
            <button className="small-button" type="button" onClick={() => void copy("json", json)}>
              {copied === "json" ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied === "json" ? e.copied : e.copy}
            </button>
            <button className="small-button" type="button" onClick={downloadJson}>
              <DownloadIcon className="icon icon-sm" />
              {e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/anecdotes.json" />
      </div>

      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={6} />
    </dialog>
  );
}
