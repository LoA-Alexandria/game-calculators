"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import { GODDESS_RARITIES, goddessNamed, goddessPortrait } from "../../lib/content/goddesses";
import { theaterCoverUrl } from "../../lib/content/goddess-theater";
import {
  COVER_MAX_EDGE,
  addPlay,
  addRole,
  countTheaterChanges,
  exportTheater,
  findProblems,
  parseDraft,
  playByUid,
  removeCover,
  removePlay,
  removeRole,
  serializeTheaterData,
  setCover,
  setTutorial,
  unusedGoddesses,
  updateRole,
  movePlay,
  playTextOf,
  setPlayName,
  setRoleName,
  textBlocks,
  type EditorPlay,
  type TheaterEditorState,
  type TheaterProblem,
  PUBLISHED_THEATER,
} from "../../lib/content/goddess-theater-editor";
import { THEATER_DATA } from "../../lib/content/goddess-theater";
import { DEFAULT_LOCALE, LOCALES, type Dictionary, type Locale } from "../../lib/i18n";
import { THEATER_DRAFT_STORAGE_KEY } from "../../lib/site";
import { HeroPortrait } from "../components/HeroPortrait";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, TrashIcon, UploadIcon } from "../components/Icons";

type EditorText = Dictionary["theaterEditor"];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const draftStore = createPersistentStore<TheaterEditorState | null>({
  key: THEATER_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function coverSrc(play: EditorPlay): string | null {
  if (play.cover?.data) return play.cover.data;
  if (play.cover?.file) return theaterCoverUrl(play.cover.file);
  return null;
}

async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, COVER_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.88);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

function fitsStorage(next: TheaterEditorState): boolean {
  try {
    localStorage.setItem(THEATER_DRAFT_STORAGE_KEY, JSON.stringify(next));
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
  state: TheaterEditorState;
  commit: (next: TheaterEditorState) => void;
  e: EditorText;
  tf: (template: string, values: Record<string, string | number>) => string;
  language: Locale;
  languages: readonly Locale[];
};

export function GoddessTheaterEditor() {
  const { t, tf } = useLocale();
  const e = t.theaterEditor;
  // Play and role names in the JSON are English, so English is always shown next to the reader's language.
  const { language, languages } = useEditorLanguages({ withDefault: true });

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED_THEATER;
  const commit = (next: TheaterEditorState) => draftStore.set(next);
  const ctx: Ctx = { state, commit, e, tf, language, languages };

  const [playUid, setPlayUid] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  const changes = useMemo(() => countTheaterChanges(PUBLISHED_THEATER, state), [state]);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? state.plays.filter((play) => {
        const names = LOCALES.flatMap((entry) => {
          const text = playTextOf(state, entry.code, play.uid);
          return [text.name, ...Object.values(text.roles)];
        });
        const hay = [play.name, ...play.roles.flatMap((row) => [row.goddess, row.role]), ...names].join(" ").toLowerCase();
        return hay.includes(needle);
      })
    : state.plays;
  const active = playUid ? playByUid(state, playUid) : undefined;

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
    setPlayUid(null);
  };

  const add = () => {
    const result = addPlay(state);
    commit(result.state);
    setPlayUid(result.uid);
  };

  return (
    <div className="hero-tiers tier-editor artwork-layout-editor artwork-layouts">
      <BackLink href="/guides/goddess-theater/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <label className="hero-search">
          <span className="visually-hidden">{e.searchLabel}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={e.searchPlaceholder} />
        </label>
        <AllLanguagesToggle />
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0 ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={add}>{e.addPlay}</button>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>{e.export}</button>
        </div>
      </div>

      <div className="layout-edit-board artwork-cat-board">
        <ul className="artwork-cat-sets">
          {visible.map((play) => (
            <li key={play.uid}>
              <button
                type="button"
                className={play.uid === active?.uid ? "artwork-cat-set is-selected" : "artwork-cat-set"}
                aria-pressed={play.uid === active?.uid}
                onClick={() => setPlayUid(play.uid)}
              >
                <strong>{playTextOf(state, language, play.uid).name.trim() || play.name.trim() || e.unnamedPlay}</strong>
                <span>
                  {play.unlock === "tutorial"
                    ? e.tutorialShort
                    : tf(e.roleCount, { count: play.roles.length })}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {visible.length === 0 ? <p className="tier-small">{e.emptyList}</p> : null}

        {active ? (
          <PlayForm ctx={ctx} play={active} onRemoved={() => setPlayUid(null)} />
        ) : (
          <p className="tier-small">{e.selectHint}</p>
        )}
      </div>

      {exportOpen ? <ExportDialog ctx={ctx} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}

function LanguageFields({
  ctx,
  label,
  get,
  set,
  english,
}: {
  ctx: Ctx;
  label: string;
  get: (language: Locale) => string;
  set: (language: Locale, value: string) => void;
  english: string;
}) {
  return <TranslatedField label={label} languages={ctx.languages} get={get} set={set} fallback={english} />;
}

function PlayForm({ ctx, play, onRemoved }: { ctx: Ctx; play: EditorPlay; onRemoved: () => void }) {
  const id = useId();
  const { state, commit, e, tf } = ctx;
  const cover = coverSrc(play);
  const available = unusedGoddesses(play);
  const index = state.plays.findIndex((entry) => entry.uid === play.uid);

  const englishName = playTextOf(state, DEFAULT_LOCALE, play.uid).name.trim() || play.name.trim();
  const remove = () => {
    if (!window.confirm(tf(e.removePlayConfirm, { play: englishName || e.unnamedPlay }))) return;
    commit(removePlay(state, play.uid));
    onRemoved();
  };

  return (
    <div className="layout-edit-newbuild artwork-cat-form">
      <div className="tier-edit-form-head">
        <h2>{e.inspectorPlay}</h2>
        <button type="button" className="small-button button-danger" onClick={remove} disabled={state.plays.length <= 1}>
          <TrashIcon className="icon icon-sm" />
          {e.removePlay}
        </button>
      </div>
      <LanguageFields
        ctx={ctx}
        label={e.fieldName}
        english={englishName}
        get={(language) => playTextOf(state, language, play.uid).name}
        set={(language, value) => commit(setPlayName(state, play.uid, language, value))}
      />
      <div className="field">
        <label htmlFor={`${id}-rank`}>{e.fieldRank}</label>
        <select
          id={`${id}-rank`}
          value={index}
          onChange={(event) => commit(movePlay(state, play.uid, Number(event.target.value)))}
        >
          {state.plays.map((_, rank) => <option key={rank} value={rank}>{rank + 1}</option>)}
        </select>
      </div>
      <label className="tier-edit-role">
        <input
          type="checkbox"
          checked={play.unlock === "tutorial"}
          onChange={(event) => commit(setTutorial(state, play.uid, event.target.checked))}
        />
        {e.fieldTutorial}
      </label>

      <CoverField ctx={ctx} play={play} src={cover} />

      {play.unlock === "tutorial" ? (
        <p className="tier-small">{e.tutorialNote}</p>
      ) : (
        <>
          <h3>{e.rolesHeading}</h3>
          {play.roles.length === 0 ? <p className="tier-small">{e.noRoles}</p> : (
            <ul className="theater-edit-roles">
              {play.roles.map((row) => (
                <li key={row.uid} className="theater-edit-role">
                  <div className="field">
                    <span className="guide-name">
                      <HeroPortrait name={row.goddess} rarity={goddessNamed(row.goddess)?.rarity} src={goddessPortrait(row.goddess)} className="hero-portrait-small" />
                      {row.goddess}
                    </span>
                  </div>
                  <LanguageFields
                    ctx={ctx}
                    label={e.fieldRole}
                    english={playTextOf(state, DEFAULT_LOCALE, play.uid).roles[row.goddess] || row.role}
                    get={(language) => playTextOf(state, language, play.uid).roles[row.goddess] ?? ""}
                    set={(language, value) => commit(setRoleName(state, play.uid, row.goddess, language, value))}
                  />
                  <label className="tier-edit-role">
                    <input
                      type="checkbox"
                      checked={row.relevant}
                      onChange={(event) => commit(updateRole(state, play.uid, row.uid, { relevant: event.target.checked }))}
                    />
                    {e.fieldRelevant}
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={tf(e.removeRoleNamed, { goddess: row.goddess })}
                    onClick={() => commit(removeRole(state, play.uid, row.uid))}
                  >
                    <CloseIcon className="icon icon-sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {available.length === 0 ? <p className="tier-small">{e.allGoddessesUsed}</p> : (
            <div className="field">
              <label htmlFor={`${id}-goddess`}>{e.addGoddess}</label>
              <select
                id={`${id}-goddess`}
                value=""
                onChange={(event) => {
                  if (event.target.value) commit(addRole(state, play.uid, event.target.value));
                }}
              >
                <option value="">{e.addGoddessPlaceholder}</option>
                {GODDESS_RARITIES.map((tier) => {
                  const goddesses = available.filter((goddess) => goddess.rarity === tier);
                  if (goddesses.length === 0) return null;
                  return (
                    <optgroup key={tier} label={tier}>
                      {goddesses.map((goddess) => (
                        <option key={goddess.id} value={goddess.name}>{goddess.name}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CoverField({ ctx, play, src }: { ctx: Ctx; play: EditorPlay; src: string | null }) {
  const { e } = ctx;
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

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
      const next = setCover(draftStore.getSnapshot() ?? PUBLISHED_THEATER, play.uid, data);
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
      <legend>{e.coverHeading}</legend>
      <div className="theater-edit-cover">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" width={96} height={108} />
        ) : null}
        <button type="button" className="hero-edit-drop" onClick={() => input.current?.click()} disabled={busy}>
          <UploadIcon className="icon" />
          <strong>{src ? e.replaceCover : e.uploadCover}</strong>
          <small>{e.dropHint}</small>
        </button>
        {play.cover ? (
          <button type="button" className="small-button button-danger" onClick={() => ctx.commit(removeCover(ctx.state, play.uid))}>
            <TrashIcon className="icon icon-sm" />
            {e.removeCover}
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
      <p className="tier-small">{e.coverHint}</p>
      {error ? <p className="notice notice-warn" role="alert">{error}</p> : null}
    </fieldset>
  );
}

function problemText(ctx: Ctx, problem: TheaterProblem): string {
  switch (problem.code) {
    case "emptyPlayName": return ctx.tf(ctx.e.problemEmptyPlayName, { play: problem.id });
    case "duplicatePlay": return ctx.tf(ctx.e.problemDuplicatePlay, { play: problem.id });
    case "duplicateName": return ctx.tf(ctx.e.problemDuplicateName, { name: problem.name });
    case "emptyRole": return ctx.tf(ctx.e.problemEmptyRole, { play: problem.play, goddess: problem.goddess });
    case "unknownGoddess": return ctx.tf(ctx.e.problemUnknownGoddess, { play: problem.play, goddess: problem.goddess });
    case "duplicateGoddess": return ctx.tf(ctx.e.problemDuplicateGoddess, { play: problem.play, goddess: problem.goddess });
    case "noRoles": return ctx.tf(ctx.e.problemNoRoles, { play: problem.play });
    case "missingCover": return ctx.tf(ctx.e.problemMissingCover, { play: problem.play });
  }
}

function ExportDialog({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const result = useMemo(() => exportTheater(ctx.state, THEATER_DATA), [ctx.state]);
  const json = useMemo(() => serializeTheaterData(result.data), [result]);
  const blocks = useMemo(() => textBlocks(ctx.state), [ctx.state]);
  const problems = useMemo(() => findProblems(ctx.state), [ctx.state]);
  const { e, tf } = ctx;

  const copy = (key: string, value: string) =>
    navigator.clipboard?.writeText(value).then(() => setCopied(key), () => { /* clipboard blocked */ });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    download(url, "goddess-theater.json");
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
                  <code>public/goddess-theater/{upload.file}</code>
                  <small>{upload.play}</small>
                </span>
                <button className="small-button" type="button" onClick={() => download(upload.data, upload.file)}>
                  {e.download}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.removedFiles.length > 0 ? (
        <div className="tier-export-block">
          <strong>{tf(e.removedHeading, { count: result.removedFiles.length })}</strong>
          <ul>{result.removedFiles.map((file) => <li key={file}><code>public/goddess-theater/{file}</code></li>)}</ul>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/goddess-theater.json</code>
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
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/goddess-theater.json" />
      </div>

      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={6} />
    </dialog>
  );
}
