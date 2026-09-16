"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  PUBLISHED_MUSEION,
  addBuilding,
  addHero,
  buildingByUid,
  buildingTextBlocks,
  countMuseionChanges,
  exportMuseion,
  findMuseionProblems,
  moveBuilding,
  moveHero,
  parseMuseionDraft,
  removeBuilding,
  removeHero,
  serializeMuseionData,
  setBuildingName,
  setBuildingStats,
  unusedHeroes,
  type MuseionEditorState,
  type MuseionProblem,
} from "../../lib/content/museion-editor";
import { HERO_RARITIES, heroNamed, heroPortrait } from "../../lib/content/heroes";
import { DEFAULT_LOCALE, fill, toLocale, type Dictionary, type Locale } from "../../lib/i18n";
import { MUSEION_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { MUSEION_STATS, type MuseionStat } from "../../lib/content/museion";

type EditorText = Dictionary["museionEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const PUBLISHED_BLOCKS = buildingTextBlocks(PUBLISHED_MUSEION);

const draftStore = createPersistentStore<MuseionEditorState | null>({
  key: MUSEION_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseMuseionDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function download(href: string, name: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
}

function problemText(e: EditorText, tf: Tf, problem: MuseionProblem): string {
  switch (problem.code) {
    case "noBuildings":
      return e.problemNoBuildings;
    case "emptyName":
      return tf(e.problemEmptyName, problem.values ?? {});
    case "duplicateId":
      return tf(e.problemDuplicateId, problem.values ?? {});
    case "badStats":
      return tf(e.problemBadStats, problem.values ?? {});
    case "emptyHeroes":
      return tf(e.problemEmptyHeroes, problem.values ?? {});
    case "unknownHero":
      return tf(e.problemUnknownHero, problem.values ?? {});
    case "duplicateHero":
      return tf(e.problemDuplicateHero, problem.values ?? {});
    default:
      return problem.code;
  }
}

type Ctx = {
  state: MuseionEditorState;
  commit: (next: MuseionEditorState) => void;
  e: EditorText;
  tf: Tf;
  languages: Locale[];
  statLabels: Record<MuseionStat, string>;
};

function BuildingEditor({ ctx, uid }: { ctx: Ctx; uid: string }) {
  const { locale } = useLocale();
  const building = buildingByUid(ctx.state, uid);
  if (!building) return null;
  const { state, commit, e, languages, statLabels } = ctx;
  const name =
    building.name[toLocale(locale)].trim() ||
    building.name[DEFAULT_LOCALE].trim() ||
    e.unnamedBuilding;
  const available = unusedHeroes(state, uid);
  const primary = building.stats[0] ?? "";
  const secondary = building.stats[1] ?? "";

  return (
    <section className="museion-edit-building" aria-label={name}>
      <div className="tier-edit-form-head">
        <h2>{name}</h2>
        <div className="tier-edit-row-actions">
          <button className="small-button" type="button" onClick={() => commit(moveBuilding(state, uid, -1))}>
            {e.moveUp}
          </button>
          <button className="small-button" type="button" onClick={() => commit(moveBuilding(state, uid, 1))}>
            {e.moveDown}
          </button>
          <button
            className="small-button button-danger"
            type="button"
            onClick={() => {
              if (window.confirm(fill(e.removeBuildingConfirm, { building: name }))) {
                commit(removeBuilding(state, uid));
              }
            }}
          >
            <TrashIcon className="icon icon-sm" />
            {e.removeBuilding}
          </button>
        </div>
      </div>

      <TranslatedField
        label={e.fieldName}
        languages={languages}
        get={(locale) => building.name[locale]}
        set={(locale, value) => commit(setBuildingName(state, uid, locale, value))}
      />

      <div className="museion-edit-stats">
        <div className="field">
          <label htmlFor={`stat-a-${uid}`}>{e.fieldPrimaryStat}</label>
          <select
            id={`stat-a-${uid}`}
            value={primary}
            onChange={(event) => {
              const nextPrimary = event.target.value as MuseionStat | "";
              const next: MuseionStat[] = [];
              if (nextPrimary) next.push(nextPrimary);
              if (secondary && secondary !== nextPrimary) next.push(secondary as MuseionStat);
              commit(setBuildingStats(state, uid, next));
            }}
          >
            <option value="">{e.statNone}</option>
            {MUSEION_STATS.map((stat) => (
              <option key={stat} value={stat}>
                {statLabels[stat]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`stat-b-${uid}`}>{e.fieldSecondaryStat}</label>
          <select
            id={`stat-b-${uid}`}
            value={secondary}
            onChange={(event) => {
              const nextSecondary = event.target.value as MuseionStat | "";
              const next: MuseionStat[] = [];
              if (primary) next.push(primary as MuseionStat);
              if (nextSecondary && nextSecondary !== primary) next.push(nextSecondary);
              commit(setBuildingStats(state, uid, next));
            }}
          >
            <option value="">{e.statNone}</option>
            {MUSEION_STATS.map((stat) => (
              <option key={stat} value={stat}>
                {statLabels[stat]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h3>{e.heroesHeading}</h3>
      <ul className="museion-edit-heroes">
        {building.heroes.map((hero) => {
          const found = heroNamed(hero);
          return (
            <li key={hero}>
              <span className="guide-name">
                <HeroPortrait name={hero} rarity={found?.rarity} src={heroPortrait(hero)} className="hero-portrait-small" />
                {hero}
              </span>
              <div className="tier-edit-row-actions">
                <button className="small-button" type="button" onClick={() => commit(moveHero(state, uid, hero, -1))}>
                  {e.moveUp}
                </button>
                <button className="small-button" type="button" onClick={() => commit(moveHero(state, uid, hero, 1))}>
                  {e.moveDown}
                </button>
                <button
                  className="small-button button-danger"
                  type="button"
                  aria-label={fill(e.removeHero, { hero })}
                  onClick={() => commit(removeHero(state, uid, hero))}
                >
                  <TrashIcon className="icon icon-sm" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="field">
        <label htmlFor={`add-${uid}`}>{e.addHero}</label>
        {available.length === 0 ? (
          <p className="tier-small">{e.allHeroesUsed}</p>
        ) : (
          <select
            id={`add-${uid}`}
            value=""
            onChange={(event) => {
              if (event.target.value) commit(addHero(state, uid, event.target.value));
            }}
          >
            <option value="">{e.addHeroPlaceholder}</option>
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
        )}
      </div>
    </section>
  );
}

function ExportDialog({
  ctx,
  problems,
  onClose,
}: {
  ctx: Ctx;
  problems: MuseionProblem[];
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const { e, tf, state } = ctx;
  const result = useMemo(() => exportMuseion(state), [state]);
  const json = useMemo(() => serializeMuseionData(result), [result]);
  const blocks = useMemo(() => {
    const all = buildingTextBlocks(state);
    return Object.fromEntries(
      Object.entries(all).filter(([code, block]) => block !== PUBLISHED_BLOCKS[code as Locale]),
    );
  }, [state]);

  const copy = (key: string, value: string) =>
    navigator.clipboard?.writeText(value).then(() => setCopied(key), () => { /* clipboard blocked */ });

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
      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/museion.json</code>
          <div className="tier-edit-row-actions">
            <button className="small-button" type="button" onClick={() => void copy("json", json)}>
              {copied === "json" ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied === "json" ? e.copied : e.copy}
            </button>
            <button
              className="small-button"
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                download(url, "museion.json");
                window.setTimeout(() => URL.revokeObjectURL(url), 0);
              }}
            >
              <DownloadIcon className="icon icon-sm" />
              {e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/museion.json" />
      </div>
      <DictionaryBlocks blocks={blocks} title={e.exportTexts} rows={6} />
    </dialog>
  );
}

export function MuseionEditor() {
  const { t, tf, locale } = useLocale();
  const e = t.museionEditor;
  const guide = t.guideEntries.museion;
  const { languages } = useEditorLanguages({ withDefault: true });
  const uiLocale = toLocale(locale);

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED_MUSEION;
  const commit = (next: MuseionEditorState) => draftStore.set(next);

  const [selected, setSelected] = useState<string | null>(state.buildings[0]?.uid ?? null);
  const [exportOpen, setExportOpen] = useState(false);
  const changes = useMemo(() => countMuseionChanges(PUBLISHED_MUSEION, state), [state]);
  const problems = useMemo(() => findMuseionProblems(state), [state]);
  const active = selected && buildingByUid(state, selected) ? selected : state.buildings[0]?.uid ?? null;
  const ctx: Ctx = { state, commit, e, tf, languages, statLabels: guide.stats };

  return (
    <div className="hero-tiers tier-editor museion-editor">
      <BackLink href="/guides/museion/" label={e.back} />
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
            onClick={() => {
              const result = addBuilding(state);
              commit(result.state);
              setSelected(result.uid);
            }}
          >
            <PlusIcon className="icon icon-sm" />
            {e.addBuilding}
          </button>
          <button
            className="button"
            type="button"
            disabled={!draft}
            onClick={() => {
              if (window.confirm(e.resetConfirm)) {
                draftStore.clear();
                setSelected(null);
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

      <div className="museion-edit-layout">
        <ul className="museion-edit-list" aria-label={e.buildingsList}>
          {state.buildings.map((building) => {
            const label =
              building.name[uiLocale].trim() || building.name[DEFAULT_LOCALE].trim() || e.unnamedBuilding;
            return (
              <li key={building.uid}>
                <button
                  type="button"
                  className={building.uid === active ? "is-active" : undefined}
                  onClick={() => setSelected(building.uid)}
                >
                  {label}
                  <span className="tier-small">{fill(e.heroCount, { count: building.heroes.length })}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="museion-edit-main">
          {active ? <BuildingEditor ctx={ctx} uid={active} /> : <p className="tier-small">{e.selectHint}</p>}
        </div>
      </div>

      {exportOpen ? <ExportDialog ctx={ctx} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}
