"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  PUBLISHED_SKINS,
  addSkin,
  countSkinChanges,
  exportSkins,
  exportedSkinTexts,
  findSkinProblems,
  fromSkinsData,
  parseSkinsDraft,
  removeSkin,
  serializeSkinsData,
  untranslatedSkins,
  setSkinText,
  skinGroups,
  skinOwners,
  skinText,
  textBlocks,
  updateSkin,
  type EditorSkin,
  type SkinProblem,
  type SkinRoster,
  type SkinsEditorState,
} from "../../lib/content/skins-editor";
import { type SkinData, type SkinTexts } from "../../lib/content/skins";
import { GODDESS_SKINS_DRAFT_STORAGE_KEY, HERO_SKINS_DRAFT_STORAGE_KEY } from "../../lib/site";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary, type Dictionary, type Locale } from "../../lib/i18n";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { goddessImageUrl, goddessNamed } from "../../lib/content/goddesses";
import { heroNamed, heroPortrait } from "../../lib/content/heroes";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { SaveToSite } from "./SaveToSite";
import { useGuideData, usePublishedTexts } from "./GuideOverrides";

type EditorText = Dictionary["skinsEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

/** Everything a roster differs in: its file, its guide, its drafts, its faces. */
const ROSTERS = {
  hero: {
    file: "hero-skins",
    guide: "heroes" as const,
    key: HERO_SKINS_DRAFT_STORAGE_KEY,
    back: "/guides/heroes/",
  },
  goddess: {
    file: "goddess-skins",
    guide: "goddesses" as const,
    key: GODDESS_SKINS_DRAFT_STORAGE_KEY,
    back: "/guides/goddesses/",
  },
} as const;

const stores = {
  hero: createPersistentStore<SkinsEditorState | null>({
    key: ROSTERS.hero.key,
    serverValue: null,
    parse: (raw) => parseSkinsDraft(raw, "hero"),
    fallback: () => null,
    serialize: (value) => JSON.stringify(value),
  }),
  goddess: createPersistentStore<SkinsEditorState | null>({
    key: ROSTERS.goddess.key,
    serverValue: null,
    parse: (raw) => parseSkinsDraft(raw, "goddess"),
    fallback: () => null,
    serialize: (value) => JSON.stringify(value),
  }),
};

const publishedBlocks = {
  hero: textBlocks(PUBLISHED_SKINS.hero),
  goddess: textBlocks(PUBLISHED_SKINS.goddess),
};

type Ctx = {
  roster: SkinRoster;
  state: SkinsEditorState;
  commit: (next: SkinsEditorState) => void;
  e: EditorText;
  tf: Tf;
  languages: Locale[];
};

function problemText(e: EditorText, tf: Tf, problem: SkinProblem): string {
  if (problem.code === "noName") return tf(e.problemNoName, { owner: problem.owner });
  if (problem.code === "unknownOwner") return tf(e.problemUnknownOwner, { owner: problem.owner });
  if (problem.code === "unknownGroup") return tf(e.problemUnknownGroup, { owner: problem.owner, group: problem.group });
  return tf(e.problemDuplicateId, { id: problem.id });
}

/** The group titles a roster's guide already carries, so the editor adds none. */
function groupLabels(roster: SkinRoster, locale: Locale): Record<string, string> {
  const entry = getDictionary(locale).guideEntries[ROSTERS[roster].guide];
  const groups = entry.skinGroups as Record<string, { title: string; lede: string }>;
  return Object.fromEntries(Object.entries(groups).map(([id, group]) => [id, group.title]));
}

/** The owner's portrait, from whichever roster the skin belongs to. */
function portraitOf(roster: SkinRoster, owner: string): { src: string | null; rarity?: string } {
  if (roster === "hero") {
    const hero = heroNamed(owner);
    return { src: heroPortrait(owner), rarity: hero?.rarity };
  }
  const goddess = goddessNamed(owner);
  return {
    src: goddess?.images[0] ? goddessImageUrl(goddess.images[0]) : null,
    rarity: goddess?.rarity,
  };
}

function SkinRow({ ctx, skin, index }: { ctx: Ctx; skin: EditorSkin; index: number }) {
  const { roster, state, commit, e, tf, languages } = ctx;
  const { locale } = useLocale();
  const ids = useId();
  const owners = useMemo(() => skinOwners(roster), [roster]);
  const labels = groupLabels(roster, locale as Locale);
  const english = skinText(state, DEFAULT_LOCALE, skin.uid).name;
  const face = portraitOf(roster, skin.owner);

  return (
    <li className="panel skin-edit-row" id={`skin-${skin.uid}`}>
      <div className="skin-edit-head">
        <span className="skin-edit-number" aria-hidden="true">{index + 1}</span>
        <HeroPortrait name={skin.owner} src={face.src} className="hero-portrait-small" />
        <strong>{english || e.empty}</strong>
        <button
          type="button"
          className="small-button button-danger"
          onClick={() => commit(removeSkin(state, skin.uid))}
        >
          <TrashIcon className="icon icon-sm" />
          {tf(e.remove, { skin: english || skin.owner })}
        </button>
      </div>

      <div className="skin-edit-fields">
        <div className="field">
          <label htmlFor={`${ids}-owner`}>{e.fieldOwner}</label>
          <input
            id={`${ids}-owner`}
            list={`${ids}-owners`}
            value={skin.owner}
            onChange={(event) => commit(updateSkin(state, skin.uid, { owner: event.target.value }))}
          />
          <datalist id={`${ids}-owners`}>
            {owners.map((name) => <option key={name} value={name} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor={`${ids}-group`}>{e.fieldGroup}</label>
          <select
            id={`${ids}-group`}
            value={skin.group}
            onChange={(event) => commit(updateSkin(state, skin.uid, { group: event.target.value }))}
          >
            {skinGroups(roster).map((group) => (
              <option key={group} value={group}>{labels[group] ?? group}</option>
            ))}
          </select>
        </div>
        <label className="tier-edit-check">
          <input
            type="checkbox"
            checked={skin.missable}
            onChange={(event) => commit(updateSkin(state, skin.uid, { missable: event.target.checked }))}
          />
          {e.fieldMissable}
        </label>
        <label className="tier-edit-check">
          <input
            type="checkbox"
            checked={skin.unconfirmed}
            onChange={(event) => commit(updateSkin(state, skin.uid, { unconfirmed: event.target.checked }))}
          />
          {e.fieldUnconfirmed}
        </label>
      </div>

      <TranslatedField
        label={e.fieldName}
        languages={languages}
        get={(code) => skinText(state, code, skin.uid).name}
        set={(code, value) => commit(setSkinText(state, code, skin.uid, { name: value }))}
      />
      <TranslatedField
        label={e.fieldObtain}
        note={e.obtainHint}
        multiline
        languages={languages}
        get={(code) => skinText(state, code, skin.uid).obtain}
        set={(code, value) => commit(setSkinText(state, code, skin.uid, { obtain: value }))}
      />
    </li>
  );
}

function ExportDialog({ ctx, problems, onClose }: { ctx: Ctx; problems: SkinProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const { roster, state, e, tf } = ctx;
  const file = `lib/data/${ROSTERS[roster].file}.json`;
  const json = useMemo(() => serializeSkinsData(exportSkins(state)), [state]);
  const untranslated = useMemo(() => untranslatedSkins(state), [state]);
  // Only the dictionaries whose wording changed need a new block.
  const blocks = useMemo(() => {
    const all = textBlocks(state);
    const published = publishedBlocks[roster];
    return Object.fromEntries(
      LOCALE_CODES.filter((code) => all[code] !== published[code]).map((code) => [code, all[code]]),
    );
  }, [state, roster]);

  const copy = () => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => { /* clipboard blocked */ });
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ROSTERS[roster].file}.json`;
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
        <h2 id={`${id}-title`}>{e.exportTitle}</h2>
        <button type="button" className="icon-button" aria-label={e.close} onClick={() => dialog.current?.close()}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>
      <p className="tier-small">{tf(e.exportLede, { file, guide: ROSTERS[roster].guide })}</p>
      {problems.length > 0 ? (
        <div className="notice notice-warn tier-export-problems" role="alert">
          <div>
            <strong>{e.problemsTitle}</strong>
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(e, tf, problem)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>{file}</code>
          <div className="tier-edit-row-actions">
            <button className="small-button" type="button" onClick={() => void copy()}>
              {copied ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied ? e.copied : e.copy}
            </button>
            <button className="small-button" type="button" onClick={download}>
              <DownloadIcon className="icon icon-sm" />
              {e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label={file} />
      </div>

      {untranslated.length > 0 ? (
        <p className="tier-small">
          {untranslated.map((row) => tf(e.untranslated, { count: row.count, language: row.language })).join(" · ")}
        </p>
      ) : null}

      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={6} />
    </dialog>
  );
}

/**
 * One roster's skins.
 *
 * The rows are game data and go to the data file; the names and obtain lines
 * are words and go to `skinTexts` in each dictionary, English excepted — the
 * file carries that, and a second place to change it is a place to forget.
 */
function RosterSkins({ roster }: { roster: SkinRoster }) {
  const { t, tf } = useLocale();
  const e = t.skinsEditor;
  const { languages } = useEditorLanguages({ withDefault: true });
  const store = stores[roster];
  const draft = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  // The editor opens on what the site shows, so a save cannot put the built
  // version back over a published edit.
  const liveData = useGuideData<SkinData>(ROSTERS[roster].file);
  const liveTexts = usePublishedTexts<SkinTexts>(ROSTERS[roster].guide, "skinTexts");
  const published = useMemo(() => fromSkinsData(roster, liveData, liveTexts), [roster, liveData, liveTexts]);
  const state = draft ?? published;
  const commit = (next: SkinsEditorState) => store.set(next);

  const [exportOpen, setExportOpen] = useState(false);
  const savePayload = useMemo(() => exportSkins(state), [state]);
  const saveTexts = useMemo(() => exportedSkinTexts(state), [state]);
  const changes = useMemo(() => countSkinChanges(published, state), [published, state]);
  const problems = useMemo(() => findSkinProblems(state), [state]);
  const ctx: Ctx = { roster, state, commit, e, tf, languages };

  const add = () => {
    const owner = skinOwners(roster)[0] ?? "";
    const next = addSkin(state, owner);
    commit(next);
    const added = next.skins.at(-1);
    if (added) {
      window.requestAnimationFrame(() =>
        document.getElementById(`skin-${added.uid}`)?.scrollIntoView({ block: "start", behavior: "smooth" }),
      );
    }
  };

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    store.clear();
  };

  return (
    <section className="skins-editor-roster">
      <h2>{roster === "hero" ? e.heroHeading : e.goddessHeading}</h2>

      <div className="tier-toolbar tier-edit-toolbar">
        <AllLanguagesToggle />
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0
              ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}`
              : e.unchanged}
          </span>
          <button className="button" type="button" onClick={add}>
            <PlusIcon className="icon icon-sm" />
            {e.addSkin}
          </button>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          {roster === "hero" ? (
            <SaveToSite
              file="hero-skins"
              data={savePayload}
              guideId="heroes"
              texts={{ skinTexts: saveTexts }}
            />
          ) : (
            <SaveToSite
              file="goddess-skins"
              data={savePayload}
              guideId="goddesses"
              texts={{ skinTexts: saveTexts }}
            />
          )}
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

      {state.skins.length === 0 ? (
        <p className="empty-state">{e.empty}</p>
      ) : (
        <ol className="skin-edit-list">
          {state.skins.map((skin, index) => (
            <SkinRow key={skin.uid} ctx={ctx} skin={skin} index={index} />
          ))}
        </ol>
      )}

      {exportOpen ? <ExportDialog ctx={ctx} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </section>
  );
}

export function SkinsEditor() {
  const { t } = useLocale();
  const e = t.skinsEditor;
  return (
    <div className="skins-editor">
      <BackLink href={ROSTERS.hero.back} label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />
      <RosterSkins roster="hero" />
      <RosterSkins roster="goddess" />
    </div>
  );
}
