"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import {
  COLLECTION_ICON_MAX_EDGE,
  COLLECTION_IMAGE_MAX_EDGE,
  PUBLISHED_COLLECTION,
  addItem,
  collectionTextBlocks,
  countCollectionChanges,
  exportCollection,
  exportIds,
  findCollectionProblems,
  itemByUid,
  moveItem,
  parseCollectionDraft,
  removeItem,
  removePicture,
  serializeCollectionData,
  setItemText,
  setPicture,
  setRarity,
  setSkillLevel,
  type CollectionEditorState,
  type CollectionExport,
  type CollectionPicture,
  type CollectionProblem,
  type EditorImage,
  type EditorItem,
} from "../../lib/content/collection-editor";
import { COLLECTION_DATA, COLLECTION_RARITIES, collectionImageUrl, type CollectionRarity } from "../../lib/content/collection";
import { DEFAULT_LOCALE, LOCALE_CODES, fill, type Dictionary, type Locale } from "../../lib/i18n";
import { COLLECTION_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, ChevronIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";

type EditorText = Dictionary["collectionEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const PUBLISHED = PUBLISHED_COLLECTION;
const PUBLISHED_ROWS = (() => {
  const exported = exportCollection(PUBLISHED, COLLECTION_DATA).data.items;
  return new Map(exported.map((row, index) => [row.id, JSON.stringify([row, PUBLISHED.items[index]])]));
})();
const PUBLISHED_BLOCKS = collectionTextBlocks(PUBLISHED);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const draftStore = createPersistentStore<CollectionEditorState | null>({
  key: COLLECTION_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseCollectionDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function pictureSrc(picture: EditorImage | null): string | null {
  if (!picture) return null;
  return picture.data ?? (picture.file ? collectionImageUrl(picture.file) : null);
}

/** Shrinks a picture to at most `maxEdge` on its long side and re-encodes it as WebP, keeping transparency. */
async function shrinkImage(file: File, maxEdge: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.9);
  // Older Safari cannot encode WebP and silently returns PNG instead.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

/** False only when the browser refuses the draft for size; storage that is off entirely keeps it in memory. */
function fitsStorage(next: CollectionEditorState): boolean {
  try {
    localStorage.setItem(COLLECTION_DRAFT_STORAGE_KEY, JSON.stringify(next));
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
  state: CollectionEditorState;
  commit: (next: CollectionEditorState) => void;
  e: EditorText;
  tf: Tf;
  /** The languages the fields are shown in; the first one is always English. */
  languages: Locale[];
};

export function CollectionEditor() {
  const { t, tf, locale } = useLocale();
  const e = t.collectionEditor;
  const guide = t.guideEntries.collection;
  const { languages } = useEditorLanguages({ withDefault: true });

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED;
  const commit = (next: CollectionEditorState) => draftStore.set(next);

  const [rarity, setFilter] = useState<CollectionRarity | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const ctx: Ctx = { state, commit, e, tf, languages };
  const exported = useMemo(() => exportCollection(state, COLLECTION_DATA), [state]);
  const changes = useMemo(() => countCollectionChanges(PUBLISHED, state), [state]);
  const problems = useMemo(() => findCollectionProblems(state), [state]);
  const ids = useMemo(() => exportIds(state), [state]);

  const nameOf = (item: EditorItem) => item.name[locale]?.trim() || item.name[DEFAULT_LOCALE].trim();
  const needle = query.trim().toLowerCase();
  const visible = state.items.filter(
    (item) => (rarity === "all" || item.rarity === rarity) && (!needle || LOCALE_CODES.some((code) => item.name[code].toLowerCase().includes(needle))),
  );
  const active = selected ? itemByUid(state, selected) : undefined;

  const statusOf = (item: EditorItem): "new" | "changed" | null => {
    const index = state.items.indexOf(item);
    const row = exported.data.items[index];
    const before = PUBLISHED_ROWS.get(row.id);
    if (!item.id || before === undefined) return "new";
    return before !== JSON.stringify([row, item]) ? "changed" : null;
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
    const result = addItem(state, rarity === "all" ? "SSR" : rarity);
    commit(result.state);
    setQuery("");
    select(result.uid);
  };

  return (
    <div className="hero-editor collection-editor">
      <BackLink href="/guides/collection/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar hero-edit-toolbar">
        <div className="hero-filters" role="group" aria-label={guide.filterLabel}>
          <button type="button" className="hero-filter" aria-pressed={rarity === "all"} onClick={() => setFilter("all")}>
            {guide.filterAll}
          </button>
          {COLLECTION_RARITIES.map((tier) => (
            <button key={tier} type="button" className="hero-filter" data-rarity={tier} aria-pressed={rarity === tier} onClick={() => setFilter(tier)}>
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
            {e.addItem}
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
              {visible.map((item) => {
                const status = statusOf(item);
                const src = pictureSrc(item.image);
                return (
                  <li key={item.uid}>
                    <button
                      type="button"
                      className={item.uid === active?.uid ? "hero-edit-row is-selected" : "hero-edit-row"}
                      aria-pressed={item.uid === active?.uid}
                      onClick={() => select(item.uid)}
                    >
                      <span className="collection-edit-thumb" data-rarity={item.rarity}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {src ? <img src={src} alt="" /> : null}
                      </span>
                      <span className="hero-edit-row-text">
                        <strong>{nameOf(item) || e.unnamed}</strong>
                        <span>
                          <span className="rarity" data-rarity={item.rarity}>{item.rarity}</span>
                          {fill(guide.skillLevel, { level: item.skillLevel || "?" })}
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
          <ItemForm
            ctx={ctx}
            item={active}
            exportedId={ids.get(active.uid) ?? ""}
            title={nameOf(active) || e.unnamed}
            onRemoved={() => setSelected(null)}
            onRarity={(next) => { if (rarity !== "all") setFilter(next); }}
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

function ItemForm({
  ctx,
  item,
  exportedId,
  title,
  onRemoved,
  onRarity,
}: {
  ctx: Ctx;
  item: EditorItem;
  exportedId: string;
  title: string;
  onRemoved: () => void;
  onRarity: (rarity: CollectionRarity) => void;
}) {
  const id = useId();
  const { state, commit, e, tf } = ctx;
  const sameRarity = state.items.filter((entry) => entry.rarity === item.rarity);
  const position = sameRarity.indexOf(item);

  const remove = () => {
    if (!window.confirm(tf(e.removeItemConfirm, { item: title }))) return;
    commit(removeItem(state, item.uid));
    onRemoved();
  };

  return (
    <section className="hero-edit-form" aria-labelledby={`${id}-title`} data-rarity={item.rarity}>
      <div className="tier-edit-form-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <div className="tier-edit-row-actions">
          <button type="button" className="icon-button hero-edit-up" aria-label={tf(e.moveUp, { rarity: item.rarity })} disabled={position <= 0} onClick={() => commit(moveItem(state, item.uid, -1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="icon-button hero-edit-down" aria-label={tf(e.moveDown, { rarity: item.rarity })} disabled={position >= sameRarity.length - 1} onClick={() => commit(moveItem(state, item.uid, 1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="small-button button-danger" onClick={remove}>
            <TrashIcon className="icon icon-sm" />
            {e.removeItem}
          </button>
        </div>
      </div>

      <div className="collection-edit-pictures">
        <PictureField ctx={ctx} item={item} picture="image" />
        <PictureField ctx={ctx} item={item} picture="icon" />
      </div>

      <div className="hero-edit-fields">
        <div className="hero-edit-wide">
          <TranslatedField
            label={e.fieldName}
            languages={ctx.languages}
            get={(language) => item.name[language] ?? ""}
            set={(language, value) => commit(setItemText(state, item.uid, "name", language, value))}
          />
          <p className="tier-small">
            {e.fieldId}: <code>{exportedId || "—"}</code>
            {item.id ? null : ` · ${e.idFromName}`}
          </p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-rarity`}>{e.fieldRarity}</label>
          <select
            id={`${id}-rarity`}
            value={item.rarity}
            onChange={(event) => {
              const next = event.target.value as CollectionRarity;
              commit(setRarity(state, item.uid, next));
              onRarity(next);
            }}
          >
            {COLLECTION_RARITIES.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-level`}>
            {e.fieldSkillLevel} <span className="label-note">{e.fieldSkillLevelNote}</span>
          </label>
          <input
            id={`${id}-level`}
            inputMode="numeric"
            value={item.skillLevel}
            onChange={(event) => commit(setSkillLevel(state, item.uid, event.target.value))}
          />
        </div>
        <div className="hero-edit-wide">
          <TranslatedField
            label={e.fieldSkillName}
            languages={ctx.languages}
            get={(language) => item.skillName[language] ?? ""}
            set={(language, value) => commit(setItemText(state, item.uid, "skillName", language, value))}
          />
        </div>
        <div className="hero-edit-wide">
          <TranslatedField
            label={e.fieldSkillText}
            note={e.fieldSkillTextNote}
            multiline
            rows={3}
            languages={ctx.languages}
            get={(language) => item.skillText[language] ?? ""}
            set={(language, value) => commit(setItemText(state, item.uid, "skillText", language, value))}
          />
        </div>
      </div>
    </section>
  );
}

function PictureField({ ctx, item, picture }: { ctx: Ctx; item: EditorItem; picture: CollectionPicture }) {
  const { e } = ctx;
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const current = item[picture];
  const src = pictureSrc(current);
  const maxEdge = picture === "image" ? COLLECTION_IMAGE_MAX_EDGE : COLLECTION_ICON_MAX_EDGE;

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
        data = await shrinkImage(file, maxEdge);
      } catch {
        setError(e.uploadNotImage);
        return;
      }
      // Read the store again: the draft may have changed while the picture was encoding.
      const next = setPicture(draftStore.getSnapshot() ?? PUBLISHED, item.uid, picture, data);
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
      className={dragging ? "hero-edit-images collection-edit-picture is-dragging" : "hero-edit-images collection-edit-picture"}
      data-picture={picture}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <legend>{picture === "image" ? e.pictureHeading : e.iconHeading}</legend>
      <div className="collection-edit-picture-row">
        <span className="collection-edit-preview" data-picture={picture} data-rarity={item.rarity}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="" /> : null}
          {current?.data ? <span className="hero-edit-badge is-new">{e.badgeNew}</span> : null}
        </span>
        <span className="collection-edit-picture-actions">
          <button type="button" className="hero-edit-drop" onClick={() => input.current?.click()} disabled={busy}>
            <UploadIcon className="icon" />
            <strong>{src ? e.replaceImage : e.uploadImage}</strong>
            <small>{e.dropHint}</small>
          </button>
          {current ? (
            <button type="button" className="small-button button-danger" onClick={() => ctx.commit(removePicture(ctx.state, item.uid, picture))}>
              <TrashIcon className="icon icon-sm" />
              {e.removeImage}
            </button>
          ) : null}
        </span>
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
      <p className="tier-small">{picture === "image" ? e.pictureHint : e.iconHint}</p>
      {error ? <p className="notice notice-warn" role="alert">{error}</p> : null}
    </fieldset>
  );
}

function problemText(e: EditorText, tf: Tf, problem: CollectionProblem): string {
  switch (problem.code) {
    case "emptyName": return tf(e.problemEmptyName, { rarity: problem.rarity });
    case "duplicateName": return tf(e.problemDuplicateName, { name: problem.name });
    case "missingImage": return tf(e.problemMissingImage, { item: problem.item });
    case "missingIcon": return tf(e.problemMissingIcon, { item: problem.item });
    case "emptySkill": return tf(e.problemEmptySkill, { item: problem.item });
    case "badLevel": return tf(e.problemBadLevel, { item: problem.item });
  }
}

function ExportDialog({ ctx, result, problems, onClose }: { ctx: Ctx; result: CollectionExport; problems: CollectionProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const { e, tf } = ctx;
  const json = useMemo(() => serializeCollectionData(result.data), [result]);
  // Only the dictionaries whose collectionTexts changed need a new block.
  const blocks = useMemo(() => {
    const all = collectionTextBlocks(ctx.state);
    return Object.fromEntries(LOCALE_CODES.filter((code) => all[code] !== PUBLISHED_BLOCKS[code]).map((code) => [code, all[code]]));
  }, [ctx.state]);

  const copy = () => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => { /* clipboard blocked */ });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    download(url, "collection.json");
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
                  <code>public/collection/{upload.file}</code>
                  <small>{upload.item}</small>
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
            {result.removedFiles.map((file) => <li key={file}><code>public/collection/{file}</code></li>)}
          </ul>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/collection.json</code>
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
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/collection.json" />
      </div>

      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={6} />
    </dialog>
  );
}
