"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import { AGE_UNLOCKS_DATA, eventImageUrl } from "../../lib/content/server-age-unlocks";
import {
  AGE_UNLOCK_IMAGE_MAX_EDGE,
  PUBLISHED_AGE_UNLOCKS,
  addEvent,
  addMilestone,
  countAgeUnlockChanges,
  eventTextBlocks,
  exportAgeUnlocks,
  findAgeUnlockProblems,
  moveEvent,
  moveMilestone,
  parseAgeUnlockDraft,
  relatedGuideOptions,
  removeEvent,
  removeImage,
  removeMilestone,
  serializeAgeUnlocksData,
  setEventText,
  setImage,
  setMilestoneDay,
  setMilestoneLabel,
  setOneTime,
  setRelatedGuide,
  type AgeUnlockExport,
  type AgeUnlockProblem,
  type AgeUnlocksEditorState,
  type EditorAgeEvent,
  type EditorAgeMilestone,
  type EventTextField,
} from "../../lib/content/server-age-unlocks-editor";
import { DEFAULT_LOCALE, LOCALE_CODES, fill, type Dictionary, type Locale } from "../../lib/i18n";
import { AGE_UNLOCKS_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";

type EditorText = Dictionary["ageUnlocksEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PUBLISHED_BLOCKS = eventTextBlocks(PUBLISHED_AGE_UNLOCKS);

const draftStore = createPersistentStore<AgeUnlocksEditorState | null>({
  key: AGE_UNLOCKS_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseAgeUnlockDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function imageSrc(event: EditorAgeEvent): string | null {
  if (event.image?.data) return event.image.data;
  if (event.image?.file) return eventImageUrl(event.image.file);
  return null;
}

async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AGE_UNLOCK_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.86);
}

function download(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
}

type Ctx = {
  state: AgeUnlocksEditorState;
  commit: (next: AgeUnlocksEditorState) => void;
  e: EditorText;
  tf: Tf;
  languages: Locale[];
  guideTitles: Record<string, string>;
  exported: AgeUnlockExport;
};

function problemText(e: EditorText, tf: Tf, problem: AgeUnlockProblem): string {
  switch (problem.code) {
    case "noMilestones":
      return e.problemNoMilestones;
    case "emptyMilestone":
      return tf(e.problemEmptyMilestone, problem.values ?? {});
    case "badDay":
      return tf(e.problemBadDay, problem.values ?? {});
    case "emptyEvents":
      return tf(e.problemEmptyEvents, problem.values ?? {});
    case "emptyName":
      return tf(e.problemEmptyName, problem.values ?? {});
    case "duplicateName":
      return tf(e.problemDuplicateName, problem.values ?? {});
    case "badGuide":
      return tf(e.problemBadGuide, problem.values ?? {});
    default:
      return problem.code;
  }
}

function EventFields({ ctx, event }: { ctx: Ctx; event: EditorAgeEvent }) {
  const { state, commit, e, languages, guideTitles } = ctx;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const src = imageSrc(event);
  const name = event.name[DEFAULT_LOCALE].trim() || e.unnamedEvent;

  const text = (field: EventTextField) => ({
    languages,
    get: (locale: Locale) => event[field][locale],
    set: (locale: Locale, value: string) => commit(setEventText(state, event.uid, field, locale, value)),
  });

  const onUpload = async (file: File | undefined) => {
    setUploadError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError(e.uploadNotImage);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(e.uploadTooBig);
      return;
    }
    try {
      const data = await shrinkImage(file);
      commit(setImage(state, event.uid, { uid: `i${Date.now()}`, data }));
    } catch {
      setUploadError(e.uploadNotImage);
    }
  };

  const onDrop = (drag: DragEvent<HTMLDivElement>) => {
    drag.preventDefault();
    void onUpload(drag.dataTransfer.files?.[0]);
  };

  return (
    <article className="age-edit-event" aria-label={name}>
      <div className="tier-edit-form-head">
        <h3>{name}</h3>
        <div className="tier-edit-row-actions">
          <button className="small-button" type="button" onClick={() => commit(moveEvent(state, event.uid, -1))}>
            {e.moveUp}
          </button>
          <button className="small-button" type="button" onClick={() => commit(moveEvent(state, event.uid, 1))}>
            {e.moveDown}
          </button>
          <button
            className="small-button button-danger"
            type="button"
            onClick={() => {
              if (window.confirm(fill(e.removeEventConfirm, { event: name }))) commit(removeEvent(state, event.uid));
            }}
          >
            <TrashIcon className="icon icon-sm" />
            {e.removeEvent}
          </button>
        </div>
      </div>

      <TranslatedField label={e.fieldName} {...text("name")} />
      <TranslatedField label={e.fieldDetail} hint={e.fieldDetailHint} {...text("detail")} />
      <TranslatedField label={e.fieldDescription} hint={e.fieldDescriptionHint} multiline rows={3} {...text("description")} />

      <label className="tier-edit-check">
        <input
          type="checkbox"
          checked={event.oneTime}
          onChange={(change) => commit(setOneTime(state, event.uid, change.target.checked))}
        />
        {e.fieldOneTime}
      </label>

      <div className="field">
        <label htmlFor={`guide-${event.uid}`}>{e.fieldRelatedGuide}</label>
        <select
          id={`guide-${event.uid}`}
          value={event.relatedGuide}
          onChange={(change) => commit(setRelatedGuide(state, event.uid, change.target.value))}
        >
          <option value="">{e.relatedNone}</option>
          {relatedGuideOptions().map((guideId) => (
            <option key={guideId} value={guideId}>
              {guideTitles[guideId] ?? guideId}
            </option>
          ))}
        </select>
      </div>

      <div className="field" onDragOver={(drag) => drag.preventDefault()} onDrop={onDrop}>
        <strong>{e.imageHeading}</strong>
        <p className="tier-small">{e.imageHint}</p>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="age-edit-thumb" src={src} alt="" width={160} height={100} />
        ) : null}
        <div className="tier-edit-row-actions">
          <button className="small-button" type="button" onClick={() => fileRef.current?.click()}>
            <UploadIcon className="icon icon-sm" />
            {src ? e.replaceImage : e.uploadImage}
          </button>
          {src ? (
            <button className="small-button" type="button" onClick={() => commit(removeImage(state, event.uid))}>
              {e.removeImage}
            </button>
          ) : (
            <span className="tier-small">{e.dropHint}</span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(change) => {
            void onUpload(change.target.files?.[0]);
            change.target.value = "";
          }}
        />
        {uploadError ? <p className="notice notice-warn">{uploadError}</p> : null}
      </div>
    </article>
  );
}

function MilestoneBlock({ ctx, milestone }: { ctx: Ctx; milestone: EditorAgeMilestone }) {
  const { state, commit, e, languages } = ctx;
  const title = milestone.day.trim() || milestone.label[DEFAULT_LOCALE].trim() || e.unnamedMilestone;

  return (
    <section className="age-edit-milestone">
      <div className="tier-edit-form-head">
        <h2>{fill(e.milestoneHeading, { milestone: title })}</h2>
        <div className="tier-edit-row-actions">
          <button className="small-button" type="button" onClick={() => commit(moveMilestone(state, milestone.uid, -1))}>
            {e.moveUp}
          </button>
          <button className="small-button" type="button" onClick={() => commit(moveMilestone(state, milestone.uid, 1))}>
            {e.moveDown}
          </button>
          <button
            className="small-button button-danger"
            type="button"
            onClick={() => {
              if (window.confirm(fill(e.removeMilestoneConfirm, { milestone: title }))) {
                commit(removeMilestone(state, milestone.uid));
              }
            }}
          >
            <TrashIcon className="icon icon-sm" />
            {e.removeMilestone}
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor={`day-${milestone.uid}`}>{e.fieldDay}</label>
        <input
          id={`day-${milestone.uid}`}
          inputMode="numeric"
          value={milestone.day}
          onChange={(change) => commit(setMilestoneDay(state, milestone.uid, change.target.value))}
        />
        <p className="tier-small">{e.fieldDayHint}</p>
      </div>

      <TranslatedField
        label={e.fieldLabel}
        hint={e.fieldLabelHint}
        languages={languages}
        get={(locale) => milestone.label[locale]}
        set={(locale, value) => commit(setMilestoneLabel(state, milestone.uid, locale, value))}
      />

      <div className="age-edit-events">
        {milestone.events.map((event) => (
          <EventFields key={event.uid} ctx={ctx} event={event} />
        ))}
      </div>
      <button
        className="small-button"
        type="button"
        onClick={() => commit(addEvent(state, { kind: "milestone", uid: milestone.uid }).state)}
      >
        <PlusIcon className="icon icon-sm" />
        {e.addEvent}
      </button>
    </section>
  );
}

function ExportDialog({ ctx, problems, onClose }: { ctx: Ctx; problems: AgeUnlockProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const { e, tf, exported: result, state } = ctx;
  const json = useMemo(() => serializeAgeUnlocksData(result.data), [result]);
  const blocks = useMemo(() => {
    const all = eventTextBlocks(state);
    return Object.fromEntries(LOCALE_CODES.filter((code) => all[code] !== PUBLISHED_BLOCKS[code]).map((code) => [code, all[code]]));
  }, [state]);

  const copy = (key: string, value: string) =>
    navigator.clipboard?.writeText(value).then(() => setCopied(key), () => { /* clipboard blocked */ });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    download(url, "server-age-unlocks.json");
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
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(e, tf, problem)}</li>)}</ul>
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
                  <code>public/server-age-unlocks/{upload.file}</code>
                  <small>{upload.event}</small>
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
            {result.removedFiles.map((file) => (
              <li key={file}>
                <code>public/server-age-unlocks/{file}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/server-age-unlocks.json</code>
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
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/server-age-unlocks.json" />
      </div>

      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={6} />
    </dialog>
  );
}

export function ServerAgeUnlocksEditor() {
  const { t, tf } = useLocale();
  const e = t.ageUnlocksEditor;
  const { languages } = useEditorLanguages({ withDefault: true });

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED_AGE_UNLOCKS;
  const commit = (next: AgeUnlocksEditorState) => {
    try {
      draftStore.set(next);
    } catch {
      window.alert(e.storageFull);
    }
  };

  const [exportOpen, setExportOpen] = useState(false);
  const exported = useMemo(() => exportAgeUnlocks(state, AGE_UNLOCKS_DATA), [state]);
  const changes = useMemo(() => countAgeUnlockChanges(PUBLISHED_AGE_UNLOCKS, state), [state]);
  const problems = useMemo(() => findAgeUnlockProblems(state), [state]);
  const guideTitles = useMemo(
    () => Object.fromEntries(Object.entries(t.guideEntries).map(([key, guide]) => [key, guide.title])),
    [t.guideEntries],
  );
  const ctx: Ctx = { state, commit, e, tf, languages, guideTitles, exported };

  return (
    <div className="hero-tiers tier-editor age-unlocks-editor">
      <BackLink href="/guides/server-age-unlocks/" label={e.back} />
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
            disabled={!draft}
            onClick={() => {
              if (window.confirm(e.resetConfirm)) draftStore.clear();
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

      <div className="age-edit-section-head">
        <h2>{e.timelineHeading}</h2>
        <button className="small-button" type="button" onClick={() => commit(addMilestone(state).state)}>
          <PlusIcon className="icon icon-sm" />
          {e.addMilestone}
        </button>
      </div>

      <div className="age-edit-milestones">
        {state.milestones.map((milestone) => (
          <MilestoneBlock key={milestone.uid} ctx={ctx} milestone={milestone} />
        ))}
      </div>

      <div className="age-edit-section-head">
        <h2>{e.unconfirmedHeading}</h2>
        <button className="small-button" type="button" onClick={() => commit(addEvent(state, { kind: "unconfirmed" }).state)}>
          <PlusIcon className="icon icon-sm" />
          {e.addEvent}
        </button>
      </div>
      <div className="age-edit-events">
        {state.unconfirmed.map((event) => (
          <EventFields key={event.uid} ctx={ctx} event={event} />
        ))}
      </div>

      {exportOpen ? <ExportDialog ctx={ctx} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}
