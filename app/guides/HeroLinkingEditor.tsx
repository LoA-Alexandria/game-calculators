"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  LINK_SOURCES,
  type LinkSource,
} from "../../lib/content/hero-linking";
import {
  addLink,
  addTarget,
  countLinkingChanges,
  exportLinking,
  findLinkingProblems,
  moveTarget,
  noteOf,
  parseLinkingDraft,
  removeLink,
  removeTarget,
  serializeLinkingData,
  setNote,
  textBlocks,
  unusedHeroes,
  updateLink,
  PUBLISHED_LINKING,
  type LinkList,
  type LinkingEditorState,
  type LinkingProblem,
} from "../../lib/content/hero-linking-editor";
import { HERO_RARITIES, heroNamed, heroPortrait } from "../../lib/content/heroes";
import { DEFAULT_LOCALE, LOCALES, localeMeta, type Dictionary, type Locale } from "../../lib/i18n";
import { LINKING_DRAFT_STORAGE_KEY } from "../../lib/site";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";

type EditorText = Dictionary["linkingEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const draftStore = createPersistentStore<LinkingEditorState | null>({
  key: LINKING_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseLinkingDraft,
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
  state: LinkingEditorState;
  commit: (next: LinkingEditorState) => void;
  e: EditorText;
  tf: Tf;
  /** The languages the note fields are shown in; the first one is always English. */
  languages: Locale[];
  /** Track labels, shared with the guide page. */
  sources: Record<LinkSource, string>;
};

/** One note field per shown language. A note is prose, so no language is the source. */
function NoteFields({ ctx, id, list, uid }: { ctx: Ctx; id: string; list: LinkList; uid: string }) {
  const { state, commit, e } = ctx;
  const many = ctx.languages.length > 1;
  return (
    <div className="field layout-text-field">
      <label htmlFor={`${id}-${ctx.languages[0]}`}>{e.fieldNote}</label>
      {ctx.languages.map((language) => (
        <div className="layout-lang-input" key={language}>
          {many ? <span className="layout-lang" title={localeMeta(language).label}>{language.toUpperCase()}</span> : null}
          <input
            id={`${id}-${language}`}
            value={noteOf(state, language, list, uid)}
            aria-label={many ? `${e.fieldNote} (${localeMeta(language).label})` : undefined}
            onChange={(event) => commit(setNote(state, language, list, uid, event.target.value))}
          />
        </div>
      ))}
    </div>
  );
}

/** The roster picker: every hero not in this list yet, grouped by rarity. */
function HeroPicker({
  ctx,
  id,
  list,
  onPick,
}: {
  ctx: Ctx;
  id: string;
  list: LinkList;
  onPick: (hero: string) => void;
}) {
  const { state, e } = ctx;
  const available = unusedHeroes(state, list);
  if (available.length === 0) return <p className="tier-small">{e.allHeroesUsed}</p>;
  return (
    <div className="field">
      <label htmlFor={id}>{e.addHero}</label>
      <select
        id={id}
        value=""
        onChange={(event) => {
          if (event.target.value) onPick(event.target.value);
        }}
      >
        <option value="">{e.addHeroPlaceholder}</option>
        {HERO_RARITIES.map((tier) => {
          const heroes = available.filter((hero) => hero.rarity === tier);
          if (heroes.length === 0) return null;
          return (
            <optgroup key={tier} label={tier}>
              {heroes.map((hero) => <option key={hero.id} value={hero.name}>{hero.name}</option>)}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}

function HeroName({ hero }: { hero: string }) {
  const found = heroNamed(hero);
  return (
    <span className="guide-name">
      <HeroPortrait name={hero} rarity={found?.rarity} src={heroPortrait(hero)} className="hero-portrait-small" />
      {hero}
    </span>
  );
}

export function HeroLinkingEditor() {
  const { t, tf, locale } = useLocale();
  const e = t.linkingEditor;
  const id = useId();
  const language = LOCALES.some((entry) => entry.code === locale) ? locale : DEFAULT_LOCALE;

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED_LINKING;
  const commit = (next: LinkingEditorState) => draftStore.set(next);

  const [allLanguages, setAllLanguages] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const languages = allLanguages
    ? LOCALES.map((entry) => entry.code)
    : [...new Set<Locale>([DEFAULT_LOCALE, language])];
  const ctx: Ctx = { state, commit, e, tf, languages, sources: t.guideEntries.heroLinking.sources };

  const changes = useMemo(() => countLinkingChanges(PUBLISHED_LINKING, state), [state]);
  const problems = useMemo(() => findLinkingProblems(state), [state]);

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
  };

  return (
    <div className="hero-tiers tier-editor linking-editor">
      <BackLink href="/guides/hero-linking/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <label className="tier-edit-check">
          <input type="checkbox" checked={allLanguages} onChange={(event) => setAllLanguages(event.target.checked)} />
          {e.allLanguages}
        </label>
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0 ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>
            {e.export}
            {problems.length > 0 ? <span className="tier-edit-count" aria-label={tf(e.problemCount, { count: problems.length })}>{problems.length}</span> : null}
          </button>
        </div>
      </div>

      <section className="linking-edit-block">
        <h2>{e.linksHeading}</h2>
        {state.links.length === 0 ? <p className="tier-small">{e.emptyLinks}</p> : (
          <ul className="linking-edit-rows">
            {state.links.map((link) => (
              <li className="linking-edit-row" key={link.uid}>
                <div className="linking-edit-head">
                  <HeroName hero={link.hero} />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={tf(e.remove, { hero: link.hero })}
                    onClick={() => commit(removeLink(state, link.uid))}
                  >
                    <CloseIcon className="icon icon-sm" />
                  </button>
                </div>
                <div className="linking-edit-fields">
                  <div className="field">
                    <label htmlFor={`${id}-source-${link.uid}`}>{e.fieldSource}</label>
                    <select
                      id={`${id}-source-${link.uid}`}
                      value={link.source}
                      onChange={(event) => commit(updateLink(state, link.uid, { source: event.target.value as LinkSource }))}
                    >
                      {LINK_SOURCES.map((source) => (
                        <option key={source} value={source}>{ctx.sources[source]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`${id}-step-${link.uid}`}>{e.fieldStep}</label>
                    <input
                      id={`${id}-step-${link.uid}`}
                      type="number"
                      min={1}
                      value={link.step}
                      onChange={(event) => commit(updateLink(state, link.uid, { step: Math.max(1, Number(event.target.value) || 1) }))}
                    />
                  </div>
                  <NoteFields ctx={ctx} id={`${id}-link-note-${link.uid}`} list="links" uid={link.uid} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <HeroPicker ctx={ctx} id={`${id}-add-link`} list="links" onPick={(hero) => commit(addLink(state, hero))} />
      </section>

      <section className="linking-edit-block">
        <h2>{e.priorityHeading}</h2>
        {state.priority.length === 0 ? <p className="tier-small">{e.emptyPriority}</p> : (
          <ol className="linking-edit-rows">
            {state.priority.map((target, index) => (
              <li className="linking-edit-row" key={target.uid}>
                <div className="linking-edit-head">
                  <HeroName hero={target.hero} />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={tf(e.remove, { hero: target.hero })}
                    onClick={() => commit(removeTarget(state, target.uid))}
                  >
                    <CloseIcon className="icon icon-sm" />
                  </button>
                </div>
                <div className="linking-edit-fields is-target">
                  <div className="field">
                    <label htmlFor={`${id}-rank-${target.uid}`}>{e.fieldRank}</label>
                    <select
                      id={`${id}-rank-${target.uid}`}
                      value={index}
                      onChange={(event) => commit(moveTarget(state, target.uid, Number(event.target.value)))}
                    >
                      {state.priority.map((_, rank) => <option key={rank} value={rank}>{rank + 1}</option>)}
                    </select>
                  </div>
                  <NoteFields ctx={ctx} id={`${id}-target-note-${target.uid}`} list="priority" uid={target.uid} />
                </div>
              </li>
            ))}
          </ol>
        )}
        <HeroPicker ctx={ctx} id={`${id}-add-target`} list="priority" onPick={(hero) => commit(addTarget(state, hero))} />
        <p className="tier-small">{e.noteHint}</p>
      </section>

      {exportOpen ? <ExportDialog ctx={ctx} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}

function problemText(ctx: Ctx, problem: LinkingProblem): string {
  switch (problem.code) {
    case "unknownHero": return ctx.tf(ctx.e.problemUnknownHero, { hero: problem.hero });
    case "duplicateLink": return ctx.tf(ctx.e.problemDuplicateLink, { hero: problem.hero });
    case "duplicateStep": return ctx.tf(ctx.e.problemDuplicateStep, { source: ctx.sources[problem.source], step: problem.step });
    case "noLinks": return ctx.e.problemNoLinks;
    case "noPriority": return ctx.e.problemNoPriority;
    case "missingNote": return ctx.tf(ctx.e.problemMissingNote, { hero: problem.hero, language: problem.language });
  }
}

function ExportDialog({ ctx, problems, onClose }: { ctx: Ctx; problems: LinkingProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const { e } = ctx;
  const json = useMemo(() => serializeLinkingData(exportLinking(ctx.state)), [ctx.state]);
  const blocks = useMemo(() => textBlocks(ctx.state), [ctx.state]);

  const copy = (key: string, value: string) =>
    navigator.clipboard?.writeText(value).then(() => setCopied(key), () => { /* clipboard blocked */ });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    download(url, "hero-linking.json");
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
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(ctx, problem)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/hero-linking.json</code>
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
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/hero-linking.json" />
      </div>

      <div className="tier-export-block">
        <h3>{e.exportTexts}</h3>
        {LOCALES.map((locale) => (
          <div key={locale.code} className="tier-export-snippet">
            <div className="tier-export-head">
              <code>{`lib/i18n/dictionaries/${locale.code}.ts`}</code>
              <button className="small-button" type="button" onClick={() => void copy(locale.code, blocks[locale.code])}>
                {copied === locale.code ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
                {copied === locale.code ? e.copied : e.copy}
              </button>
            </div>
            <textarea readOnly value={blocks[locale.code]} rows={6} spellCheck={false} aria-label={`lib/i18n/dictionaries/${locale.code}.ts`} />
          </div>
        ))}
      </div>
    </dialog>
  );
}
