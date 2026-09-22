"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  FOCUS_BANDS,
  FRAGMENT_KINDS,
  LEVELING_BUILDS,
  type FocusBandId,
  type FragmentKind,
  type LevelingBuildId,
} from "../../lib/content/hero-leveling";
import {
  PUBLISHED_LEVELING,
  addFocusHero,
  addFragment,
  buildOf,
  countLevelingChanges,
  exportLeveling,
  findLevelingProblems,
  heroNoteBlocks,
  moveFocusHero,
  moveFragment,
  noteOf,
  parseLevelingDraft,
  removeFocusHero,
  removeFragment,
  serializeLevelingData,
  setDefaultBuild,
  setFocusBand,
  setLevelTarget,
  setNote,
  unusedFocusHeroes,
  updateFragment,
  type LevelingEditorState,
  type LevelingProblem,
} from "../../lib/content/hero-leveling-editor";
import { HEROES, HERO_RARITIES, heroNamed, heroPortrait } from "../../lib/content/heroes";
import { fill, type Dictionary, type Locale } from "../../lib/i18n";
import { LEVELING_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";

type EditorText = Dictionary["levelingEditor"];
type Guide = Dictionary["guideEntries"]["heroLeveling"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const draftStore = createPersistentStore<LevelingEditorState | null>({
  key: LEVELING_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseLevelingDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function download(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
}

function problemText(e: EditorText, tf: Tf, problem: LevelingProblem): string {
  switch (problem.code) {
    case "badDefaultBuild":
      return e.problemBadDefaultBuild;
    case "emptyDefaultFocus":
      return tf(e.problemEmptyDefaultFocus, problem.values ?? {});
    case "unknownHero":
      return tf(e.problemUnknownHero, problem.values ?? {});
    case "badBand":
      return tf(e.problemBadBand, problem.values ?? {});
    case "duplicateHero":
      return tf(e.problemDuplicateHero, problem.values ?? {});
    case "badFragment":
      return tf(e.problemBadFragment, problem.values ?? {});
    case "emptyFragmentHero":
      return tf(e.problemEmptyFragmentHero, problem.values ?? {});
    case "badLevelTarget":
      return tf(e.problemBadLevelTarget, problem.values ?? {});
    case "emptyLevelTarget":
      return tf(e.problemEmptyLevelTarget, problem.values ?? {});
    default:
      return problem.code;
  }
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

type Ctx = {
  state: LevelingEditorState;
  commit: (next: LevelingEditorState) => void;
  e: EditorText;
  guide: Guide;
  tf: Tf;
  languages: Locale[];
  buildNames: Record<LevelingBuildId, string>;
};

function NoteFields({ ctx, uid }: { ctx: Ctx; uid: string }) {
  const id = useId();
  const many = ctx.languages.length > 1;
  return (
    <div className="field layout-text-field">
      <label htmlFor={`${id}-${ctx.languages[0]}`}>{ctx.e.fieldNote}</label>
      {ctx.languages.map((language) => (
        <div className="layout-lang-input" key={language}>
          {many ? <span className="layout-lang">{language.toUpperCase()}</span> : null}
          <input
            id={`${id}-${language}`}
            value={noteOf(ctx.state, language, uid)}
            onChange={(event) => ctx.commit(setNote(ctx.state, language, uid, event.target.value))}
          />
        </div>
      ))}
    </div>
  );
}

function BuildEditor({ ctx, buildId }: { ctx: Ctx; buildId: LevelingBuildId }) {
  const { state, commit, e, guide } = ctx;
  const build = buildOf(state, buildId);
  const id = useId();
  if (!build) return null;
  const available = unusedFocusHeroes(state, buildId);

  return (
    <section className="leveling-edit-build" aria-label={ctx.buildNames[buildId]}>
      <h2>{ctx.buildNames[buildId]}</h2>

      <h3>{e.focusHeading}</h3>
      {build.focus.length === 0 ? <p className="tier-small">{e.emptyFocus}</p> : null}
      <ul className="leveling-edit-rows">
        {build.focus.map((entry) => (
          <li key={entry.uid}>
            <div className="leveling-edit-head">
              <HeroName hero={entry.hero} />
              <div className="tier-edit-row-actions">
                <button className="small-button" type="button" onClick={() => commit(moveFocusHero(state, buildId, entry.uid, -1))}>
                  {e.moveUp}
                </button>
                <button className="small-button" type="button" onClick={() => commit(moveFocusHero(state, buildId, entry.uid, 1))}>
                  {e.moveDown}
                </button>
                <button
                  className="small-button button-danger"
                  type="button"
                  aria-label={fill(e.removeHero, { hero: entry.hero })}
                  onClick={() => commit(removeFocusHero(state, buildId, entry.uid))}
                >
                  <TrashIcon className="icon icon-sm" />
                </button>
              </div>
            </div>
            <div className="leveling-edit-fields">
              <div className="field">
                <label htmlFor={`${id}-band-${entry.uid}`}>{e.fieldBand}</label>
                <select
                  id={`${id}-band-${entry.uid}`}
                  value={entry.band}
                  onChange={(event) => commit(setFocusBand(state, buildId, entry.uid, event.target.value as FocusBandId))}
                >
                  {FOCUS_BANDS.map((band) => (
                    <option key={band} value={band}>
                      {guide.bands[band]}
                    </option>
                  ))}
                </select>
              </div>
              <NoteFields ctx={ctx} uid={entry.uid} />
            </div>
          </li>
        ))}
      </ul>
      <div className="field">
        <label htmlFor={`${id}-add-focus`}>{e.addHero}</label>
        <select
          id={`${id}-add-focus`}
          value=""
          disabled={available.length === 0}
          onChange={(event) => {
            if (event.target.value) commit(addFocusHero(state, buildId, event.target.value));
          }}
        >
          <option value="">{available.length === 0 ? e.allHeroesUsed : e.addHeroPlaceholder}</option>
          {HERO_RARITIES.map((tier) => {
            const heroes = available.filter((hero) => hero.rarity === tier);
            if (heroes.length === 0) return null;
            return (
              <optgroup key={tier} label={tier}>
                {heroes.map((hero) => (
                  <option key={hero.id} value={hero.name}>
                    {hero.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      <h3>{e.fragmentsHeading}</h3>
      {build.fragments.length === 0 ? <p className="tier-small">{e.emptyFragments}</p> : null}
      <ul className="leveling-edit-rows">
        {build.fragments.map((rule) => (
          <li key={rule.uid}>
            <div className="leveling-edit-head">
              <strong>{e.fragmentKinds[rule.kind]}</strong>
              <div className="tier-edit-row-actions">
                <button className="small-button" type="button" onClick={() => commit(moveFragment(state, buildId, rule.uid, -1))}>
                  {e.moveUp}
                </button>
                <button className="small-button" type="button" onClick={() => commit(moveFragment(state, buildId, rule.uid, 1))}>
                  {e.moveDown}
                </button>
                <button
                  className="small-button button-danger"
                  type="button"
                  onClick={() => commit(removeFragment(state, buildId, rule.uid))}
                >
                  <TrashIcon className="icon icon-sm" />
                </button>
              </div>
            </div>
            <div className="leveling-edit-fields">
              <div className="field">
                <label htmlFor={`${id}-kind-${rule.uid}`}>{e.fieldFragmentKind}</label>
                <select
                  id={`${id}-kind-${rule.uid}`}
                  value={rule.kind}
                  onChange={(event) =>
                    commit(updateFragment(state, buildId, rule.uid, { kind: event.target.value as FragmentKind }))
                  }
                >
                  {FRAGMENT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {e.fragmentKinds[kind]}
                    </option>
                  ))}
                </select>
              </div>
              {rule.kind === "allUr" || rule.kind === "allSsrWhenUrPlus" ? (
                <div className="field">
                  <label htmlFor={`${id}-hero-${rule.uid}`}>{e.fieldHero}</label>
                  <select
                    id={`${id}-hero-${rule.uid}`}
                    value={rule.hero}
                    onChange={(event) => commit(updateFragment(state, buildId, rule.uid, { hero: event.target.value }))}
                  >
                    <option value="">{e.addHeroPlaceholder}</option>
                    {HEROES.map((hero) => (
                      <option key={hero.id} value={hero.name}>
                        {hero.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {rule.kind === "splitEvenWhenUr" ? (
                <>
                  <div className="field">
                    <label htmlFor={`${id}-left-${rule.uid}`}>{e.fieldHeroA}</label>
                    <select
                      id={`${id}-left-${rule.uid}`}
                      value={rule.heroes[0]}
                      onChange={(event) =>
                        commit(
                          updateFragment(state, buildId, rule.uid, {
                            heroes: [event.target.value, rule.heroes[1]],
                          }),
                        )
                      }
                    >
                      <option value="">{e.addHeroPlaceholder}</option>
                      {HEROES.map((hero) => (
                        <option key={hero.id} value={hero.name}>
                          {hero.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`${id}-right-${rule.uid}`}>{e.fieldHeroB}</label>
                    <select
                      id={`${id}-right-${rule.uid}`}
                      value={rule.heroes[1]}
                      onChange={(event) =>
                        commit(
                          updateFragment(state, buildId, rule.uid, {
                            heroes: [rule.heroes[0], event.target.value],
                          }),
                        )
                      }
                    >
                      <option value="">{e.addHeroPlaceholder}</option>
                      {HEROES.map((hero) => (
                        <option key={hero.id} value={hero.name}>
                          {hero.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <button className="button" type="button" onClick={() => commit(addFragment(state, buildId))}>
        <PlusIcon className="icon icon-sm" />
        {e.addFragment}
      </button>
    </section>
  );
}

function ExportDialog({
  open,
  onClose,
  state,
  e,
}: {
  open: boolean;
  onClose: () => void;
  state: LevelingEditorState;
  e: EditorText;
}) {
  const [copied, setCopied] = useState<"json" | Locale | null>(null);
  const exported = useMemo(() => exportLeveling(state), [state]);
  const json = useMemo(() => serializeLevelingData(exported), [exported]);
  const blocks = useMemo(() => heroNoteBlocks(state), [state]);
  const problems = useMemo(() => findLevelingProblems(state), [state]);

  if (!open) return null;

  return (
    <dialog
      className="tier-export"
      ref={(node) => {
        if (node && !node.open) node.showModal();
      }}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="tier-export-head">
        <h2>{e.exportTitle}</h2>
        <button className="icon-button" type="button" aria-label={e.close} onClick={onClose}>
          <CloseIcon className="icon" />
        </button>
      </div>
      <p>{e.exportLede}</p>
      {problems.length > 0 ? (
        <div className="callout">
          <strong>{e.problemsTitle}</strong>
          <ul>
            {problems.map((problem, index) => (
              <li key={`${problem.code}-${index}`}>{problemText(e, fill, problem)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="tier-export-block">
        <div className="tier-export-block-head">
          <h3>
            <code>lib/data/hero-leveling.json</code>
          </h3>
          <div className="tier-edit-row-actions">
            <button
              className="small-button"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(json);
                setCopied("json");
              }}
            >
              {copied === "json" ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied === "json" ? e.copied : e.copy}
            </button>
            <button
              className="small-button"
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                download(url, "hero-leveling.json");
                window.setTimeout(() => URL.revokeObjectURL(url), 0);
              }}
            >
              <DownloadIcon className="icon icon-sm" />
              {e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/hero-leveling.json" />
      </div>
      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={6} />
    </dialog>
  );
}

export function HeroLevelingEditor() {
  const { t, tf } = useLocale();
  const e = t.levelingEditor;
  const guide = t.guideEntries.heroLeveling;
  const { languages } = useEditorLanguages({ withDefault: true });
  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED_LEVELING;
  const commit = (next: LevelingEditorState) => draftStore.set(next);
  const [selected, setSelected] = useState<LevelingBuildId>(state.defaultBuild);
  const [exportOpen, setExportOpen] = useState(false);
  const changes = useMemo(() => countLevelingChanges(PUBLISHED_LEVELING, state), [state]);
  const problems = useMemo(() => findLevelingProblems(state), [state]);
  const buildNames = useMemo(() => {
    const names = {} as Record<LevelingBuildId, string>;
    for (const id of LEVELING_BUILDS) {
      names[id] = t.guideEntries.heroLayouts.buildTexts[id]?.name ?? guide.buildNames[id] ?? id;
    }
    return names;
  }, [guide.buildNames, t.guideEntries.heroLayouts.buildTexts]);
  const ctx: Ctx = { state, commit, e, guide, tf, languages, buildNames };

  return (
    <div className="hero-tiers tier-editor leveling-editor">
      <BackLink href="/guides/hero-leveling/" label={e.back} />
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
              if (window.confirm(e.resetConfirm)) {
                draftStore.clear();
                setSelected(PUBLISHED_LEVELING.defaultBuild);
              }
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

      <div className="field">
        <label htmlFor="leveling-default-build">{e.fieldDefaultBuild}</label>
        <select
          id="leveling-default-build"
          value={state.defaultBuild}
          onChange={(event) => commit(setDefaultBuild(state, event.target.value as LevelingBuildId))}
        >
          {LEVELING_BUILDS.map((id) => (
            <option key={id} value={id}>
              {buildNames[id]}
            </option>
          ))}
        </select>
      </div>

      <div className="hero-filters leveling-filters" role="tablist" aria-label={e.buildsList}>
        {LEVELING_BUILDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={id === selected ? "is-active" : undefined}
            aria-selected={id === selected}
            onClick={() => setSelected(id)}
          >
            {buildNames[id]}
          </button>
        ))}
      </div>

      <BuildEditor ctx={ctx} buildId={selected} />

      <section className="leveling-edit-levels">
        <h2>{e.levelsHeading}</h2>
        <ul className="leveling-edit-rows">
          {state.levelTargets.map((target) => (
            <li key={target.uid}>
              <div className="leveling-edit-head">
                <strong>{guide.levelTargets[target.id]}</strong>
              </div>
              <div className="leveling-edit-fields">
                <div className="field">
                  <label htmlFor={`level-target-${target.uid}`}>{e.fieldLevelTarget}</label>
                  <input
                    id={`level-target-${target.uid}`}
                    value={target.target}
                    onChange={(event) => commit(setLevelTarget(state, target.uid, { target: event.target.value }))}
                  />
                </div>
                <label className="tier-edit-check">
                  <input
                    type="checkbox"
                    checked={target.noAscend}
                    onChange={(event) => commit(setLevelTarget(state, target.uid, { noAscend: event.target.checked }))}
                  />
                  {e.fieldNoAscend}
                </label>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} state={state} e={e} />
    </div>
  );
}
