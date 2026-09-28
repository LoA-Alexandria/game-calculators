"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  LORE_FILES,
  LORE_LANGUAGES,
  countLoreChanges,
  exportLore,
  findLoreProblems,
  fromLoreData,
  parseLoreDraft,
  serializeLore,
  setLore,
  untranslatedLore,
  type EditorLoreRow,
  type LoreEditorState,
  type LoreFile,
  type LoreLanguage,
  type LoreProblem,
  type LoreRoster,
} from "../../lib/content/lore-editor";
import { GODDESS_DATA, goddessPortrait } from "../../lib/content/goddesses";
import { HERO_DATA, heroPortrait } from "../../lib/content/heroes";
import { GODDESS_LORE_DRAFT_STORAGE_KEY, HERO_LORE_DRAFT_STORAGE_KEY } from "../../lib/site";
import { LOCALES, type Dictionary } from "../../lib/i18n";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { SaveToSite } from "./SaveToSite";
import { useGuideData } from "./GuideOverrides";

type EditorText = Dictionary["loreEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const stores = {
  hero: createPersistentStore<LoreEditorState | null>({
    key: HERO_LORE_DRAFT_STORAGE_KEY,
    serverValue: null,
    parse: (raw) => parseLoreDraft(raw, "hero"),
    fallback: () => null,
    serialize: (value) => JSON.stringify(value),
  }),
  goddess: createPersistentStore<LoreEditorState | null>({
    key: GODDESS_LORE_DRAFT_STORAGE_KEY,
    serverValue: null,
    parse: (raw) => parseLoreDraft(raw, "goddess"),
    fallback: () => null,
    serialize: (value) => JSON.stringify(value),
  }),
};

type Ctx = {
  roster: LoreRoster;
  state: LoreEditorState;
  commit: (next: LoreEditorState) => void;
  e: EditorText;
  tf: Tf;
  languageName: (language: LoreLanguage) => string;
};

function problemText(e: EditorText, tf: Tf, problem: LoreProblem, languageName: Ctx["languageName"]): string {
  if (problem.code === "notOnRoster") return tf(e.problemNotOnRoster, { id: problem.id });
  const values = { name: problem.name, language: languageName(problem.language) };
  return problem.code === "bioWithoutTitle"
    ? tf(e.problemBioWithoutTitle, values)
    : tf(e.problemTitleWithoutBio, values);
}

function LoreRow({ ctx, row }: { ctx: Ctx; row: EditorLoreRow }) {
  const { roster, state, commit, e, languageName } = ctx;
  const ids = useId();
  const portrait = roster === "hero" ? heroPortrait(row.name) : goddessPortrait(row.name);

  return (
    <li className="panel lore-edit-row" id={`lore-${row.id}`}>
      <div className="lore-edit-head">
        <HeroPortrait name={row.name} src={portrait} className="hero-portrait-small" />
        <strong>{row.name}</strong>
        {row.english.title ? <span className="tier-small">{row.english.title}</span> : null}
      </div>
      {row.english.bio ? <p className="lore-edit-english">{row.english.bio}</p> : null}

      <div className="lore-edit-langs">
        {LORE_LANGUAGES.map((language) => (
          <div className="lore-edit-lang" key={language}>
            <div className="field">
              <label htmlFor={`${ids}-${language}-title`}>
                {e.fieldTitle} <span className="label-note">{languageName(language)}</span>
              </label>
              <input
                id={`${ids}-${language}-title`}
                value={row[language].title}
                placeholder={row.english.title || undefined}
                onChange={(event) => commit(setLore(state, row.id, language, { title: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-${language}-bio`}>
                {e.fieldBio} <span className="label-note">{languageName(language)}</span>
              </label>
              <textarea
                id={`${ids}-${language}-bio`}
                rows={5}
                value={row[language].bio}
                placeholder={row.english.bio || undefined}
                onChange={(event) => commit(setLore(state, row.id, language, { bio: event.target.value }))}
              />
            </div>
          </div>
        ))}
      </div>
    </li>
  );
}

function ExportDialog({ ctx, problems, onClose }: { ctx: Ctx; problems: LoreProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const { roster, state, e, tf, languageName } = ctx;
  const files = useMemo(
    () => LORE_LANGUAGES.map((language) => ({
      language,
      name: `lib/data/${LORE_FILES[roster][language]}.json`,
      text: serializeLore(exportLore(state, language)),
    })),
    [roster, state],
  );

  const copy = (name: string, text: string) =>
    navigator.clipboard?.writeText(text).then(() => setCopied(name), () => { /* clipboard blocked */ });
  const download = (name: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name.split("/").at(-1) ?? "lore.json";
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
      <p className="tier-small">{e.exportLede}</p>
      {problems.length > 0 ? (
        <div className="notice notice-warn tier-export-problems" role="alert">
          <div>
            <strong>{e.problemsTitle}</strong>
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(e, tf, problem, languageName)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      {files.map((entry) => (
        <div className="tier-export-block" key={entry.name}>
          <div className="tier-export-head">
            <code>{entry.name}</code>
            <div className="tier-edit-row-actions">
              <button className="small-button" type="button" onClick={() => void copy(entry.name, entry.text)}>
                {copied === entry.name ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
                {copied === entry.name ? e.copied : e.copy}
              </button>
              <button className="small-button" type="button" onClick={() => download(entry.name, entry.text)}>
                <DownloadIcon className="icon icon-sm" />
                {e.download}
              </button>
            </div>
          </div>
          <textarea readOnly value={entry.text} rows={8} spellCheck={false} aria-label={entry.name} />
        </div>
      ))}
    </dialog>
  );
}

/**
 * One roster's lore, both languages side by side.
 *
 * The English epithet and story stand above them, because that is what is
 * being translated and what a reader sees until somebody does. Both languages
 * are saved in one press: half a translation shows one language's epithet over
 * another language's story.
 */
function RosterLore({ roster }: { roster: LoreRoster }) {
  const { t, tf } = useLocale();
  const e = t.loreEditor;
  const store = stores[roster];
  const draft = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  // The editor opens on what the site serves, not on the built files.
  const de = useGuideData<LoreFile>(LORE_FILES[roster].de);
  const fr = useGuideData<LoreFile>(LORE_FILES[roster].fr);
  const people = useGuideData<{ heroes?: typeof HERO_DATA.heroes; goddesses?: typeof GODDESS_DATA.goddesses }>(
    roster === "hero" ? "heroes" : "goddesses",
  );
  const published = useMemo(
    () => fromLoreData(roster, { de, fr }, roster === "hero" ? people.heroes : people.goddesses),
    [roster, de, fr, people],
  );
  const state = draft ?? published;
  const commit = (next: LoreEditorState) => store.set(next);

  const [exportOpen, setExportOpen] = useState(false);
  const [query, setQuery] = useState("");
  const german = useMemo(() => exportLore(state, "de"), [state]);
  const french = useMemo(() => exportLore(state, "fr"), [state]);
  const changes = useMemo(() => countLoreChanges(published, state), [published, state]);
  const problems = useMemo(() => findLoreProblems(state), [state]);
  const missing = useMemo(() => untranslatedLore(state), [state]);

  const languageName = (language: LoreLanguage) =>
    LOCALES.find((entry) => entry.code === language)?.label ?? language;
  const ctx: Ctx = { roster, state, commit, e, tf, languageName };

  const needle = query.trim().toLowerCase();
  const rows = needle
    ? state.rows.filter((row) => `${row.name} ${row.id} ${row.english.title ?? ""}`.toLowerCase().includes(needle))
    : state.rows;

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    store.clear();
  };

  return (
    <section className="lore-edit-roster">
      <h2>{roster === "hero" ? e.heroHeading : e.goddessHeading}</h2>

      <div className="tier-toolbar tier-edit-toolbar">
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0
              ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}`
              : e.unchanged}
          </span>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          {roster === "hero" ? (
            <SaveToSite
              file="hero-lore-de"
              data={german}
              more={[{ file: "hero-lore-fr", data: french }]}
            />
          ) : (
            <SaveToSite
              file="goddess-lore-de"
              data={german}
              more={[{ file: "goddess-lore-fr", data: french }]}
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

      {missing.length > 0 ? (
        <p className="tier-small">
          {missing.map((row) => tf(e.untranslated, { count: row.count, language: languageName(row.language) })).join(" · ")}
        </p>
      ) : null}

      <div className="field lore-edit-search">
        <label htmlFor={`lore-search-${roster}`}>{e.search}</label>
        <input
          id={`lore-search-${roster}`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <p className="hero-count" aria-live="polite">{tf(e.shown, { count: rows.length })}</p>
      <ol className="lore-edit-list">
        {rows.map((row) => <LoreRow key={row.id} ctx={ctx} row={row} />)}
      </ol>

      {exportOpen ? <ExportDialog ctx={ctx} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </section>
  );
}

export function LoreEditor() {
  const { t } = useLocale();
  const e = t.loreEditor;
  return (
    <div className="lore-editor">
      <BackLink href="/guides/heroes/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />
      <RosterLore roster="hero" />
      <RosterLore roster="goddess" />
    </div>
  );
}
