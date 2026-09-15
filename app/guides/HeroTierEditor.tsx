"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TIER_DATA, TIER_IDS, parseGrade, type TierId } from "../../lib/content/hero-tiers";
import {
  LIST_IDS,
  addGroup,
  addItem,
  addText,
  containerId,
  countChanges,
  dictionarySnippet,
  findItem,
  findProblems,
  fromTierData,
  moveItem,
  moveToGroup,
  parseDraft,
  publishedText,
  removeItem,
  serializeTierData,
  setOrdered,
  textFor,
  textKeyFrom,
  toTierData,
  updateItem,
  TEXT_GROUPS,
  type Container,
  type EditorItem,
  type EditorState,
  type ListId,
  type LooseEntry,
  type Problem,
  type TextGroup,
  type Translations,
} from "../../lib/content/hero-tier-editor";
import { DEFAULT_LOCALE, type Dictionary, type Locale } from "../../lib/i18n";
import { TIER_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, NewTextForm, WordingEditor, useEditorLanguages } from "../components/EditorLanguages";
import { HeroAvatar } from "../components/HeroAvatar";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, GripIcon, PlusIcon, TrashIcon } from "../components/Icons";

type Text = Dictionary["guideEntries"]["heroTierList"];
type EditorText = Dictionary["tierEditor"];

const PUBLISHED = fromTierData(TIER_DATA);
const PUBLISHED_DATA = toTierData(PUBLISHED);

/**
 * The draft lives in localStorage through the same external-store shape the
 * language and theme use, so the exported HTML (no draft) hydrates cleanly and
 * a second tab sees edits from the first.
 */
const draftStore = createPersistentStore<EditorState | null>({
  key: TIER_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

type Ctx = {
  state: EditorState;
  commit: (next: EditorState) => void;
  list: ListId;
  text: Text;
  e: EditorText;
  tf: (template: string, values: Record<string, string | number>) => string;
  labelFor: (group: TextGroup, key?: string) => string;
  keysFor: (group: TextGroup) => string[];
  languages: readonly Locale[];
};

function listLabel(text: Text, list: ListId): string {
  return { overall: text.tabOverall, battle: text.tabBattle, utility: text.tabUtility, productivity: text.tabProductivity }[list];
}

function summaryOf(ctx: Ctx, entry: LooseEntry): string {
  if (ctx.list === "overall") return [entry.battle, entry.utility, entry.productivity].map((grade) => grade || "—").join(" / ");
  if (ctx.list === "battle") return (entry.roles ?? []).map((role) => ctx.labelFor("roles", role)).join(" · ");
  if (ctx.list === "utility") return ctx.labelFor("effects", entry.effect);
  return `${(entry.bonus ?? []).map((value) => `+${value}`).join(" / ")} %`;
}

export function HeroTierEditor() {
  const { t, tf } = useLocale();
  const text = t.guideEntries.heroTierList;
  const e = t.tierEditor;
  const { language, languages } = useEditorLanguages();

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED;
  const commit = (next: EditorState) => draftStore.set(next);

  const [list, setList] = useState<ListId>("overall");
  const [selected, setSelected] = useState<string | null>(null);
  const [dragState, setDragState] = useState<EditorState | null>(null);
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const base = useId();
  // dnd-kit numbers its screen reader description with a module counter unless
  // given an id, and the server and browser counters differ on hydration.
  const dndId = useId();

  const view = dragState ?? state;

  const labelFor = (group: TextGroup, key?: string) => (key ? textFor(state.texts, group, key, language) : "");
  const keysFor = (group: TextGroup) => {
    const known = Object.keys(text[group]);
    return [...known, ...Object.keys(state.texts[group]).filter((key) => !known.includes(key))];
  };
  const ctx: Ctx = { state, commit, list, text, e, tf, labelFor, keysFor, languages };

  const draftData = useMemo(() => toTierData(state), [state]);
  const changes = useMemo(() => countChanges(PUBLISHED_DATA, draftData), [draftData]);
  const totalChanges = LIST_IDS.reduce((sum, id) => sum + changes[id], 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containerOf = (id: UniqueIdentifier, source: EditorState): Container | null => {
    const key = String(id);
    if (key.includes("|")) return source.lists[list].find((container) => container.id === key) ?? null;
    return findItem(source, list, key)?.container ?? null;
  };
  const nameOf = (id: UniqueIdentifier) => {
    const found = findItem(view, list, String(id));
    return found?.container.items[found.index].entry.hero.trim() || e.unnamed;
  };
  const tierOf = (id: UniqueIdentifier) => containerOf(id, view)?.tier ?? "";

  const onDragStart = ({ active }: DragStartEvent) => {
    setDragState(state);
    setActiveUid(String(active.id));
  };
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const current = dragState ?? state;
    const from = containerOf(active.id, current);
    const to = containerOf(over.id, current);
    if (!from || !to || from.id === to.id) return;
    const overIndex = String(over.id).includes("|") ? to.items.length : to.items.findIndex((item) => item.uid === String(over.id));
    setDragState(moveItem(current, list, String(active.id), to.id, overIndex < 0 ? to.items.length : overIndex));
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const current = dragState ?? state;
    let next = current;
    if (over && !String(over.id).includes("|")) {
      const found = findItem(current, list, String(active.id));
      const to = containerOf(over.id, current);
      const overIndex = to ? to.items.findIndex((item) => item.uid === String(over.id)) : -1;
      if (found && to && found.container.id === to.id && overIndex >= 0 && overIndex !== found.index) {
        next = moveItem(current, list, String(active.id), to.id, overIndex);
      }
    }
    setDragState(null);
    setActiveUid(null);
    if (next !== state) commit(next);
  };
  const onDragCancel = () => {
    setDragState(null);
    setActiveUid(null);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => tf(e.announceStart, { hero: nameOf(active.id) }),
    onDragOver: ({ active, over }) => (over ? tf(e.announceOver, { hero: nameOf(active.id), tier: tierOf(over.id) }) : undefined),
    onDragEnd: ({ active, over }) => (over ? tf(e.announceEnd, { hero: nameOf(active.id), tier: tierOf(over.id) }) : undefined),
    onDragCancel: ({ active }) => tf(e.announceCancel, { hero: nameOf(active.id) }),
  };

  const add = (target: string) => {
    const result = addItem(state, list, target);
    commit(result.state);
    setSelected(result.uid);
  };

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
    setSelected(null);
  };

  const tabId = (id: ListId) => `${base}-tab-${id}`;
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = LIST_IDS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : null;
    if (next === null) return;
    event.preventDefault();
    setList(LIST_IDS[next]);
    setSelected(null);
    document.getElementById(tabId(LIST_IDS[next]))?.focus();
  };

  const activeItem = activeUid ? findItem(view, list, activeUid) : null;
  const selectedFound = selected ? findItem(state, list, selected) : null;

  return (
    <div className="hero-tiers tier-editor">
      <BackLink href="/guides/hero-tier-list/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <div className="tier-tabs" role="tablist" aria-label={text.listsLabel}>
          {LIST_IDS.map((id, index) => (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              className="tier-tab"
              aria-selected={list === id}
              aria-controls={`${base}-panel`}
              tabIndex={list === id ? 0 : -1}
              onClick={() => { setList(id); setSelected(null); }}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              {listLabel(text, id)}
              {changes[id] > 0 ? <span className="tier-edit-count">{changes[id]}</span> : null}
            </button>
          ))}
        </div>
        <div className="tier-edit-actions">
          <AllLanguagesToggle />
          <span className="tier-edit-status" aria-live="polite">
            {totalChanges > 0 ? `${totalChanges === 1 ? e.changeOne : tf(e.changes, { count: totalChanges })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>{e.export}</button>
        </div>
      </div>

      <div className="tier-edit-layout" id={`${base}-panel`} role="tabpanel" aria-labelledby={tabId(list)}>
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          accessibility={{ announcements, screenReaderInstructions: { draggable: e.dragInstructions } }}
        >
          <div className="tier-board tier-edit-board">
            {TIER_IDS.map((tier) => {
              const containers = view.lists[list].filter((container) => container.tier === tier);
              return (
                <section className="tier-row" data-tier={tier} key={tier} aria-label={tier}>
                  <div className="tier-badge" aria-hidden="true">{tier}</div>
                  <div className="tier-content">
                    {list === "overall" ? (
                      <label className="tier-edit-check">
                        <input
                          type="checkbox"
                          checked={Boolean(containers[0]?.ordered)}
                          onChange={(event) => commit(setOrdered(state, tier, event.target.checked))}
                        />
                        {e.ordered}
                      </label>
                    ) : null}
                    {containers.map((container) => (
                      <div className="tier-edit-group" key={container.id}>
                        {container.resource ? <h4>{labelFor("resources", container.resource)}</h4> : null}
                        <DropList
                          ctx={ctx}
                          container={container}
                          selected={selected}
                          onSelect={setSelected}
                          onAdd={() => add(container.id)}
                        />
                      </div>
                    ))}
                    {list === "productivity" ? (
                      <AddGroup ctx={ctx} tier={tier} existing={containers.map((container) => container.resource ?? "")} />
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
          <DragOverlay>
            {activeItem ? (
              <div className="tier-edit-item is-overlay">
                <span className="tier-edit-handle"><GripIcon className="icon icon-sm" /></span>
                <span className="tier-edit-card">
                  <span className="tier-hero-name">{activeItem.container.items[activeItem.index].entry.hero || e.unnamed}</span>
                  <span className="tier-edit-summary">{summaryOf(ctx, activeItem.container.items[activeItem.index].entry)}</span>
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <aside className={selectedFound ? "tier-edit-inspector is-open" : "tier-edit-inspector"} aria-label={e.inspectorTitle}>
          {selectedFound ? (
            <Inspector
              key={selectedFound.container.items[selectedFound.index].uid}
              ctx={ctx}
              item={selectedFound.container.items[selectedFound.index]}
              container={selectedFound.container}
              onClose={() => setSelected(null)}
            />
          ) : (
            <p className="tier-small">{e.selectHint}</p>
          )}
        </aside>
      </div>

      {exportOpen ? <ExportDialog ctx={ctx} data={draftData} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}

function DropList({
  ctx,
  container,
  selected,
  onSelect,
  onAdd,
}: {
  ctx: Ctx;
  container: Container;
  selected: string | null;
  onSelect: (uid: string) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: container.id });
  return (
    <SortableContext items={container.items.map((item) => item.uid)} strategy={rectSortingStrategy}>
      <ul ref={setNodeRef} className={isOver ? "tier-edit-list is-over" : "tier-edit-list"}>
        {container.items.map((item) => (
          <SortableHero key={item.uid} ctx={ctx} item={item} selected={selected === item.uid} onSelect={() => onSelect(item.uid)} />
        ))}
        {container.items.length === 0 ? <li className="tier-edit-empty" aria-hidden="true">{ctx.e.emptyTier}</li> : null}
        <li className="tier-edit-add-item">
          <button type="button" className="tier-edit-add" onClick={onAdd}>
            <PlusIcon className="icon icon-sm" />
            {ctx.e.addHero}
          </button>
        </li>
      </ul>
    </SortableContext>
  );
}

function SortableHero({ ctx, item, selected, onSelect }: { ctx: Ctx; item: EditorItem; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid });
  const name = item.entry.hero.trim() || ctx.e.unnamed;
  return (
    <li
      ref={setNodeRef}
      className={["tier-edit-item", selected ? "is-selected" : "", isDragging ? "is-dragging" : ""].filter(Boolean).join(" ")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="tier-edit-handle"
        aria-label={ctx.tf(ctx.e.dragHandle, { hero: name })}
        {...attributes}
        {...listeners}
      >
        <GripIcon className="icon icon-sm" />
      </button>
      <button type="button" className="tier-edit-card" aria-pressed={selected} onClick={onSelect}>
        <HeroAvatar name={item.entry.hero} className="pick-avatar tier-avatar" />
        <span className="tier-hero-name">{name}</span>
        {item.entry.variant ? <small>{ctx.labelFor("variants", item.entry.variant)}</small> : null}
        <span className="tier-edit-summary">{summaryOf(ctx, item.entry)}</span>
      </button>
    </li>
  );
}

function AddGroup({ ctx, tier, existing }: { ctx: Ctx; tier: TierId; existing: string[] }) {
  const id = useId();
  const options = ctx.keysFor("resources").filter((key) => !existing.includes(key));
  if (options.length === 0) return null;
  return (
    <div className="tier-edit-add-group">
      <label className="visually-hidden" htmlFor={id}>{ctx.tf(ctx.e.addGroupLabel, { tier })}</label>
      <select
        id={id}
        value=""
        onChange={(event) => { if (event.target.value) ctx.commit(addGroup(ctx.state, tier, event.target.value)); }}
      >
        <option value="">{`+ ${ctx.e.addGroup}`}</option>
        {options.map((key) => <option key={key} value={key}>{ctx.labelFor("resources", key)}</option>)}
      </select>
    </div>
  );
}

/**
 * The wording of a text that is already picked, in the editor's languages. It
 * changes the text everywhere the key is used, and the export lists the new
 * wording for each dictionary.
 */
function TextWording({ ctx, group, textKey }: { ctx: Ctx; group: TextGroup; textKey: string }) {
  const current = ctx.state.texts[group][textKey] ?? publishedText(group, textKey);
  return (
    <WordingEditor
      languages={ctx.languages}
      current={current}
      multiline={group === "reasons" || group === "notes"}
      rows={group === "reasons" ? 4 : 2}
      onChange={(locale, value) => ctx.commit(addText(ctx.state, group, textKey, { ...current, [locale]: value }))}
    />
  );
}

const NEW_TEXT = "__new__";

function TextSelect({
  ctx,
  group,
  label,
  value,
  optional,
  onPick,
}: {
  ctx: Ctx;
  group: TextGroup;
  label: string;
  value?: string;
  optional?: boolean;
  onPick: (key: string | undefined, created?: Translations) => void;
}) {
  const id = useId();
  const [creating, setCreating] = useState(false);
  const keys = ctx.keysFor(group);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={creating ? NEW_TEXT : value ?? ""}
        onChange={(event) => {
          if (event.target.value === NEW_TEXT) { setCreating(true); return; }
          setCreating(false);
          onPick(event.target.value || undefined);
        }}
      >
        {optional || !value ? <option value="">{ctx.e.none}</option> : null}
        {value && !keys.includes(value) ? <option value={value}>{value}</option> : null}
        {keys.map((key) => <option key={key} value={key}>{ctx.labelFor(group, key)}</option>)}
        <option value={NEW_TEXT}>{ctx.e.newText}</option>
      </select>
      {creating ? (
        <NewTextForm
          onCancel={() => setCreating(false)}
          onAdd={(created) => {
            setCreating(false);
            onPick(textKeyFrom(created[DEFAULT_LOCALE], [...keys, ...Object.keys(ctx.state.texts[group])]), created);
          }}
        />
      ) : value ? (
        <TextWording key={`${group}-${value}`} ctx={ctx} group={group} textKey={value} />
      ) : null}
    </div>
  );
}

function GradeField({ ctx, label, value, onChange }: { ctx: Ctx; label: string; value?: string; onChange: (grade: string | undefined) => void }) {
  const id = useId();
  const parsed = value ? parseGrade(value) : null;
  const compose = (tier: string, to: string, fine: string, flagged: boolean) =>
    tier ? `${tier}${to ? `>${to}` : ""}${fine ? `(${fine})` : ""}${flagged ? "*" : ""}` : undefined;
  const current = { tier: parsed?.tier ?? "", to: parsed?.to ?? "", fine: parsed?.fine ?? "", flagged: parsed?.flagged ?? false };
  const set = (patch: Partial<typeof current>) => {
    const next = { ...current, ...patch };
    onChange(compose(next.tier, next.to, next.fine, next.flagged));
  };
  return (
    <fieldset className="tier-edit-grade">
      <legend>{label}</legend>
      {value && !parsed ? <p className="tier-edit-warning">{value}</p> : null}
      <label className="visually-hidden" htmlFor={`${id}-tier`}>{ctx.e.gradeTier}</label>
      <select id={`${id}-tier`} value={current.tier} onChange={(event) => set({ tier: event.target.value })}>
        <option value="">{ctx.e.none}</option>
        {TIER_IDS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
      </select>
      <label className="visually-hidden" htmlFor={`${id}-to`}>{ctx.e.gradeTo}</label>
      <select id={`${id}-to`} value={current.to} disabled={!current.tier} onChange={(event) => set({ to: event.target.value })} title={ctx.e.gradeTo}>
        <option value="">→ {ctx.e.none}</option>
        {TIER_IDS.map((tier) => <option key={tier} value={tier}>→ {tier}</option>)}
      </select>
      <label className="visually-hidden" htmlFor={`${id}-fine`}>{ctx.e.gradeFine}</label>
      <select id={`${id}-fine`} value={current.fine} disabled={!current.tier} onChange={(event) => set({ fine: event.target.value })} title={ctx.e.gradeFine}>
        <option value="">( {ctx.e.none} )</option>
        <option value="SS+">(SS+)</option>
        <option value="S+">(S+)</option>
      </select>
      <label className="tier-edit-check">
        <input type="checkbox" checked={current.flagged} disabled={!current.tier} onChange={(event) => set({ flagged: event.target.checked })} />
        {ctx.e.gradeFlag}
      </label>
    </fieldset>
  );
}

function Inspector({ ctx, item, container, onClose }: { ctx: Ctx; item: EditorItem; container: Container; onClose: () => void }) {
  const id = useId();
  const { state, commit, list, e } = ctx;
  const entry = item.entry;
  const [bonusText, setBonusText] = useState((entry.bonus ?? []).join(" / "));
  const names = useMemo(() => {
    const all = new Set<string>();
    for (const listId of LIST_IDS) for (const each of state.lists[listId]) for (const hero of each.items) if (hero.entry.hero.trim()) all.add(hero.entry.hero.trim());
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [state]);

  const patch = (changes: Partial<LooseEntry>) => commit(updateItem(state, list, item.uid, changes));
  const pickText = (group: TextGroup, field: keyof LooseEntry) => (key: string | undefined, created?: Translations) => {
    const withText = created && key ? addText(state, group, key, created) : state;
    commit(updateItem(withText, list, item.uid, { [field]: key }));
  };

  const moveTier = (tier: TierId) => {
    if (list === "productivity") {
      commit(moveToGroup(state, item.uid, tier, container.resource ?? "universal"));
      return;
    }
    const target = containerId(list, tier);
    const size = state.lists[list].find((each) => each.id === target)?.items.length ?? 0;
    commit(moveItem(state, list, item.uid, target, size));
  };

  const remove = () => {
    if (!window.confirm(ctx.tf(e.removeConfirm, { hero: entry.hero.trim() || e.unnamed }))) return;
    commit(removeItem(state, list, item.uid));
    onClose();
  };

  return (
    <div className="tier-edit-form">
      <div className="tier-edit-form-head">
        <h2>{e.inspectorTitle}</h2>
        <button type="button" className="icon-button" aria-label={e.close} onClick={onClose}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>

      <div className="field">
        <label htmlFor={`${id}-hero`}>{e.fieldHero}</label>
        <input id={`${id}-hero`} list={`${id}-names`} value={entry.hero} autoFocus={!entry.hero} onChange={(event) => patch({ hero: event.target.value })} />
        <datalist id={`${id}-names`}>
          {names.map((name) => <option key={name} value={name} />)}
        </datalist>
      </div>

      <div className="tier-edit-pair">
        <div className="field">
          <label htmlFor={`${id}-tier`}>{e.fieldTier}</label>
          <select id={`${id}-tier`} value={container.tier} onChange={(event) => moveTier(event.target.value as TierId)}>
            {TIER_IDS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
          </select>
        </div>
        {list === "productivity" ? (
          <TextSelect
            ctx={ctx}
            group="resources"
            label={e.fieldResource}
            value={container.resource}
            onPick={(key, created) => {
              if (!key) return;
              const withText = created ? addText(state, "resources", key, created) : state;
              commit(moveToGroup(withText, item.uid, container.tier, key));
            }}
          />
        ) : null}
      </div>

      <TextSelect ctx={ctx} group="variants" label={e.fieldVariant} value={entry.variant} optional onPick={pickText("variants", "variant")} />

      {list === "overall" ? (
        <>
          <GradeField ctx={ctx} label={e.fieldBattle} value={entry.battle} onChange={(grade) => patch({ battle: grade })} />
          <GradeField ctx={ctx} label={e.fieldUtility} value={entry.utility} onChange={(grade) => patch({ utility: grade })} />
          <GradeField ctx={ctx} label={e.fieldProductivity} value={entry.productivity} onChange={(grade) => patch({ productivity: grade })} />
        </>
      ) : null}

      {list === "battle" ? <RolesField ctx={ctx} item={item} /> : null}

      {list === "utility" ? (
        <TextSelect ctx={ctx} group="effects" label={e.fieldEffect} value={entry.effect} onPick={pickText("effects", "effect")} />
      ) : null}

      {list === "productivity" ? (
        <div className="field">
          <label htmlFor={`${id}-bonus`}>{e.fieldBonus}</label>
          <input
            id={`${id}-bonus`}
            inputMode="decimal"
            value={bonusText}
            aria-describedby={`${id}-bonus-hint`}
            onChange={(event) => {
              setBonusText(event.target.value);
              const values = event.target.value.split(/[/,;]/).map((part) => part.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
              patch({ bonus: values });
            }}
          />
          <p className="tier-small" id={`${id}-bonus-hint`}>{e.fieldBonusHint}</p>
        </div>
      ) : null}

      {list === "overall" || list === "battle" ? (
        <label className="tier-edit-check">
          <input type="checkbox" checked={Boolean(entry.linker)} onChange={(event) => patch({ linker: event.target.checked })} />
          {e.fieldLinker}
        </label>
      ) : null}
      {list === "utility" ? (
        <label className="tier-edit-check">
          <input type="checkbox" checked={Boolean(entry.situational)} onChange={(event) => patch({ situational: event.target.checked })} />
          {e.fieldSituational}
        </label>
      ) : null}

      <TextSelect ctx={ctx} group="notes" label={e.fieldNote} value={entry.note} optional onPick={pickText("notes", "note")} />
      {list === "overall" ? (
        <TextSelect ctx={ctx} group="reasons" label={e.fieldReason} value={entry.reason} optional onPick={pickText("reasons", "reason")} />
      ) : null}

      <button type="button" className="small-button button-danger tier-edit-remove" onClick={remove}>
        <TrashIcon className="icon icon-sm" />
        {e.remove}
      </button>
    </div>
  );
}

function RolesField({ ctx, item }: { ctx: Ctx; item: EditorItem }) {
  const [creating, setCreating] = useState(false);
  const roles = item.entry.roles ?? [];
  const toggle = (key: string, on: boolean) =>
    ctx.commit(updateItem(ctx.state, ctx.list, item.uid, { roles: on ? [...roles, key] : roles.filter((role) => role !== key) }));
  return (
    <fieldset className="tier-edit-roles">
      <legend>{ctx.e.fieldRoles}</legend>
      <div className="tier-edit-role-grid">
        {ctx.keysFor("roles").map((key) => (
          <label key={key} className={roles.includes(key) ? "tier-edit-role is-on" : "tier-edit-role"}>
            <input type="checkbox" checked={roles.includes(key)} onChange={(event) => toggle(key, event.target.checked)} />
            {ctx.labelFor("roles", key)}
          </label>
        ))}
      </div>
      {creating ? (
        <NewTextForm
          onCancel={() => setCreating(false)}
          onAdd={(created) => {
            setCreating(false);
            const key = textKeyFrom(created[DEFAULT_LOCALE], ctx.keysFor("roles"));
            ctx.commit(updateItem(addText(ctx.state, "roles", key, created), ctx.list, item.uid, { roles: [...roles, key] }));
          }}
        />
      ) : (
        <button type="button" className="small-button" onClick={() => setCreating(true)}>
          <PlusIcon className="icon icon-sm" />
          {ctx.e.newText}
        </button>
      )}
    </fieldset>
  );
}

function problemText(ctx: Ctx, problem: Problem): string {
  const list = listLabel(ctx.text, problem.list);
  switch (problem.code) {
    case "emptyName": return ctx.tf(ctx.e.problemEmptyName, { list, tier: problem.tier });
    case "duplicate": return ctx.tf(ctx.e.problemDuplicate, { list, hero: problem.hero });
    case "badGrade": return ctx.tf(ctx.e.problemBadGrade, { list, hero: problem.hero, grade: problem.grade });
    case "badBonus": return ctx.tf(ctx.e.problemBadBonus, { list, hero: problem.hero });
    case "missingText": {
      const group = {
        variants: ctx.e.groupVariants, roles: ctx.e.groupRoles, effects: ctx.e.groupEffects,
        resources: ctx.e.groupResources, notes: ctx.e.groupNotes, reasons: ctx.e.groupReasons,
      }[problem.group];
      return ctx.tf(ctx.e.problemMissingText, { list, hero: problem.hero, group });
    }
  }
}

function ExportDialog({ ctx, data, onClose }: { ctx: Ctx; data: ReturnType<typeof toTierData>; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const json = useMemo(() => serializeTierData(data), [data]);
  const snippets = useMemo(() => dictionarySnippet(ctx.state.texts), [ctx.state.texts]);
  const known = useMemo(
    () => Object.fromEntries(TEXT_GROUPS.map((group) => [group, new Set(Object.keys(ctx.text[group]))])) as unknown as Record<TextGroup, ReadonlySet<string>>,
    [ctx.text],
  );
  const problems = useMemo(() => findProblems(ctx.state, known), [ctx.state, known]);

  const copy = (key: string, value: string) =>
    navigator.clipboard?.writeText(value).then(() => setCopied(key), () => { /* clipboard blocked */ });
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "hero-tiers.json";
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
          <code>lib/data/hero-tiers.json</code>
          <div className="tier-edit-row-actions">
            <button className="small-button" type="button" onClick={() => void copy("json", json)}>
              {copied === "json" ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied === "json" ? ctx.e.copied : ctx.e.copy}
            </button>
            <button className="small-button" type="button" onClick={download}>
              <DownloadIcon className="icon icon-sm" />
              {ctx.e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={12} spellCheck={false} aria-label="lib/data/hero-tiers.json" />
      </div>

      <DictionaryBlocks blocks={snippets} title={ctx.e.exportTexts} lede={ctx.e.exportTextsLede} />
    </dialog>
  );
}
