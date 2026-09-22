"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import {
  GODDESS_MARKS,
  GODDESS_PORTRAIT_MAX_EDGE,
  PUBLISHED_GODDESSES,
  addGoddess,
  addImage,
  countGoddessDraftChanges,
  exportGoddesses,
  exportedGoddessTexts,
  findGoddessProblems,
  goddessByUid,
  goddessTextBlocks,
  goddessTextOf,
  makePortrait,
  moveGoddess,
  parseGoddessDraft,
  removeGoddess,
  removeImage,
  serializeGoddessData,
  setGoddessText,
  updateGoddess,
  type EditorGoddess,
  type EditorImage,
  type GoddessEditorState,
  type GoddessExport,
  type GoddessMark,
  type GoddessProblem,
} from "../../lib/content/goddess-editor";
import { GODDESS_DATA, GODDESS_RARITIES, goddessImageUrl, type GoddessRarity } from "../../lib/content/goddesses";
import { DEFAULT_LOCALE, LOCALE_CODES, fill, type Dictionary, type Locale } from "../../lib/i18n";
import { GODDESS_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, ChevronIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { HeroPortrait } from "../components/HeroPortrait";
import { counted } from "./HeroRoster";

type EditorText = Dictionary["goddessEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const PUBLISHED = PUBLISHED_GODDESSES;
const PUBLISHED_BY_ID = new Map(GODDESS_DATA.goddesses.map((goddess) => [goddess.id, JSON.stringify(goddess)]));
const PUBLISHED_TEXTS = exportedGoddessTexts(PUBLISHED_GODDESSES);
const PUBLISHED_BLOCKS = goddessTextBlocks(PUBLISHED_GODDESSES);
const TRANSLATIONS = LOCALE_CODES.filter((code) => code !== DEFAULT_LOCALE);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const draftStore = createPersistentStore<GoddessEditorState | null>({
  key: GODDESS_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseGoddessDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function imageSrc(image: EditorImage | undefined): string | null {
  if (!image) return null;
  return image.data ?? (image.file ? goddessImageUrl(image.file) : null);
}

/** Shrinks a picture to at most GODDESS_PORTRAIT_MAX_EDGE on its long side and re-encodes it as WebP. */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, GODDESS_PORTRAIT_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.88);
  // Older Safari cannot encode WebP and silently returns PNG instead.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

/** False only when the browser refuses the draft for size; storage that is off entirely keeps it in memory. */
function fitsStorage(next: GoddessEditorState): boolean {
  try {
    localStorage.setItem(GODDESS_DRAFT_STORAGE_KEY, JSON.stringify(next));
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
  state: GoddessEditorState;
  commit: (next: GoddessEditorState) => void;
  t: Dictionary;
  e: EditorText;
  tf: Tf;
  /** The languages the fields are shown in; the first one is always English. */
  languages: Locale[];
};

export function GoddessEditor() {
  const { t, tf } = useLocale();
  const e = t.goddessEditor;
  const guide = t.guideEntries.goddesses;
  // English is the wording in the roster JSON, so it is always shown.
  const { languages } = useEditorLanguages({ withDefault: true });

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED;
  const commit = (next: GoddessEditorState) => draftStore.set(next);

  const [rarity, setRarity] = useState<GoddessRarity | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const ctx: Ctx = { state, commit, t, e, tf, languages };

  const exported = useMemo(() => exportGoddesses(state, GODDESS_DATA), [state]);
  const changes = useMemo(() => countGoddessDraftChanges(PUBLISHED, state), [state]);
  const problems = useMemo(() => findGoddessProblems(state, GODDESS_DATA), [state]);
  const texts = useMemo(() => exportedGoddessTexts(state), [state]);
  const needle = query.trim().toLowerCase();
  const visible = state.goddesses.filter(
    (goddess) => (rarity === "all" || goddess.rarity === rarity) && (!needle || goddess.name.toLowerCase().includes(needle)),
  );
  const active = selected ? goddessByUid(state, selected) : undefined;

  const statusOf = (goddess: EditorGoddess): "new" | "changed" | null => {
    const row = exported.data.goddesses[state.goddesses.indexOf(goddess)];
    const before = PUBLISHED_BY_ID.get(row.id);
    if (!goddess.id || before === undefined) return "new";
    if (before !== JSON.stringify(row)) return "changed";
    const translated = TRANSLATIONS.some(
      (code) => JSON.stringify(PUBLISHED_TEXTS[code][row.id]) !== JSON.stringify(texts[code][row.id]),
    );
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
    const result = addGoddess(state, rarity === "all" ? "SSR" : rarity);
    commit(result.state);
    setQuery("");
    select(result.uid);
  };

  return (
    <div className="hero-editor">
      <BackLink href="/guides/goddesses/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar hero-edit-toolbar">
        <div className="hero-filters" role="group" aria-label={guide.filterLabel}>
          <button type="button" className="hero-filter" aria-pressed={rarity === "all"} onClick={() => setRarity("all")}>
            {guide.filterAll}
          </button>
          {GODDESS_RARITIES.map((tier) => (
            <button key={tier} type="button" className="hero-filter" data-rarity={tier} aria-pressed={rarity === tier} onClick={() => setRarity(tier)}>
              {tier}
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
            {e.addGoddess}
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
            <span className="visually-hidden">{guide.searchLabel}</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={e.searchPlaceholder} />
          </label>
          <p className="hero-count">{fill(guide.countLabel, { count: visible.length })}</p>
          {visible.length === 0 ? <p className="tier-small">{e.emptyList}</p> : (
            <ul className="hero-edit-list">
              {visible.map((goddess) => {
                const status = statusOf(goddess);
                return (
                  <li key={goddess.uid}>
                    <button
                      type="button"
                      className={goddess.uid === active?.uid ? "hero-edit-row is-selected" : "hero-edit-row"}
                      aria-pressed={goddess.uid === active?.uid}
                      onClick={() => select(goddess.uid)}
                    >
                      <HeroPortrait name={goddess.name || "?"} rarity={goddess.rarity} src={imageSrc(goddess.images[0])} className="hero-portrait-small" />
                      <span className="hero-edit-row-text">
                        <strong>{goddess.name.trim() || e.unnamed}</strong>
                        <span>
                          <span className="rarity" data-rarity={goddess.rarity}>{goddess.rarity}</span>
                          {counted(goddess.images.length, e.imageCountOne, e.imageCount)}
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
          <GoddessForm
            ctx={ctx}
            goddess={active}
            exportedId={exported.data.goddesses[state.goddesses.indexOf(active)]?.id ?? ""}
            onRemoved={() => setSelected(null)}
            onRarity={(next) => { if (rarity !== "all") setRarity(next); }}
          />
        ) : (
          <div className="hero-edit-empty">
            <p>{e.selectHint}</p>
          </div>
        )}
      </div>

      {exportOpen ? <ExportDialog ctx={ctx} result={exported} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}

function GoddessForm({
  ctx,
  goddess,
  exportedId,
  onRemoved,
  onRarity,
}: {
  ctx: Ctx;
  goddess: EditorGoddess;
  exportedId: string;
  onRemoved: () => void;
  onRarity: (rarity: GoddessRarity) => void;
}) {
  const id = useId();
  const { state, commit, e, tf } = ctx;
  const name = goddess.name.trim() || e.unnamed;
  const sameRarity = state.goddesses.filter((entry) => entry.rarity === goddess.rarity);
  const position = sameRarity.indexOf(goddess);

  const remove = () => {
    if (!window.confirm(tf(e.removeGoddessConfirm, { goddess: name }))) return;
    commit(removeGoddess(state, goddess.uid));
    onRemoved();
  };

  return (
    <section className="hero-edit-form" aria-labelledby={`${id}-title`} data-rarity={goddess.rarity}>
      <div className="tier-edit-form-head">
        <h2 id={`${id}-title`}>{name}</h2>
        <div className="tier-edit-row-actions">
          <button type="button" className="icon-button hero-edit-up" aria-label={tf(e.moveUp, { rarity: goddess.rarity })} disabled={position <= 0} onClick={() => commit(moveGoddess(state, goddess.uid, -1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="icon-button hero-edit-down" aria-label={tf(e.moveDown, { rarity: goddess.rarity })} disabled={position >= sameRarity.length - 1} onClick={() => commit(moveGoddess(state, goddess.uid, 1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="small-button button-danger" onClick={remove}>
            <TrashIcon className="icon icon-sm" />
            {e.removeGoddess}
          </button>
        </div>
      </div>

      <ImagesField ctx={ctx} goddess={goddess} />

      <div className="hero-edit-fields">
        <div className="field">
          <label htmlFor={`${id}-name`}>
            {e.fieldName} <span className="label-note">{e.fieldNameNote}</span>
          </label>
          <input id={`${id}-name`} value={goddess.name} onChange={(event) => commit(updateGoddess(state, goddess.uid, { name: event.target.value }))} />
          <p className="tier-small">
            {e.fieldId}: <code>{exportedId || "—"}</code>
            {goddess.id ? null : ` · ${e.idFromName}`}
          </p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-rarity`}>{e.fieldRarity}</label>
          <select
            id={`${id}-rarity`}
            value={goddess.rarity}
            onChange={(event) => {
              const next = event.target.value as GoddessRarity;
              commit(updateGoddess(state, goddess.uid, { rarity: next }));
              onRarity(next);
            }}
          >
            {GODDESS_RARITIES.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
          </select>
          <label className="tier-edit-check goddess-edit-check">
            <input
              type="checkbox"
              checked={goddess.skinRaisesToSsr}
              onChange={(event) => commit(updateGoddess(state, goddess.uid, { skinRaisesToSsr: event.target.checked }))}
            />
            {e.fieldSkinRaises}
          </label>
        </div>
        <fieldset className="hero-edit-wide goddess-edit-marks">
          <legend>{e.fieldMark}</legend>
          <div className="goddess-edit-mark-options">
            {GODDESS_MARKS.map((mark) => (
              <label key={mark} className="goddess-edit-mark" data-mark={mark}>
                <input
                  type="radio"
                  name={`${id}-mark`}
                  value={mark}
                  checked={goddess.mark === mark}
                  onChange={() => commit(updateGoddess(state, goddess.uid, { mark: mark as GoddessMark }))}
                />
                {e.marks[mark]}
              </label>
            ))}
          </div>
          <p className="tier-small">{e.fieldMarkNote}</p>
        </fieldset>
        <div className="hero-edit-wide">
          <TranslatedField
            label={e.fieldAffinity}
            note={e.fieldAffinityNote}
            multiline
            rows={2}
            fallback={goddess.affinity}
            languages={ctx.languages}
            get={(language) => goddessTextOf(state, language, goddess.uid).affinity}
            set={(language, value) => commit(setGoddessText(state, goddess.uid, language, "affinity", value))}
          />
        </div>
        <div className="hero-edit-wide">
          <TranslatedField
            label={e.fieldObtain}
            note={e.fieldObtainNote}
            fallback={goddess.obtain}
            languages={ctx.languages}
            get={(language) => goddessTextOf(state, language, goddess.uid).obtain}
            set={(language, value) => commit(setGoddessText(state, goddess.uid, language, "obtain", value))}
          />
        </div>
      </div>
    </section>
  );
}

function ImagesField({ ctx, goddess }: { ctx: Ctx; goddess: EditorGoddess }) {
  const { state, commit, e, tf } = ctx;
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) { setError(e.uploadNotImage); continue; }
        if (file.size > MAX_UPLOAD_BYTES) { setError(e.uploadTooBig); continue; }
        let data: string;
        try {
          data = await shrinkImage(file);
        } catch {
          setError(e.uploadNotImage);
          continue;
        }
        // Read the store again: an earlier file in this loop has already changed it.
        const next = addImage(draftStore.getSnapshot() ?? PUBLISHED, goddess.uid, data);
        if (!fitsStorage(next)) {
          setError(e.storageFull);
          return;
        }
        draftStore.set(next);
      }
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    void addFiles(event.dataTransfer.files);
  };

  return (
    <fieldset
      className={dragging ? "hero-edit-images is-dragging" : "hero-edit-images"}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <legend>{e.imagesHeading}</legend>
      <ul className="hero-edit-image-list">
        {goddess.images.map((image, index) => (
          <li key={image.uid} className="hero-edit-image">
            <HeroPortrait name={goddess.name || "?"} rarity={goddess.rarity} src={imageSrc(image)} className={index === 0 ? "hero-portrait-large" : undefined} />
            <span className="hero-edit-image-label">
              {index === 0 ? e.portrait : tf(e.skin, { number: index })}
              {image.data ? <span className="hero-edit-badge is-new">{e.badgeNew}</span> : null}
            </span>
            <span className="tier-edit-row-actions">
              {index > 0 ? (
                <button type="button" className="small-button" onClick={() => commit(makePortrait(state, goddess.uid, image.uid))}>{e.makePortrait}</button>
              ) : null}
              <button
                type="button"
                className="icon-button"
                aria-label={index === 0 ? e.removePortrait : tf(e.removeSkin, { number: index })}
                onClick={() => commit(removeImage(state, goddess.uid, image.uid))}
              >
                <TrashIcon className="icon icon-sm" />
              </button>
            </span>
          </li>
        ))}
        <li className="hero-edit-image">
          <button type="button" className="hero-edit-drop" onClick={() => input.current?.click()} disabled={busy}>
            <UploadIcon className="icon" />
            <strong>{goddess.images.length === 0 ? e.uploadPortrait : e.uploadSkin}</strong>
            <small>{e.dropHint}</small>
          </button>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            multiple
            hidden
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </li>
      </ul>
      <p className="tier-small">{e.imagesHint}</p>
      {error ? <p className="notice notice-warn" role="alert">{error}</p> : null}
    </fieldset>
  );
}

function problemText(e: EditorText, tf: Tf, problem: GoddessProblem): string {
  switch (problem.code) {
    case "emptyName": return tf(e.problemEmptyName, { rarity: problem.rarity });
    case "duplicateName": return tf(e.problemDuplicateName, { name: problem.name });
    case "stillUsed": return tf(e.problemStillUsed, { name: problem.name, where: problem.where.map((where) => e.where[where]).join(", ") });
    case "bannerImage": return tf(e.problemBannerImage, { file: problem.file });
  }
}

function ExportDialog({ ctx, result, problems, onClose }: { ctx: Ctx; result: GoddessExport; problems: GoddessProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const { e, tf } = ctx;
  const json = useMemo(() => serializeGoddessData(result.data), [result]);
  // Only the dictionaries whose goddessTexts changed need a new block.
  const blocks = useMemo(() => {
    const all = goddessTextBlocks(ctx.state);
    return Object.fromEntries(LOCALE_CODES.filter((code) => all[code] !== PUBLISHED_BLOCKS[code]).map((code) => [code, all[code]]));
  }, [ctx.state]);

  const copy = (key: string, value: string) =>
    navigator.clipboard?.writeText(value).then(() => setCopied(key), () => { /* clipboard blocked */ });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    download(url, "goddesses.json");
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
                  <code>public/goddesses/{upload.file}</code>
                  <small>{upload.goddess}</small>
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
            {result.removedFiles.map((file) => <li key={file}><code>public/goddesses/{file}</code></li>)}
          </ul>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/goddesses.json</code>
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
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/goddesses.json" />
      </div>

      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={6} />
    </dialog>
  );
}
