"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import {
  PORTRAIT_MAX_EDGE,
  addAbilityLevel,
  addHero,
  addImage,
  clearAbility,
  countHeroChanges,
  countHeroTextChanges,
  exportHeroTexts,
  exportHeroes,
  findHeroProblems,
  fromHeroData,
  heroTextBlocks,
  publishedHeroTexts,
  setAbilityLevelText,
  setAbilityNameText,
  setArtifactText,
  setObtainText,
  heroByUid,
  makePortrait,
  moveHero,
  parseHeroDraft,
  removeAbilityLevel,
  removeHero,
  removeImage,
  serializeHeroData,
  setAbilityLevel,
  setAbilityName,
  setArtifact,
  updateHero,
  type EditorHero,
  type EditorImage,
  type HeroEditorState,
  type HeroExport,
  type HeroProblem,
} from "../../lib/content/hero-editor";
import { HERO_ABILITY_KINDS, HERO_DATA, HERO_RARITIES, heroImageUrl, type HeroAbilityKind, type HeroRarity } from "../../lib/content/heroes";
import { DEFAULT_LOCALE, fill, type Dictionary, type Locale } from "../../lib/i18n";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { HERO_DRAFT_STORAGE_KEY } from "../../lib/site";
import { CheckIcon, ChevronIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { HeroPortrait } from "../components/HeroPortrait";
import { counted } from "./HeroRoster";

type EditorText = Dictionary["heroEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const PUBLISHED_TEXTS = publishedHeroTexts();
const PUBLISHED = fromHeroData(HERO_DATA, PUBLISHED_TEXTS);
const PUBLISHED_BY_ID = new Map(HERO_DATA.heroes.map((hero) => [hero.id, JSON.stringify(hero)]));
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const draftStore = createPersistentStore<HeroEditorState | null>({
  key: HERO_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseHeroDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function imageSrc(image: EditorImage | undefined): string | null {
  if (!image) return null;
  return image.data ?? (image.file ? heroImageUrl(image.file) : null);
}

/** Shrinks a picture to at most PORTRAIT_MAX_EDGE on its long side and re-encodes it as WebP. */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PORTRAIT_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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
function fitsStorage(next: HeroEditorState): boolean {
  try {
    localStorage.setItem(HERO_DRAFT_STORAGE_KEY, JSON.stringify(next));
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
  state: HeroEditorState;
  commit: (next: HeroEditorState) => void;
  t: Dictionary;
  e: EditorText;
  tf: Tf;
  languages: readonly Locale[];
};

export function HeroEditor() {
  const { t, tf } = useLocale();
  const e = t.heroEditor;
  const guide = t.guideEntries.heroes;

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED;
  const commit = (next: HeroEditorState) => draftStore.set(next);
  // The data file holds English, so English stays next to the reader's language.
  const { languages } = useEditorLanguages({ withDefault: true });
  const ctx: Ctx = { state, commit, t, e, tf, languages };

  const [rarity, setRarity] = useState<HeroRarity | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const exported = useMemo(() => exportHeroes(state, HERO_DATA), [state]);
  const texts = useMemo(() => exportHeroTexts(state, exported.data), [state, exported]);
  const changes = useMemo(
    () => countHeroChanges(HERO_DATA, exported.data) + countHeroTextChanges(texts, PUBLISHED_TEXTS),
    [exported, texts],
  );
  const problems = useMemo(() => findHeroProblems(state, HERO_DATA), [state]);
  const needle = query.trim().toLowerCase();
  const visible = state.heroes.filter(
    (hero) => (rarity === "all" || hero.rarity === rarity) && (!needle || hero.name.toLowerCase().includes(needle)),
  );
  const active = selected ? heroByUid(state, selected) : undefined;

  const statusOf = (hero: EditorHero): "new" | "changed" | null => {
    const index = state.heroes.indexOf(hero);
    const row = exported.data.heroes[index];
    const before = PUBLISHED_BY_ID.get(row.id);
    if (!hero.id || before === undefined) return "new";
    const translated = Object.keys(texts).some((locale) => JSON.stringify(texts[locale as Locale][row.id]) !== JSON.stringify(PUBLISHED_TEXTS[locale as Locale][row.id]));
    return before === JSON.stringify(row) && !translated ? null : "changed";
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
    const result = addHero(state, rarity === "all" ? "SSR" : rarity);
    commit(result.state);
    setQuery("");
    select(result.uid);
  };

  return (
    <div className="hero-editor">
      <BackLink href="/guides/heroes/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar hero-edit-toolbar">
        <div className="hero-filters" role="group" aria-label={guide.filterLabel}>
          <button type="button" className="hero-filter" aria-pressed={rarity === "all"} onClick={() => setRarity("all")}>
            {guide.filterAll}
          </button>
          {HERO_RARITIES.map((tier) => (
            <button key={tier} type="button" className="hero-filter" data-rarity={tier} aria-pressed={rarity === tier} onClick={() => setRarity(tier)}>
              {tier}
            </button>
          ))}
        </div>
        <div className="tier-edit-actions">
          <AllLanguagesToggle />
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0 ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={add}>
            <PlusIcon className="icon icon-sm" />
            {e.addHero}
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
              {visible.map((hero) => {
                const status = statusOf(hero);
                return (
                  <li key={hero.uid}>
                    <button
                      type="button"
                      className={hero.uid === active?.uid ? "hero-edit-row is-selected" : "hero-edit-row"}
                      aria-pressed={hero.uid === active?.uid}
                      onClick={() => select(hero.uid)}
                    >
                      <HeroPortrait name={hero.name || "?"} rarity={hero.rarity} src={imageSrc(hero.images[0])} className="hero-portrait-small" />
                      <span className="hero-edit-row-text">
                        <strong>{hero.name.trim() || e.unnamed}</strong>
                        <span>
                          <span className="rarity" data-rarity={hero.rarity}>{hero.rarity}</span>
                          {counted(hero.images.length, e.imageCountOne, e.imageCount)}
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
          <HeroForm
            ctx={ctx}
            hero={active}
            exportedId={exported.data.heroes[state.heroes.indexOf(active)]?.id ?? ""}
            onRemoved={() => setSelected(null)}
            onRarity={(next) => { if (rarity !== "all") setRarity(next); }}
          />
        ) : (
          <div className="hero-edit-empty">
            <p>{e.selectHint}</p>
          </div>
        )}
      </div>

      {exportOpen ? <ExportDialog ctx={ctx} result={exported} texts={texts} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}

function HeroForm({
  ctx,
  hero,
  exportedId,
  onRemoved,
  onRarity,
}: {
  ctx: Ctx;
  hero: EditorHero;
  exportedId: string;
  onRemoved: () => void;
  onRarity: (rarity: HeroRarity) => void;
}) {
  const id = useId();
  const { state, commit, e, tf } = ctx;
  const name = hero.name.trim() || e.unnamed;
  const sameRarity = state.heroes.filter((entry) => entry.rarity === hero.rarity);
  const position = sameRarity.indexOf(hero);

  const remove = () => {
    if (!window.confirm(tf(e.removeHeroConfirm, { hero: name }))) return;
    commit(removeHero(state, hero.uid));
    onRemoved();
  };

  return (
    <section className="hero-edit-form" aria-labelledby={`${id}-title`} data-rarity={hero.rarity}>
      <div className="tier-edit-form-head">
        <h2 id={`${id}-title`}>{name}</h2>
        <div className="tier-edit-row-actions">
          <button type="button" className="icon-button hero-edit-up" aria-label={tf(e.moveHeroUp, { rarity: hero.rarity })} disabled={position <= 0} onClick={() => commit(moveHero(state, hero.uid, -1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="icon-button hero-edit-down" aria-label={tf(e.moveHeroDown, { rarity: hero.rarity })} disabled={position >= sameRarity.length - 1} onClick={() => commit(moveHero(state, hero.uid, 1))}>
            <ChevronIcon className="icon icon-sm" />
          </button>
          <button type="button" className="small-button button-danger" onClick={remove}>
            <TrashIcon className="icon icon-sm" />
            {e.removeHero}
          </button>
        </div>
      </div>

      <ImagesField ctx={ctx} hero={hero} />

      <div className="hero-edit-fields">
        <div className="field">
          <label htmlFor={`${id}-name`}>{e.fieldName}</label>
          <input id={`${id}-name`} value={hero.name} onChange={(event) => commit(updateHero(state, hero.uid, { name: event.target.value }))} />
          <p className="tier-small">
            {e.fieldId}: <code>{exportedId || "—"}</code>
            {hero.id ? null : ` · ${e.idFromName}`}
          </p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-rarity`}>{e.fieldRarity}</label>
          <select
            id={`${id}-rarity`}
            value={hero.rarity}
            onChange={(event) => {
              const next = event.target.value as HeroRarity;
              commit(updateHero(state, hero.uid, { rarity: next }));
              onRarity(next);
            }}
          >
            {HERO_RARITIES.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
          </select>
        </div>
        <div className="hero-edit-wide">
          <TranslatedField
            label={`${e.fieldObtain} · ${e.fieldObtainNote}`}
            languages={ctx.languages}
            get={(locale) => (locale === DEFAULT_LOCALE ? hero.obtain : hero.texts[locale]?.obtain ?? "")}
            set={(locale, value) =>
              commit(locale === DEFAULT_LOCALE ? updateHero(state, hero.uid, { obtain: value }) : setObtainText(state, hero.uid, locale, value))
            }
          />
        </div>
      </div>

      <p className="tier-small hero-edit-abilities-hint">{e.abilitiesHint}</p>
      {HERO_ABILITY_KINDS.map((kind) => (
        <AbilityField key={kind} ctx={ctx} hero={hero} kind={kind} />
      ))}

      <fieldset className="hero-edit-skills">
        <legend>{e.artifactHeading}</legend>
        {hero.artifact ? (
          <div className="hero-edit-skill">
            <TranslatedField
              label={e.artifactName}
              languages={ctx.languages}
              get={(locale) => (locale === DEFAULT_LOCALE ? hero.artifact?.name ?? "" : hero.texts[locale]?.artifact?.name ?? "")}
              set={(locale, value) =>
                commit(locale === DEFAULT_LOCALE
                  ? setArtifact(state, hero.uid, { name: value, text: hero.artifact?.text ?? "" })
                  : setArtifactText(state, hero.uid, locale, "name", value))
              }
            />
            <TranslatedField
              label={e.artifactText}
              multiline
              languages={ctx.languages}
              get={(locale) => (locale === DEFAULT_LOCALE ? hero.artifact?.text ?? "" : hero.texts[locale]?.artifact?.text ?? "")}
              set={(locale, value) =>
                commit(locale === DEFAULT_LOCALE
                  ? setArtifact(state, hero.uid, { name: hero.artifact?.name ?? "", text: value })
                  : setArtifactText(state, hero.uid, locale, "text", value))
              }
            />
            <div className="tier-edit-row-actions">
              <button type="button" className="small-button" onClick={() => commit(setArtifact(state, hero.uid, null))}>
                <TrashIcon className="icon icon-sm" />
                {e.removeArtifact}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="small-button" onClick={() => commit(setArtifact(state, hero.uid, { name: "", text: "" }))}>
            <PlusIcon className="icon icon-sm" />
            {e.addArtifact}
          </button>
        )}
      </fieldset>
    </section>
  );
}

function AbilityField({ ctx, hero, kind }: { ctx: Ctx; hero: EditorHero; kind: HeroAbilityKind }) {
  const { state, commit, e, tf, t } = ctx;
  const ability = hero.abilities[kind];
  const label = t.guideEntries.heroes.abilityKinds[kind];
  const filled = Boolean(ability.name.trim() || ability.levels.some((level) => level.trim()));

  return (
    <fieldset className="hero-edit-skills hero-edit-ability" data-kind={kind}>
      <legend>
        <span className="ability-kind">{label}</span>
      </legend>
      <TranslatedField
        label={e.abilityName}
        languages={ctx.languages}
        get={(locale) => (locale === DEFAULT_LOCALE ? ability.name : hero.texts[locale]?.[kind]?.name ?? "")}
        set={(locale, value) =>
          commit(locale === DEFAULT_LOCALE ? setAbilityName(state, hero.uid, kind, value) : setAbilityNameText(state, hero.uid, locale, kind, value))
        }
      />
      <ol className="hero-edit-levels">
        {ability.levels.map((text, index) => (
          <li key={index} className="hero-edit-skill">
            <TranslatedField
              label={tf(e.levelText, { level: index + 1 })}
              multiline
              rows={3}
              languages={ctx.languages}
              get={(locale) => (locale === DEFAULT_LOCALE ? text : hero.texts[locale]?.[kind]?.levels?.[index] ?? "")}
              set={(locale, value) =>
                commit(locale === DEFAULT_LOCALE
                  ? setAbilityLevel(state, hero.uid, kind, index, value)
                  : setAbilityLevelText(state, hero.uid, locale, kind, index, value))
              }
            />
            {ability.levels.length > 1 ? (
              <div className="tier-edit-row-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={tf(e.removeLevel, { level: index + 1 })}
                  onClick={() => commit(removeAbilityLevel(state, hero.uid, kind, index))}
                >
                  <TrashIcon className="icon icon-sm" />
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="tier-edit-row-actions">
        <button type="button" className="small-button" onClick={() => commit(addAbilityLevel(state, hero.uid, kind))}>
          <PlusIcon className="icon icon-sm" />
          {tf(e.addLevel, { level: ability.levels.length + 1 })}
        </button>
        {filled ? (
          <button type="button" className="small-button" onClick={() => commit(clearAbility(state, hero.uid, kind))}>
            <TrashIcon className="icon icon-sm" />
            {tf(e.clearAbility, { ability: label })}
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}

function ImagesField({ ctx, hero }: { ctx: Ctx; hero: EditorHero }) {
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
        const next = addImage(draftStore.getSnapshot() ?? PUBLISHED, hero.uid, data);
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
        {hero.images.map((image, index) => (
          <li key={image.uid} className="hero-edit-image">
            <HeroPortrait name={hero.name || "?"} rarity={hero.rarity} src={imageSrc(image)} className={index === 0 ? "hero-portrait-large" : undefined} />
            <span className="hero-edit-image-label">
              {index === 0 ? e.portrait : tf(e.skin, { number: index })}
              {image.data ? <span className="hero-edit-badge is-new">{e.badgeNew}</span> : null}
            </span>
            <span className="tier-edit-row-actions">
              {index > 0 ? (
                <button type="button" className="small-button" onClick={() => commit(makePortrait(state, hero.uid, image.uid))}>{e.makePortrait}</button>
              ) : null}
              <button
                type="button"
                className="icon-button"
                aria-label={index === 0 ? e.removePortrait : tf(e.removeSkin, { number: index })}
                onClick={() => commit(removeImage(state, hero.uid, image.uid))}
              >
                <TrashIcon className="icon icon-sm" />
              </button>
            </span>
          </li>
        ))}
        <li className="hero-edit-image">
          <button type="button" className="hero-edit-drop" onClick={() => input.current?.click()} disabled={busy}>
            <UploadIcon className="icon" />
            <strong>{hero.images.length === 0 ? e.uploadPortrait : e.uploadSkin}</strong>
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

function problemText(e: EditorText, tf: Tf, kinds: Record<HeroAbilityKind, string>, problem: HeroProblem): string {
  switch (problem.code) {
    case "emptyName": return tf(e.problemEmptyName, { rarity: problem.rarity });
    case "duplicateName": return tf(e.problemDuplicateName, { name: problem.name });
    case "incompleteAbility": return tf(e.problemIncompleteAbility, { hero: problem.hero, ability: kinds[problem.kind] });
    case "emptyArtifact": return tf(e.problemEmptyArtifact, { hero: problem.hero });
    case "stillUsed": return tf(e.problemStillUsed, { name: problem.name, where: problem.where.map((where) => e.where[where]).join(", ") });
  }
}

function ExportDialog({
  ctx,
  result,
  texts,
  problems,
  onClose,
}: {
  ctx: Ctx;
  result: HeroExport;
  texts: ReturnType<typeof exportHeroTexts>;
  problems: HeroProblem[];
  onClose: () => void;
}) {
  const textBlocks = useMemo(() => heroTextBlocks(texts, PUBLISHED_TEXTS), [texts]);
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const { e, tf } = ctx;
  const json = useMemo(() => serializeHeroData(result.data), [result]);

  const copy = () =>
    navigator.clipboard?.writeText(json).then(() => setCopied(true), () => { /* clipboard blocked */ });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    download(url, "heroes.json");
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
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(e, tf, ctx.t.guideEntries.heroes.abilityKinds, problem)}</li>)}</ul>
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
                  <code>public/heroes/{upload.file}</code>
                  <small>{upload.hero}</small>
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
            {result.removedFiles.map((file) => <li key={file}><code>public/heroes/{file}</code></li>)}
          </ul>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/heroes.json</code>
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
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/heroes.json" />
      </div>
      <DictionaryBlocks blocks={textBlocks} title={ctx.t.editorLanguages.exportBlocks} lede={ctx.t.editorLanguages.exportBlocksLede} rows={6} />
    </dialog>
  );
}
