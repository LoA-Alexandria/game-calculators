"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import {
  CRYPTIDE_ICON_MAX_EDGE,
  CRYPTIDE_PORTRAIT_MAX_EDGE,
  CRYPTIDE_RARITIES,
  PUBLISHED_CRYPTIDES,
  addCryptide,
  addRow,
  changedTextLocales,
  countCryptideChanges,
  cryptideByUid,
  cryptideTextBlocks,
  exportCryptides,
  exportIds,
  findCryptideProblems,
  moveCryptide,
  moveRow,
  parseCryptidesDraft,
  removeCryptide,
  removeRow,
  serializeCryptidesData,
  setCryptideField,
  setCryptideName,
  setFoodGrowth,
  setFoodName,
  setPortrait,
  setRowImage,
  setSkillText,
  setTalent,
  type CryptideProblem,
  type CryptidesEditorState,
  type CryptidesExport,
  type EditorCryptide,
  type EditorImage,
  type EditorTalent,
  type RowKind,
} from "../../lib/content/cryptides-editor";
import { CRYPTIDES_DATA, CRYPTID_TOWERS, TALENT_MATERIALS, cryptideImageUrl } from "../../lib/content/cryptides";
import { DEFAULT_LOCALE, LOCALE_CODES, fill, type Dictionary, type Locale } from "../../lib/i18n";
import { CRYPTIDES_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, ChevronIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";

type EditorText = Dictionary["cryptidesEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const PUBLISHED = PUBLISHED_CRYPTIDES;
const PUBLISHED_KEYS = new Map(
  PUBLISHED.cryptides.map((cryptide) => [cryptide.id, JSON.stringify(stripUids(cryptide))]),
);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function stripUids(cryptide: EditorCryptide) {
  return { ...cryptide, uid: "", skills: cryptide.skills.map((row) => ({ ...row, uid: "" })), foods: cryptide.foods.map((row) => ({ ...row, uid: "" })) };
}

const draftStore = createPersistentStore<CryptidesEditorState | null>({
  key: CRYPTIDES_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseCryptidesDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function pictureSrc(picture: EditorImage | null): string | null {
  if (!picture) return null;
  return picture.data ?? (picture.file ? cryptideImageUrl(picture.file) : null);
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
function fitsStorage(next: CryptidesEditorState): boolean {
  try {
    localStorage.setItem(CRYPTIDES_DRAFT_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch (error) {
    return !(error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED"));
  }
}

function download(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  // Skill and food icons share numbers, so the folder stays in the name (the browser turns the slash into "_").
  link.download = name;
  link.click();
}

type Ctx = {
  state: CryptidesEditorState;
  commit: (next: CryptidesEditorState) => void;
  e: EditorText;
  tf: Tf;
  guide: Dictionary["guideEntries"]["cryptides"];
  /** The languages the fields are shown in; the first one is always English. */
  languages: Locale[];
};

export function CryptidesEditor() {
  const { t, tf, locale } = useLocale();
  const e = t.cryptidesEditor;
  const guide = t.guideEntries.cryptides;
  const { languages } = useEditorLanguages({ withDefault: true });

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED;
  const commit = (next: CryptidesEditorState) => draftStore.set(next);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const ctx: Ctx = { state, commit, e, tf, guide, languages };
  const exported = useMemo(() => exportCryptides(state, CRYPTIDES_DATA), [state]);
  const changes = useMemo(() => countCryptideChanges(PUBLISHED, state), [state]);
  const problems = useMemo(() => findCryptideProblems(state), [state]);
  const ids = useMemo(() => exportIds(state), [state]);

  const nameOf = (cryptide: EditorCryptide) => cryptide.name[locale]?.trim() || cryptide.name[DEFAULT_LOCALE].trim();
  const needle = query.trim().toLowerCase();
  const visible = state.cryptides.filter(
    (cryptide) => !needle || LOCALE_CODES.some((code) => cryptide.name[code].toLowerCase().includes(needle)),
  );
  const active = selected ? cryptideByUid(state, selected) : undefined;

  const statusOf = (cryptide: EditorCryptide): "new" | "changed" | null => {
    const before = cryptide.id ? PUBLISHED_KEYS.get(cryptide.id) : undefined;
    if (before === undefined) return "new";
    return before !== JSON.stringify(stripUids(cryptide)) ? "changed" : null;
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
    const result = addCryptide(state);
    commit(result.state);
    setQuery("");
    select(result.uid);
  };

  return (
    <div className="hero-editor collection-editor cryptides-editor">
      <BackLink href="/guides/cryptides/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar hero-edit-toolbar">
        <AllLanguagesToggle />
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0 ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={add}>
            <PlusIcon className="icon icon-sm" />
            {e.addCryptide}
          </button>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>
            {e.export}
            {problems.length > 0 ? <span className="tier-edit-count" aria-label={tf(e.problemCount, { count: problems.length })}>{problems.length}</span> : null}
          </button>
        </div>
      </div>

      <TalentFields ctx={ctx} />

      <div className="hero-edit-board">
        <div className="hero-edit-side">
          <label className="hero-search">
            <span className="visually-hidden">{guide.searchLabel}</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={e.searchPlaceholder} />
          </label>
          <p className="hero-count">{fill(guide.countLabel, { count: visible.length })}</p>
          {visible.length === 0 ? <p className="tier-small">{e.emptyList}</p> : (
            <ul className="hero-edit-list">
              {visible.map((cryptide) => {
                const status = statusOf(cryptide);
                const src = pictureSrc(cryptide.image);
                return (
                  <li key={cryptide.uid}>
                    <button
                      type="button"
                      className={cryptide.uid === active?.uid ? "hero-edit-row is-selected" : "hero-edit-row"}
                      aria-pressed={cryptide.uid === active?.uid}
                      onClick={() => select(cryptide.uid)}
                    >
                      <span className="collection-edit-thumb" data-rarity={cryptide.rarity}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {src ? <img src={src} alt="" /> : null}
                      </span>
                      <span className="hero-edit-row-text">
                        <strong>{nameOf(cryptide) || e.unnamed}</strong>
                        <span>
                          <span className="rarity" data-rarity={cryptide.rarity}>{cryptide.rarity}</span>
                          {fill(guide.towerLine, { tower: guide.towers[cryptide.tower], material: guide.talentMaterials[cryptide.talentMaterial] })}
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
          <CryptideForm
            ctx={ctx}
            cryptide={active}
            exportedId={ids.get(active.uid) ?? ""}
            ids={ids}
            title={nameOf(active) || e.unnamed}
            onRemoved={() => setSelected(null)}
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

function TalentFields({ ctx }: { ctx: Ctx }) {
  const id = useId();
  const { state, commit, e } = ctx;
  const fields: [keyof EditorTalent, string][] = [
    ["unlockCost", e.talentUnlock],
    ["dropAmount", e.talentDrop],
    ["dropEveryLevels", e.talentEvery],
  ];
  return (
    <section className="panel cryptide-edit-talent" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{e.talentHeading}</h2>
      <p className="tier-small">{e.talentLede}</p>
      <div className="cryptide-edit-talent-fields">
        {fields.map(([field, label]) => (
          <div className="field" key={field}>
            <label htmlFor={`${id}-${field}`}>{label}</label>
            <input
              id={`${id}-${field}`}
              inputMode="numeric"
              value={state.talent[field]}
              onChange={(event) => commit(setTalent(state, field, event.target.value))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function CryptideForm({
  ctx,
  cryptide,
  exportedId,
  ids,
  title,
  onRemoved,
}: {
  ctx: Ctx;
  cryptide: EditorCryptide;
  exportedId: string;
  ids: Map<string, string>;
  title: string;
  onRemoved: () => void;
}) {
  const id = useId();
  const { state, commit, e, tf, guide } = ctx;
  const position = state.cryptides.indexOf(cryptide);

  const remove = () => {
    if (!window.confirm(tf(e.removeConfirm, { cryptide: title }))) return;
    commit(removeCryptide(state, cryptide.uid));
    onRemoved();
  };

  return (
    <section className="hero-edit-form" aria-labelledby={`${id}-title`} data-rarity={cryptide.rarity}>
      <div className="tier-edit-form-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <div className="tier-edit-row-actions">
          <button type="button" className="icon-button hero-edit-up" aria-label={e.moveUp} disabled={position <= 0} onClick={() => commit(moveCryptide(state, cryptide.uid, -1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="icon-button hero-edit-down" aria-label={e.moveDown} disabled={position >= state.cryptides.length - 1} onClick={() => commit(moveCryptide(state, cryptide.uid, 1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="small-button button-danger" onClick={remove}>
            <TrashIcon className="icon icon-sm" />
            {e.removeCryptide}
          </button>
        </div>
      </div>

      <div className="collection-edit-pictures">
        <PictureField
          ctx={ctx}
          legend={e.portraitHeading}
          hint={e.portraitHint}
          current={cryptide.image}
          rarity={cryptide.rarity}
          maxEdge={CRYPTIDE_PORTRAIT_MAX_EDGE}
          apply={(base, image) => setPortrait(base, cryptide.uid, image)}
        />
      </div>

      <div className="hero-edit-fields">
        <div className="hero-edit-wide">
          <TranslatedField
            label={e.fieldName}
            languages={ctx.languages}
            get={(language) => cryptide.name[language] ?? ""}
            set={(language, value) => commit(setCryptideName(state, cryptide.uid, language, value))}
          />
          <p className="tier-small">
            {e.fieldId}: <code>{exportedId || "—"}</code>
            {cryptide.id ? null : ` · ${e.idFromName}`}
          </p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-rarity`}>{e.fieldRarity}</label>
          <select id={`${id}-rarity`} value={cryptide.rarity} onChange={(event) => commit(setCryptideField(state, cryptide.uid, "rarity", event.target.value))}>
            {[...new Set([...CRYPTIDE_RARITIES, cryptide.rarity])].map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-tower`}>{e.fieldTower}</label>
          <select id={`${id}-tower`} value={cryptide.tower} onChange={(event) => commit(setCryptideField(state, cryptide.uid, "tower", event.target.value))}>
            {CRYPTID_TOWERS.map((tower) => <option key={tower} value={tower}>{guide.towers[tower]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-material`}>{e.fieldMaterial}</label>
          <select id={`${id}-material`} value={cryptide.talentMaterial} onChange={(event) => commit(setCryptideField(state, cryptide.uid, "talentMaterial", event.target.value))}>
            {TALENT_MATERIALS.map((material) => <option key={material} value={material}>{guide.talentMaterials[material]}</option>)}
          </select>
        </div>
      </div>

      <RowList ctx={ctx} cryptide={cryptide} kind="skills" ids={ids} />
      <RowList ctx={ctx} cryptide={cryptide} kind="foods" ids={ids} />
    </section>
  );
}

/** The skills or the feed foods of one Cryptide: icon, name, and effect or growth, in order. */
function RowList({ ctx, cryptide, kind, ids }: { ctx: Ctx; cryptide: EditorCryptide; kind: RowKind; ids: Map<string, string> }) {
  const { state, commit, e, tf } = ctx;
  const rows = kind === "skills" ? cryptide.skills : cryptide.foods;
  return (
    <section className="cryptide-edit-rows" aria-label={kind === "skills" ? e.skillsHeading : e.foodsHeading}>
      <h3>{kind === "skills" ? e.skillsHeading : e.foodsHeading}</h3>
      {rows.map((row, index) => (
        <div className="section-block cryptide-edit-row" key={row.uid}>
          <div className="section-block-head">
            <span>
              {tf(kind === "skills" ? e.skillNumber : e.foodNumber, { n: index + 1 })} · <code>{ids.get(row.uid) ?? ""}</code>
            </span>
            <div className="text-guide-editor-moves">
              <button type="button" className="icon-button hero-edit-up" aria-label={e.moveUp} disabled={index === 0} onClick={() => commit(moveRow(state, cryptide.uid, kind, row.uid, -1))}>
                <ChevronIcon className="icon icon-sm" />
              </button>
              <button type="button" className="icon-button hero-edit-down" aria-label={e.moveDown} disabled={index === rows.length - 1} onClick={() => commit(moveRow(state, cryptide.uid, kind, row.uid, 1))}>
                <ChevronIcon className="icon icon-sm" />
              </button>
              <button type="button" className="small-button button-danger" onClick={() => commit(removeRow(state, cryptide.uid, kind, row.uid))}>
                <TrashIcon className="icon icon-sm" />
                {kind === "skills" ? e.removeSkill : e.removeFood}
              </button>
            </div>
          </div>
          <div className="cryptide-edit-row-body">
            <PictureField
              ctx={ctx}
              legend={e.iconHeading}
              hint={e.iconHint}
              current={row.image}
              rarity={cryptide.rarity}
              maxEdge={CRYPTIDE_ICON_MAX_EDGE}
              compact
              apply={(base, image) => setRowImage(base, cryptide.uid, kind, row.uid, image)}
            />
            <div className="cryptide-edit-row-fields">
              <TranslatedField
                label={kind === "skills" ? e.skillName : e.foodName}
                languages={ctx.languages}
                get={(language) => row.name[language] ?? ""}
                set={(language, value) =>
                  commit(
                    kind === "skills"
                      ? setSkillText(state, cryptide.uid, row.uid, "name", language, value)
                      : setFoodName(state, cryptide.uid, row.uid, language, value),
                  )
                }
              />
              {"body" in row ? (
                <TranslatedField
                  label={e.skillBody}
                  note={e.skillBodyNote}
                  multiline
                  rows={3}
                  languages={ctx.languages}
                  get={(language) => row.body[language] ?? ""}
                  set={(language, value) => commit(setSkillText(state, cryptide.uid, row.uid, "body", language, value))}
                />
              ) : (
                <GrowthField ctx={ctx} cryptideUid={cryptide.uid} rowUid={row.uid} value={row.growth} />
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="form-actions">
        <button type="button" className="button" onClick={() => commit(addRow(state, cryptide.uid, kind))}>
          <PlusIcon className="icon" />
          {kind === "skills" ? e.addSkill : e.addFood}
        </button>
      </div>
    </section>
  );
}

function GrowthField({ ctx, cryptideUid, rowUid, value }: { ctx: Ctx; cryptideUid: string; rowUid: string; value: string }) {
  const id = useId();
  const { state, commit, e } = ctx;
  return (
    <div className="field cryptide-edit-growth">
      <label htmlFor={id}>{e.foodGrowth}</label>
      <input id={id} inputMode="numeric" value={value} onChange={(event) => commit(setFoodGrowth(state, cryptideUid, rowUid, event.target.value))} />
    </div>
  );
}

function PictureField({
  ctx,
  legend,
  hint,
  current,
  rarity,
  maxEdge,
  compact = false,
  apply,
}: {
  ctx: Ctx;
  legend: string;
  hint: string;
  current: EditorImage | null;
  rarity: string;
  maxEdge: number;
  compact?: boolean;
  /** Puts the picture into a state; the draft is read again when the upload has finished encoding. */
  apply: (base: CryptidesEditorState, image: EditorImage | null) => CryptidesEditorState;
}) {
  const { e } = ctx;
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const src = pictureSrc(current);

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
      const next = apply(draftStore.getSnapshot() ?? PUBLISHED, { data });
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

  const classes = ["hero-edit-images", "collection-edit-picture", compact ? "is-compact" : "", dragging ? "is-dragging" : ""].filter(Boolean).join(" ");
  return (
    <fieldset
      className={classes}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <legend className={compact ? "visually-hidden" : undefined}>{legend}</legend>
      <div className="collection-edit-picture-row">
        <span className="collection-edit-preview" data-picture={compact ? "icon" : "image"} data-rarity={rarity}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="" /> : null}
          {current?.data ? <span className="hero-edit-badge is-new">{e.badgeNew}</span> : null}
        </span>
        <span className="collection-edit-picture-actions">
          <button type="button" className="hero-edit-drop" onClick={() => input.current?.click()} disabled={busy}>
            <UploadIcon className="icon" />
            <strong>{src ? e.replaceImage : e.uploadImage}</strong>
            {compact ? null : <small>{e.dropHint}</small>}
          </button>
          {current ? (
            <button type="button" className="small-button button-danger" onClick={() => ctx.commit(apply(ctx.state, null))}>
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
      {compact ? null : <p className="tier-small">{hint}</p>}
      {error ? <p className="notice notice-warn" role="alert">{error}</p> : null}
    </fieldset>
  );
}

function problemText(e: EditorText, tf: Tf, problem: CryptideProblem): string {
  switch (problem.code) {
    case "emptyName": return tf(e.problemEmptyName, { index: problem.index });
    case "duplicateName": return tf(e.problemDuplicateName, { name: problem.name });
    case "missingPortrait": return tf(e.problemMissingPortrait, { cryptide: problem.cryptide });
    case "missingIcon": return tf(e.problemMissingIcon, { cryptide: problem.cryptide, row: problem.row });
    case "emptySkill": return tf(e.problemEmptySkill, { cryptide: problem.cryptide, position: problem.position });
    case "emptyFood": return tf(e.problemEmptyFood, { cryptide: problem.cryptide, position: problem.position });
    case "badGrowth": return tf(e.problemBadGrowth, { cryptide: problem.cryptide, row: problem.row });
    case "badTalent": return e.problemBadTalent;
  }
}

function ExportDialog({ ctx, result, problems, onClose }: { ctx: Ctx; result: CryptidesExport; problems: CryptideProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const { e, tf } = ctx;
  const json = useMemo(() => serializeCryptidesData(result.data), [result]);
  // Only the dictionaries whose cryptideTexts changed need a new block.
  const blocks = useMemo(() => {
    const all = cryptideTextBlocks(ctx.state);
    return Object.fromEntries(changedTextLocales(ctx.state).map((code) => [code, all[code]]));
  }, [ctx.state]);

  const copy = () => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => { /* clipboard blocked */ });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    download(url, "cryptides.json");
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
                  <code>public/cryptides/{upload.file}</code>
                  <small>{upload.label}</small>
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
            {result.removedFiles.map((file) => <li key={file}><code>public/cryptides/{file}</code></li>)}
          </ul>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/cryptides.json</code>
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
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/cryptides.json" />
      </div>

      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={6} />
    </dialog>
  );
}
