"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import {
  PAINTING_RARITIES,
  PAINTING_SETS,
  PAINTING_STATS,
  type PaintingRarity,
} from "../../lib/content/artwork";
import {
  addHero,
  addPainting,
  addSet,
  countChanges,
  findPainting,
  findProblems,
  findSet,
  fromCatalogue,
  movePainting,
  parseDraft,
  removeHero,
  removePainting,
  removeSet,
  serializePaintingData,
  toCatalogue,
  toggleStat,
  unusedHeroes,
  updatePainting,
  updateSet,
  type EditorPainting,
  type EditorSet,
  type EditorState,
  type Problem,
} from "../../lib/content/artwork-editor";
import { HERO_RARITIES } from "../../lib/content/heroes";
import type { Dictionary } from "../../lib/i18n";
import { ARTWORK_CATALOGUE_DRAFT_STORAGE_KEY } from "../../lib/site";
import { HeroAvatar } from "../components/HeroAvatar";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, TrashIcon } from "../components/Icons";

type Guide = Dictionary["guideEntries"]["artwork"];
type EditorText = Dictionary["artworkEditor"];

const PUBLISHED = fromCatalogue({ sets: PAINTING_SETS });
const PUBLISHED_DATA = toCatalogue(PUBLISHED);

const draftStore = createPersistentStore<EditorState | null>({
  key: ARTWORK_CATALOGUE_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

type Ctx = {
  state: EditorState;
  commit: (next: EditorState) => void;
  guide: Guide;
  e: EditorText;
  tf: (template: string, values: Record<string, string | number>) => string;
};

export function ArtworkEditor() {
  const { t, tf } = useLocale();
  const guide = t.guideEntries.artwork;
  const e = t.artworkEditor;

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED;
  const commit = (next: EditorState) => draftStore.set(next);
  const ctx: Ctx = { state, commit, guide, e, tf };

  const [rarity, setRarity] = useState<PaintingRarity>("SSR");
  const [setUid, setSetUid] = useState<string | null>(null);
  const [paintingUid, setPaintingUid] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const base = useId();

  const draftData = useMemo(() => toCatalogue(state), [state]);
  const changes = useMemo(() => countChanges(PUBLISHED_DATA, draftData), [draftData]);
  const visible = state.sets.filter((set) => set.rarity === rarity);
  const activeSet = setUid ? findSet(state, setUid) : undefined;
  const activePainting = paintingUid ? findPainting(state, paintingUid) : null;

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
    setSetUid(null);
    setPaintingUid(null);
  };

  const add = () => {
    const result = addSet(state, rarity);
    commit(result.state);
    setSetUid(result.uid);
    setPaintingUid(null);
  };

  const tabId = (id: PaintingRarity) => `${base}-tab-${id}`;
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = PAINTING_RARITIES.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : null;
    if (next === null) return;
    event.preventDefault();
    setRarity(PAINTING_RARITIES[next]);
    document.getElementById(tabId(PAINTING_RARITIES[next]))?.focus();
  };

  return (
    <div className="hero-tiers tier-editor artwork-layout-editor artwork-layouts">
      <BackLink href="/guides/artwork/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <div className="build-tabs" role="tablist" aria-label={guide.setsHeading}>
          {PAINTING_RARITIES.map((tier, index) => {
            const selected = tier === rarity;
            return (
              <button
                key={tier}
                id={tabId(tier)}
                type="button"
                role="tab"
                className="build-tab"
                data-build={tier}
                aria-selected={selected}
                aria-controls={`${base}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => { setRarity(tier); setSetUid(null); setPaintingUid(null); }}
                onKeyDown={(event) => onTabKey(event, index)}
              >
                <span className="build-dot" aria-hidden="true" />
                {tier}
              </button>
            );
          })}
        </div>
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0 ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={add}>{e.addSet}</button>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>{e.export}</button>
        </div>
      </div>

      <div className="layout-edit-board artwork-cat-board" id={`${base}-panel`} role="tabpanel" aria-labelledby={tabId(rarity)} data-build={rarity}>
        <ul className="artwork-cat-sets">
          {visible.map((set) => (
            <li key={set.uid}>
              <button
                type="button"
                className={set.uid === activeSet?.uid ? "artwork-cat-set is-selected" : "artwork-cat-set"}
                aria-pressed={set.uid === activeSet?.uid}
                onClick={() => { setSetUid(set.uid); setPaintingUid(null); }}
              >
                <strong>{set.name.trim() || e.unnamedSet}</strong>
                <span>{tf(e.paintingCount, { count: set.paintings.length })}</span>
              </button>
            </li>
          ))}
        </ul>
        {visible.length === 0 ? <p className="tier-small">{e.emptyRarity}</p> : null}

        {activeSet ? (
          <SetForm
            ctx={ctx}
            set={activeSet}
            paintingUid={activePainting?.set.uid === activeSet.uid ? paintingUid : null}
            onSelectPainting={setPaintingUid}
            onRemoved={() => { setSetUid(null); setPaintingUid(null); }}
            onRarity={(next) => setRarity(next)}
          />
        ) : (
          <p className="tier-small">{e.selectHint}</p>
        )}
      </div>

      {exportOpen ? <ExportDialog ctx={ctx} data={draftData} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}

function SetForm({
  ctx,
  set,
  paintingUid,
  onSelectPainting,
  onRemoved,
  onRarity,
}: {
  ctx: Ctx;
  set: EditorSet;
  paintingUid: string | null;
  onSelectPainting: (uid: string | null) => void;
  onRemoved: () => void;
  onRarity: (rarity: PaintingRarity) => void;
}) {
  const id = useId();
  const { state, commit, e, tf } = ctx;
  const selected = paintingUid ? set.paintings.find((canvas) => canvas.uid === paintingUid) : undefined;

  const remove = () => {
    if (!window.confirm(tf(e.removeSetConfirm, { set: set.name.trim() || e.unnamedSet }))) return;
    commit(removeSet(state, set.uid));
    onRemoved();
  };

  const add = () => {
    const result = addPainting(state, set.uid);
    if (!result) return;
    commit(result.state);
    onSelectPainting(result.uid);
  };

  return (
    <div className="layout-edit-newbuild artwork-cat-form">
      <div className="tier-edit-form-head">
        <h2>{e.inspectorSet}</h2>
        <button type="button" className="small-button button-danger" onClick={remove} disabled={state.sets.length <= 1}>
          <TrashIcon className="icon icon-sm" />
          {e.removeSet}
        </button>
      </div>
      <div className="field">
        <label htmlFor={`${id}-name`}>{e.fieldSetName}</label>
        <input id={`${id}-name`} value={set.name} onChange={(event) => commit(updateSet(state, set.uid, { name: event.target.value }))} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-rarity`}>{e.fieldRarity}</label>
        <select
          id={`${id}-rarity`}
          value={set.rarity}
          onChange={(event) => {
            const next = event.target.value as PaintingRarity;
            commit(updateSet(state, set.uid, { rarity: next }));
            onRarity(next);
          }}
        >
          {PAINTING_RARITIES.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-effect`}>{e.fieldEffect}</label>
        <textarea id={`${id}-effect`} rows={3} value={set.effect} onChange={(event) => commit(updateSet(state, set.uid, { effect: event.target.value }))} />
      </div>

      <h3>{e.paintingsHeading}</h3>
      <ol className="layout-edit-list">
        {set.paintings.map((canvas, index) => (
          <li key={canvas.uid} className="layout-edit-row artwork-cat-row">
            <label className="layout-edit-rank">
              <span className="visually-hidden">{e.fieldRank}</span>
              <select
                value={index}
                aria-label={tf(e.rankOf, { name: canvas.name.trim() || e.unnamedPainting })}
                onChange={(event) => commit(movePainting(state, canvas.uid, Number(event.target.value)))}
              >
                {set.paintings.map((_, rank) => <option key={rank} value={rank}>{rank + 1}</option>)}
              </select>
            </label>
            <button
              type="button"
              className={canvas.uid === selected?.uid ? "artwork-cat-pick is-selected" : "artwork-cat-pick"}
              aria-pressed={canvas.uid === selected?.uid}
              onClick={() => onSelectPainting(canvas.uid)}
            >
              {canvas.name.trim() || e.unnamedPainting}
            </button>
          </li>
        ))}
      </ol>
      {set.paintings.length === 0 ? <p className="tier-small">{e.emptySet}</p> : null}
      <button className="button" type="button" onClick={add}>{e.addPainting}</button>

      {selected ? <PaintingForm ctx={ctx} canvas={selected} onClose={() => onSelectPainting(null)} /> : null}
    </div>
  );
}

function PaintingForm({ ctx, canvas, onClose }: { ctx: Ctx; canvas: EditorPainting; onClose: () => void }) {
  const id = useId();
  const { state, commit, e, tf } = ctx;
  const available = unusedHeroes(canvas);

  const remove = () => {
    if (!window.confirm(tf(e.removePaintingConfirm, { painting: canvas.name.trim() || e.unnamedPainting }))) return;
    commit(removePainting(state, canvas.uid));
    onClose();
  };

  return (
    <div className="artwork-cat-painting">
      <div className="tier-edit-form-head">
        <h3>{e.inspectorPainting}</h3>
        <button type="button" className="icon-button" aria-label={e.close} onClick={onClose}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>
      <div className="field">
        <label htmlFor={`${id}-name`}>{e.fieldPaintingName}</label>
        <input id={`${id}-name`} value={canvas.name} onChange={(event) => commit(updatePainting(state, canvas.uid, { name: event.target.value }))} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-prod`}>{e.fieldProductivity}</label>
        <input id={`${id}-prod`} value={canvas.productivity} onChange={(event) => commit(updatePainting(state, canvas.uid, { productivity: event.target.value }))} />
      </div>
      <StatField ctx={ctx} canvas={canvas} field="stats" label={e.fieldStats} />
      <StatField ctx={ctx} canvas={canvas} field="starStats" label={e.fieldStarStats} />

      <fieldset className="artwork-cat-heroes">
        <legend>{e.fieldHeroes}</legend>
        {canvas.heroes.length === 0 ? <p className="tier-small">{e.noHeroes}</p> : (
          <ul className="pick-list">
            {canvas.heroes.map((hero) => (
              <li className="pick" key={hero}>
                <HeroAvatar name={hero} />
                <span className="pick-name">{hero}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={tf(e.removeHeroNamed, { hero })}
                  onClick={() => commit(removeHero(state, canvas.uid, hero))}
                >
                  <CloseIcon className="icon icon-sm" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {available.length === 0 ? <p className="tier-small">{e.allHeroesUsed}</p> : (
          <div className="field">
            <label htmlFor={`${id}-hero`}>{e.addHero}</label>
            <select
              id={`${id}-hero`}
              value=""
              onChange={(event) => {
                if (event.target.value) commit(addHero(state, canvas.uid, event.target.value));
              }}
            >
              <option value="">{e.addHeroPlaceholder}</option>
              {HERO_RARITIES.map((tier) => {
                const heroes = available.filter((hero) => hero.rarity === tier);
                if (heroes.length === 0) return null;
                return (
                  <optgroup key={tier} label={tier}>
                    {heroes.map((hero) => (
                      <option key={hero.id} value={hero.name}>{hero.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
        )}
      </fieldset>

      <button type="button" className="small-button button-danger" onClick={remove}>
        <TrashIcon className="icon icon-sm" />
        {e.removePainting}
      </button>
    </div>
  );
}

function StatField({
  ctx,
  canvas,
  field,
  label,
}: {
  ctx: Ctx;
  canvas: EditorPainting;
  field: "stats" | "starStats";
  label: string;
}) {
  const selected = canvas[field];
  return (
    <fieldset className="artwork-cat-stats">
      <legend>{label}</legend>
      <div className="tier-edit-role-grid">
        {PAINTING_STATS.map((stat) => (
          <label key={stat} className={selected.includes(stat) ? "tier-edit-role is-on" : "tier-edit-role"}>
            <input
              type="checkbox"
              checked={selected.includes(stat)}
              onChange={() => ctx.commit(toggleStat(ctx.state, canvas.uid, field, stat))}
            />
            {ctx.guide.stats[stat]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function problemText(ctx: Ctx, problem: Problem): string {
  switch (problem.code) {
    case "emptySetName": return ctx.tf(ctx.e.problemEmptySetName, { set: problem.id });
    case "emptyPaintingName": return ctx.tf(ctx.e.problemEmptyPaintingName, { set: problem.set, painting: problem.id });
    case "emptySet": return ctx.tf(ctx.e.problemEmptySet, { set: problem.id });
    case "duplicateSet": return ctx.tf(ctx.e.problemDuplicateSet, { set: problem.id });
    case "duplicatePainting": return ctx.tf(ctx.e.problemDuplicatePainting, { painting: problem.id });
    case "urPlusHero": return ctx.tf(ctx.e.problemUrPlus, { set: problem.set, painting: problem.painting, hero: problem.hero });
    case "duplicateHero": return ctx.tf(ctx.e.problemDuplicateHero, { set: problem.set, painting: problem.painting, hero: problem.hero });
  }
}

function ExportDialog({ ctx, data, onClose }: { ctx: Ctx; data: ReturnType<typeof toCatalogue>; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const json = useMemo(() => serializePaintingData(data), [data]);
  const problems = useMemo(() => findProblems(ctx.state), [ctx.state]);

  const copy = (value: string) =>
    navigator.clipboard?.writeText(value).then(() => setCopied("json"), () => { /* clipboard blocked */ });
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "paintings.json";
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
        <h2 id={`${id}-title`}>{ctx.e.exportTitle}</h2>
        <button type="button" className="icon-button" aria-label={ctx.e.close} onClick={() => dialog.current?.close()}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>
      <p className="tier-small">{ctx.e.exportLede}</p>
      {problems.length > 0 ? (
        <div className="notice notice-warn tier-export-problems" role="alert">
          <div>
            <strong>{ctx.e.problemsTitle}</strong>
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(ctx, problem)}</li>)}</ul>
          </div>
        </div>
      ) : null}
      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/paintings.json</code>
          <div className="tier-edit-row-actions">
            <button className="small-button" type="button" onClick={() => void copy(json)}>
              {copied === "json" ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied === "json" ? ctx.e.copied : ctx.e.copy}
            </button>
            <button className="small-button" type="button" onClick={download}>
              <DownloadIcon className="icon icon-sm" />
              {ctx.e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/paintings.json" />
      </div>
    </dialog>
  );
}
