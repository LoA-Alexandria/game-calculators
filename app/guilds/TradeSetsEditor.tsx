"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  addItem,
  addSet,
  countTradeChanges,
  exportTrade,
  findTradeProblems,
  fromTradeData,
  itemId,
  parseTradeDraft,
  partsOf,
  removeItem,
  removeSet,
  serializeTradeData,
  setGroupParts,
  setItem,
  setOf,
  setSetField,
  type EditorTradeItem,
  type EditorTradeSet,
  type TradeEditorState,
  type TradeProblem,
} from "../../lib/content/trade-sets-editor";
import {
  TRADE_ITEM_KINDS,
  tradeItemUrl,
  type TradeItemKind,
  type TradeSet,
} from "../../lib/content/guild-trade";
import { TRADE_SETS_DRAFT_STORAGE_KEY } from "../../lib/site";
import { type Dictionary } from "../../lib/i18n";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { SaveToSite } from "../guides/SaveToSite";
import { useGuideData } from "../guides/GuideOverrides";

type EditorText = Dictionary["tradeSetsEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const draftStore = createPersistentStore<TradeEditorState | null>({
  key: TRADE_SETS_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseTradeDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

type Ctx = {
  state: TradeEditorState;
  commit: (next: TradeEditorState) => void;
  e: EditorText;
  tf: Tf;
  kindName: (kind: TradeItemKind) => string;
};

function problemText(e: EditorText, tf: Tf, problem: TradeProblem): string {
  if (problem.code === "noSetName") return e.problemNoSetName;
  if (problem.code === "duplicateSet") return tf(e.problemDuplicateSet, { id: problem.id });
  if (problem.code === "noItemName") return tf(e.problemNoItemName, { set: problem.set });
  if (problem.code === "duplicateItem") return tf(e.problemDuplicateItem, { set: problem.set, id: problem.id });
  if (problem.code === "emptySet") return tf(e.problemEmptySet, { set: problem.set });
  return tf(e.problemPartsMismatch, {
    set: problem.set,
    item: problem.item,
    has: problem.has,
    wants: problem.wants,
  });
}

function ItemRow({ ctx, set, item }: { ctx: Ctx; set: EditorTradeSet; item: EditorTradeItem }) {
  const { state, commit, e, tf, kindName } = ctx;
  const ids = useId();
  const id = itemId(item);
  const wants = Number(set.groups.find((group) => group.kind === item.kind)?.parts ?? 0);
  const off = partsOf(item.parts).length !== wants;

  return (
    <li className="panel ts-edit-row">
      <div className="ts-edit-head">
        {id ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ts-edit-art" src={tradeItemUrl(set.id, id)} alt="" width={44} height={44} loading="lazy" decoding="async" />
        ) : (
          <span className="ts-edit-art is-empty" aria-hidden="true" />
        )}
        <strong>{item.name.trim() || e.newItem}</strong>
        <code className="tier-small">{id || "—"}</code>
        <button
          type="button"
          className="small-button button-danger"
          onClick={() => commit(removeItem(state, set.uid, item.uid))}
        >
          <TrashIcon className="icon icon-sm" />
          {tf(e.removeItem, { item: item.name.trim() || e.newItem })}
        </button>
      </div>
      <div className="ts-edit-fields">
        <div className="field">
          <label htmlFor={`${ids}-name`}>{e.fieldItemName}</label>
          <input
            id={`${ids}-name`}
            value={item.name}
            onChange={(event) => commit(setItem(state, set.uid, item.uid, { name: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-kind`}>{e.fieldKind}</label>
          <select
            id={`${ids}-kind`}
            value={item.kind}
            onChange={(event) =>
              commit(setItem(state, set.uid, item.uid, { kind: event.target.value as TradeItemKind }))
            }
          >
            {TRADE_ITEM_KINDS.map((kind) => (
              <option key={kind} value={kind}>{kindName(kind)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${ids}-parts`}>{e.fieldParts}</label>
          <input
            id={`${ids}-parts`}
            value={item.parts}
            aria-invalid={off || undefined}
            placeholder={e.partsHint}
            onChange={(event) => commit(setItem(state, set.uid, item.uid, { parts: event.target.value }))}
          />
        </div>
      </div>
    </li>
  );
}

function SetPanel({ ctx, set }: { ctx: Ctx; set: EditorTradeSet }) {
  const { state, commit, e, tf, kindName } = ctx;
  const ids = useId();

  return (
    <section className="ts-edit-set">
      <div className="ts-edit-set-head">
        <h2>{set.name.trim() || e.newSet}</h2>
        <button
          type="button"
          className="small-button button-danger"
          onClick={() => commit(removeSet(state, set.uid))}
        >
          <TrashIcon className="icon icon-sm" />
          {e.removeSet}
        </button>
      </div>

      <div className="ts-edit-fields">
        <div className="field">
          <label htmlFor={`${ids}-name`}>{e.fieldSetName}</label>
          <input
            id={`${ids}-name`}
            value={set.name}
            onChange={(event) => commit(setSetField(state, set.uid, { name: event.target.value }))}
          />
        </div>
        {set.groups.map((group) => (
          <div className="field" key={group.kind}>
            <label htmlFor={`${ids}-${group.kind}`}>{tf(e.fieldGroupParts, { kind: kindName(group.kind) })}</label>
            <input
              id={`${ids}-${group.kind}`}
              inputMode="numeric"
              value={group.parts}
              onChange={(event) => commit(setGroupParts(state, set.uid, group.kind, event.target.value))}
            />
          </div>
        ))}
      </div>
      <p className="tier-small">{tf(e.picturesHint, { folder: `public/trade/${set.id || "…"}/` })}</p>

      <div className="form-actions">
        {TRADE_ITEM_KINDS.map((kind) => (
          <button
            key={kind}
            className="button"
            type="button"
            onClick={() => commit(addItem(state, set.uid, kind).state)}
          >
            <PlusIcon className="icon icon-sm" />
            {tf(e.addItem, { kind: kindName(kind) })}
          </button>
        ))}
      </div>

      <ol className="ts-edit-list">
        {set.items.map((item) => <ItemRow key={item.uid} ctx={ctx} set={set} item={item} />)}
      </ol>
    </section>
  );
}

function ExportDialog({ ctx, problems, onClose }: { ctx: Ctx; problems: TradeProblem[]; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const { state, e, tf } = ctx;
  const json = useMemo(() => serializeTradeData(exportTrade(state)), [state]);

  const copy = () => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => { /* clipboard blocked */ });
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "trade-sets.json";
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
            <ul>{problems.map((problem, index) => <li key={index}>{problemText(e, tf, problem)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/trade-sets.json</code>
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
        <textarea readOnly value={json} rows={10} spellCheck={false} aria-label="lib/data/trade-sets.json" />
      </div>
    </dialog>
  );
}

/**
 * The furniture sets the guild trade board is built on.
 *
 * A set is one event: how many parts a piece of each kind takes, and the
 * pieces themselves. Adding next season's set here is all a guild needs to
 * start marking parts; the pictures still travel with a commit, because a
 * piece's tile is named after its id under `public/trade/`.
 */
export function TradeSetsEditor() {
  const { t, tf } = useLocale();
  const e = t.tradeSetsEditor;

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  // The editor opens on what the site serves, not on the built file.
  const liveData = useGuideData<{ sets: TradeSet[] }>("trade-sets");
  const published = useMemo(() => fromTradeData(liveData), [liveData]);
  const state = draft ?? published;
  const commit = (next: TradeEditorState) => draftStore.set(next);

  const [exportOpen, setExportOpen] = useState(false);
  const savePayload = useMemo(() => exportTrade(state), [state]);
  const changes = useMemo(() => countTradeChanges(published, state), [published, state]);
  const problems = useMemo(() => findTradeProblems(state), [state]);

  // The board already names the three groups; the editor borrows those words.
  const kindName = (kind: TradeItemKind) =>
    ({ ur: t.guilds.trade.groupUr, choice: t.guilds.trade.groupChoice, ssr: t.guilds.trade.groupSsr })[kind];
  const ctx: Ctx = { state, commit, e, tf, kindName };

  const add = () => {
    const result = addSet(state);
    commit(result.state);
    window.requestAnimationFrame(() => {
      const panel = document.getElementById(`set-${result.uid}`);
      panel?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
  };

  return (
    <div className="trade-sets-editor">
      <BackLink href="/guilds/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0
              ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}`
              : e.unchanged}
          </span>
          <button className="button" type="button" onClick={add}>
            <PlusIcon className="icon icon-sm" />
            {e.addSet}
          </button>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <SaveToSite file="trade-sets" data={savePayload} />
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

      {state.sets.map((set) => (
        <div id={`set-${set.uid}`} key={set.uid}>
          <SetPanel ctx={ctx} set={setOf(state, set.uid) ?? set} />
        </div>
      ))}

      {exportOpen ? <ExportDialog ctx={ctx} problems={problems} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}
