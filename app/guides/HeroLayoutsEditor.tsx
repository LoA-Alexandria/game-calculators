"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BUILD_ZONES, COLLECTION_ITEMS, LAYOUT_DATA, layoutTexts, type BuildZone } from "../../lib/content/hero-layouts";
import {
  addBuild,
  addBuildListItem,
  addCounter,
  addGroup,
  addNote,
  buildZoneId,
  counterZoneId,
  countLayoutChanges,
  findChip,
  findLayoutProblems,
  fromLayout,
  groupZoneId,
  heroesIn,
  insertHero,
  moveBuild,
  moveChip,
  parseLayoutDraft,
  removeBuild,
  removeBuildListItem,
  removeChip,
  removeCounter,
  removeGroup,
  serializeLayout,
  setBuildLine,
  setBuildListItem,
  setChipNote,
  setText,
  textBlocks,
  toLayout,
  zoneChips,
  zoneIds,
  type BuildListField,
  type BuildState,
  type Chip,
  type LayoutEditorState,
  type LayoutProblem,
  type TextMap,
} from "../../lib/content/hero-layout-editor";
import { LANGUAGES, type Language } from "../../lib/content/hero-tier-editor";
import { searchable } from "../../lib/content/hero-tiers";
import { HERO_RARITIES, HEROES, type HeroRarity } from "../../lib/content/heroes";
import { siteName } from "../../lib/content/hero-names";
import { getDictionary, type Dictionary } from "../../lib/i18n";
import { LAYOUT_DRAFT_STORAGE_KEY } from "../../lib/site";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, GripIcon, PlusIcon, TrashIcon } from "../components/Icons";

type GuideText = Dictionary["guideEntries"]["heroLayouts"];
type EditorText = Dictionary["layoutEditor"];

const PUBLISHED = fromLayout(LAYOUT_DATA, {
  en: layoutTexts(getDictionary("en").guideEntries.heroLayouts),
  de: layoutTexts(getDictionary("de").guideEntries.heroLayouts),
  fr: layoutTexts(getDictionary("fr").guideEntries.heroLayouts),
});

const draftStore = createPersistentStore<LayoutEditorState | null>({
  key: LAYOUT_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseLayoutDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

/** The roster from Core elements › Heroes, under the names the guides use. */
const POOL = [...new Map(HEROES.map((hero) => [siteName(hero.name), { name: siteName(hero.name), rarity: hero.rarity }])).values()]
  .sort((a, b) => HERO_RARITIES.indexOf(a.rarity) - HERO_RARITIES.indexOf(b.rarity) || a.name.localeCompare(b.name));
const POOL_PREFIX = "pool:";
const HERO_NAMES_ID = "layout-editor-heroes";
const ITEM_NAMES_ID = "layout-editor-items";

type Ctx = {
  state: LayoutEditorState;
  commit: (next: LayoutEditorState) => void;
  language: Language;
  languages: readonly Language[];
  g: GuideText;
  e: EditorText;
  tf: (template: string, values: Record<string, string | number>) => string;
  zoneLabel: (zoneId: string) => string;
  selectedChip: string | null;
  select: (uid: string | null) => void;
};

const isZoneId = (id: UniqueIdentifier) => /^[bu]\|/.test(String(id));

/**
 * The zone under the pointer wins. The default corner distance measures the
 * dragged element, and a pool row is as wide as the sidebar, so its corners sit
 * closest to whatever zone is to the right of where the hero is dropped.
 */
const collisions: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : closestCorners(args);
};

function languageLabel(e: EditorText, language: Language): string {
  return { en: e.langEn, de: e.langDe, fr: e.langFr }[language];
}

export function HeroLayoutsEditor() {
  const { t, tf, locale } = useLocale();
  const g = t.guideEntries.heroLayouts;
  const e = t.layoutEditor;
  const language = ((LANGUAGES as readonly string[]).includes(locale) ? locale : "en") as Language;

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  const state = draft ?? PUBLISHED;
  const commit = (next: LayoutEditorState) => draftStore.set(next);

  const [chosenBuild, setChosenBuild] = useState<string | null>(null);
  const [allLanguages, setAllLanguages] = useState(false);
  const [dragState, setDragState] = useState<LayoutEditorState | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const dndId = useId();

  const view = dragState ?? state;
  const active = view.builds.find((build) => build.id === chosenBuild) ?? view.builds[0];
  const changes = useMemo(() => countLayoutChanges(PUBLISHED, state), [state]);

  const zoneLabel = (zoneId: string) => {
    const [kind, first, second, third] = zoneId.split("|");
    const texts = view.texts[language];
    if (kind === "b") {
      const name = texts.buildTexts[first]?.name || first;
      if (second === "counter") return `${name} · ${texts.counterLabels[third] || g.labelCounters}`;
      const zoneName = { key: g.labelKey, important: g.labelImportant, other: g.labelOther, collection: g.labelCollection }[second as BuildZone];
      return `${name} · ${zoneName}`;
    }
    const group = texts.groupLabels[second];
    return group ? `${texts.roleNames[first] ?? first} · ${group}` : texts.roleNames[first] ?? first;
  };

  const ctx: Ctx = {
    state,
    commit,
    language,
    languages: allLanguages ? LANGUAGES : [language],
    g,
    e,
    tf,
    zoneLabel,
    selectedChip,
    select: setSelectedChip,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const zoneOf = (id: UniqueIdentifier, source: LayoutEditorState): string | null => {
    const key = String(id);
    if (isZoneId(key)) return zoneChips(source, key) ? key : null;
    return findChip(source, key)?.zoneId ?? null;
  };
  const labelOf = (id: UniqueIdentifier) => {
    const key = String(id);
    if (key.startsWith(POOL_PREFIX)) return key.slice(POOL_PREFIX.length);
    return findChip(view, key)?.chip.hero ?? "";
  };

  const onDragStart = ({ active: dragged }: DragStartEvent) => {
    setDragLabel(labelOf(dragged.id));
    if (!String(dragged.id).startsWith(POOL_PREFIX)) setDragState(state);
  };
  const onDragOver = ({ active: dragged, over }: DragOverEvent) => {
    if (!over || String(dragged.id).startsWith(POOL_PREFIX)) return;
    const current = dragState ?? state;
    const from = zoneOf(dragged.id, current);
    const to = zoneOf(over.id, current);
    if (!from || !to || from === to) return;
    const chips = zoneChips(current, to) ?? [];
    const overIndex = isZoneId(over.id) ? chips.length : chips.findIndex((chip) => chip.uid === String(over.id));
    setDragState(moveChip(current, String(dragged.id), to, overIndex < 0 ? chips.length : overIndex));
  };
  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    const id = String(dragged.id);
    setDragLabel(null);
    if (id.startsWith(POOL_PREFIX)) {
      const to = over ? zoneOf(over.id, state) : null;
      if (to) {
        const chips = zoneChips(state, to) ?? [];
        const index = over && !isZoneId(over.id) ? chips.findIndex((chip) => chip.uid === String(over.id)) : -1;
        commit(insertHero(state, to, id.slice(POOL_PREFIX.length), index < 0 ? undefined : index).state);
      }
      return;
    }
    const current = dragState ?? state;
    let next = current;
    if (over && !isZoneId(over.id)) {
      const found = findChip(current, id);
      const to = zoneOf(over.id, current);
      const chips = to ? zoneChips(current, to) ?? [] : [];
      const overIndex = chips.findIndex((chip) => chip.uid === String(over.id));
      if (found && to && found.zoneId === to && overIndex >= 0 && overIndex !== found.index) next = moveChip(current, id, to, overIndex);
    }
    setDragState(null);
    if (next !== state) commit(next);
  };
  const onDragCancel = () => {
    setDragState(null);
    setDragLabel(null);
  };

  const announcements: Announcements = {
    onDragStart: ({ active: dragged }) => tf(e.announceStart, { hero: labelOf(dragged.id) }),
    onDragOver: ({ active: dragged, over }) => {
      const zone = over ? zoneOf(over.id, view) : null;
      return zone ? tf(e.announceOver, { hero: labelOf(dragged.id), zone: zoneLabel(zone) }) : undefined;
    },
    onDragEnd: ({ active: dragged, over }) => {
      const zone = over ? zoneOf(over.id, view) : null;
      return zone ? tf(e.announceEnd, { hero: labelOf(dragged.id), zone: zoneLabel(zone) }) : undefined;
    },
    onDragCancel: ({ active: dragged }) => tf(e.announceCancel, { hero: labelOf(dragged.id) }),
  };

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
    setSelectedChip(null);
    setChosenBuild(null);
  };

  const heroNames = useMemo(() => {
    const names = new Set(POOL.map((hero) => hero.name));
    for (const name of heroesIn(state)) names.add(name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [state]);

  return (
    <div className="hero-layouts layout-editor">
      <BackLink href="/guides/hero-layouts/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-edit-toolbar layout-edit-toolbar">
        <label className="tier-edit-check">
          <input type="checkbox" checked={allLanguages} onChange={(event) => setAllLanguages(event.target.checked)} />
          {e.allLanguages}
        </label>
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0 ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}` : e.unchanged}
          </span>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>{e.export}</button>
        </div>
      </div>

      <datalist id={HERO_NAMES_ID}>{heroNames.map((name) => <option key={name} value={name} />)}</datalist>
      <datalist id={ITEM_NAMES_ID}>{[...COLLECTION_ITEMS].map((name) => <option key={name} value={name} />)}</datalist>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collisions}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{ announcements, screenReaderInstructions: { draggable: e.dragInstructions } }}
      >
        <div className="layout-edit-grid">
          <div className="layout-edit-main">
            <div className="build-tabs layout-build-tabs">
              {view.builds.map((build) => (
                <button
                  key={build.id}
                  type="button"
                  className="build-tab"
                  data-build={build.id}
                  aria-pressed={active?.id === build.id}
                  onClick={() => { setChosenBuild(build.id); setSelectedChip(null); }}
                >
                  <span className="build-dot" aria-hidden="true" />
                  {view.texts[language].buildTexts[build.id]?.name || build.id}
                </button>
              ))}
              <button type="button" className="build-tab layout-new-build" onClick={() => setCreating(true)}>
                <PlusIcon className="icon icon-sm" />
                {e.newBuild}
              </button>
            </div>
            {creating ? (
              <NamedForm
                label={e.newBuildName}
                submit={e.create}
                cancel={e.cancel}
                autoFocus
                onCancel={() => setCreating(false)}
                onSubmit={(name) => {
                  const result = addBuild(state, name);
                  commit(result.state);
                  setChosenBuild(result.id);
                  setCreating(false);
                }}
              />
            ) : null}

            {active ? (
              <BuildEditor
                key={active.id}
                ctx={{ ...ctx, state: view }}
                build={active}
                index={view.builds.indexOf(active)}
                count={view.builds.length}
                onRemoved={() => setChosenBuild(null)}
              />
            ) : null}

            <UtilityEditor ctx={{ ...ctx, state: view }} />
          </div>

          <aside className="layout-pool" aria-label={e.poolTitle}>
            <HeroPool ctx={ctx} buildId={active?.id} />
          </aside>
        </div>

        <DragOverlay>
          {dragLabel ? (
            <span className={COLLECTION_ITEMS.has(dragLabel) ? "pick pick-item layout-chip is-overlay" : "pick layout-chip is-overlay"}>
              <GripIcon className="icon icon-sm" />
              <span className="pick-name">{dragLabel}</span>
            </span>
          ) : null}
        </DragOverlay>
      </DndContext>

      {exportOpen ? <LayoutExport ctx={ctx} onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}

function NamedForm({
  label,
  submit,
  cancel,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  label: string;
  submit: string;
  cancel?: string;
  autoFocus?: boolean;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  };
  return (
    <form className="layout-named-form" onSubmit={send}>
      <label className="visually-hidden" htmlFor={id}>{label}</label>
      <input id={id} value={value} placeholder={label} autoFocus={autoFocus} onChange={(event) => setValue(event.target.value)} />
      <button className="small-button" type="submit" disabled={!value.trim()}>
        <PlusIcon className="icon icon-sm" />
        {submit}
      </button>
      {onCancel && cancel ? <button className="small-button" type="button" onClick={onCancel}>{cancel}</button> : null}
    </form>
  );
}

function TextInputs({
  ctx,
  label,
  hint,
  multiline,
  get,
  set,
}: {
  ctx: Ctx;
  label: string;
  hint?: string;
  multiline?: boolean;
  get: (language: Language) => string;
  set: (language: Language, value: string) => void;
}) {
  const id = useId();
  return (
    <div className="field layout-text-field">
      <label htmlFor={`${id}-${ctx.languages[0]}`}>{label}</label>
      {ctx.languages.map((language) => (
        <div className="layout-lang-input" key={language}>
          {ctx.languages.length > 1 ? <span className="layout-lang" title={languageLabel(ctx.e, language)}>{language.toUpperCase()}</span> : null}
          {multiline ? (
            <textarea
              id={`${id}-${language}`}
              rows={2}
              value={get(language)}
              aria-label={ctx.languages.length > 1 ? `${label} (${languageLabel(ctx.e, language)})` : undefined}
              onChange={(event) => set(language, event.target.value)}
            />
          ) : (
            <input
              id={`${id}-${language}`}
              value={get(language)}
              aria-label={ctx.languages.length > 1 ? `${label} (${languageLabel(ctx.e, language)})` : undefined}
              onChange={(event) => set(language, event.target.value)}
            />
          )}
        </div>
      ))}
      {hint ? <p className="tier-small">{hint}</p> : null}
    </div>
  );
}

function Zone({
  ctx,
  zoneId,
  label,
  items,
}: {
  ctx: Ctx;
  zoneId: string;
  label?: string;
  items?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId });
  const chips = zoneChips(ctx.state, zoneId) ?? [];
  const selected = ctx.selectedChip ? chips.find((chip) => chip.uid === ctx.selectedChip) : undefined;
  return (
    <div className="layout-zone">
      {label ? <h4>{label}</h4> : null}
      <SortableContext items={chips.map((chip) => chip.uid)} strategy={rectSortingStrategy}>
        <ul ref={setNodeRef} className={isOver ? "layout-zone-list is-over" : "layout-zone-list"}>
          {chips.map((chip) => <SortableChip key={chip.uid} ctx={ctx} chip={chip} />)}
          {chips.length === 0 ? <li className="tier-edit-empty" aria-hidden="true">{ctx.e.emptyZone}</li> : null}
        </ul>
      </SortableContext>
      {selected ? <ChipEditor key={selected.uid} ctx={ctx} chip={selected} zoneId={zoneId} /> : null}
      <AddToZone ctx={ctx} zoneId={zoneId} items={items} label={label ?? ctx.zoneLabel(zoneId)} />
    </div>
  );
}

function AddToZone({ ctx, zoneId, items, label }: { ctx: Ctx; zoneId: string; items?: boolean; label: string }) {
  const [value, setValue] = useState("");
  const placeholder = items ? ctx.e.addItem : ctx.e.addHero;
  return (
    <form
      className="layout-zone-add"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        ctx.commit(insertHero(ctx.state, zoneId, value).state);
        setValue("");
      }}
    >
      <input
        list={items ? ITEM_NAMES_ID : HERO_NAMES_ID}
        value={value}
        placeholder={placeholder}
        aria-label={`${placeholder} ${label}`}
        onChange={(event) => setValue(event.target.value)}
      />
      <button className="small-button" type="submit" disabled={!value.trim()} aria-label={ctx.e.add}>
        <PlusIcon className="icon icon-sm" />
      </button>
    </form>
  );
}

function SortableChip({ ctx, chip }: { ctx: Ctx; chip: Chip }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: chip.uid });
  const item = COLLECTION_ITEMS.has(chip.hero);
  const note = chip.note ? ctx.state.texts[ctx.language].pickNotes[chip.note] : "";
  const selected = ctx.selectedChip === chip.uid;
  const name = chip.hero || "—";
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={["pick", "layout-chip", item ? "pick-item" : "", selected ? "is-selected" : "", isDragging ? "is-dragging" : ""].filter(Boolean).join(" ")}
    >
      <button ref={setActivatorNodeRef} type="button" className="layout-chip-handle" aria-label={ctx.tf(ctx.e.dragHandle, { hero: name })} {...attributes} {...listeners}>
        <GripIcon className="icon icon-sm" />
      </button>
      <button type="button" className="layout-chip-name" aria-expanded={selected} aria-label={ctx.tf(ctx.e.editChip, { hero: name })} onClick={() => ctx.select(selected ? null : chip.uid)}>
        <span className="pick-name">{name}</span>
        {note ? <small className="pick-note">{note}</small> : null}
      </button>
      <button type="button" className="layout-chip-remove" aria-label={`${ctx.e.removeHero}: ${name}`} onClick={() => ctx.commit(removeChip(ctx.state, chip.uid))}>
        <CloseIcon className="icon icon-sm" />
      </button>
    </li>
  );
}

function ChipEditor({ ctx, chip, zoneId }: { ctx: Ctx; chip: Chip; zoneId: string }) {
  const id = useId();
  const [creating, setCreating] = useState(false);
  const [text, setText] = useState<Record<Language, string>>({ en: "", de: "", fr: "" });
  const notes = ctx.state.texts[ctx.language].pickNotes;
  return (
    <div className="layout-chip-editor">
      <div className="field">
        <label htmlFor={`${id}-note`}>{ctx.e.chipNote}</label>
        <select
          id={`${id}-note`}
          value={creating ? "__new__" : chip.note ?? ""}
          onChange={(event) => {
            if (event.target.value === "__new__") { setCreating(true); return; }
            setCreating(false);
            ctx.commit(setChipNote(ctx.state, chip.uid, event.target.value || undefined));
          }}
        >
          <option value="">{ctx.e.chipNoteNone}</option>
          {Object.keys(notes).map((key) => <option key={key} value={key}>{notes[key]}</option>)}
          <option value="__new__">{ctx.e.newNote}</option>
        </select>
      </div>
      {creating ? (
        <div className="tier-edit-newtext">
          {LANGUAGES.map((language) => (
            <div className="field" key={language}>
              <label htmlFor={`${id}-${language}`}>{languageLabel(ctx.e, language)}</label>
              <input id={`${id}-${language}`} value={text[language]} onChange={(event) => setText((current) => ({ ...current, [language]: event.target.value }))} />
            </div>
          ))}
          <div className="tier-edit-row-actions">
            <button
              className="small-button"
              type="button"
              disabled={!text.en.trim() && !text[ctx.language].trim()}
              onClick={() => {
                const english = text.en.trim() || text[ctx.language].trim();
                const created = addNote(ctx.state, { ...text, en: english });
                ctx.commit(setChipNote(created.state, chip.uid, created.key));
                setCreating(false);
              }}
            >
              <CheckIcon className="icon icon-sm" />
              {ctx.e.newNoteAdd}
            </button>
            <button className="small-button" type="button" onClick={() => setCreating(false)}>{ctx.e.cancel}</button>
          </div>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={`${id}-move`}>{ctx.e.moveTo}</label>
        <select id={`${id}-move`} value={zoneId} onChange={(event) => ctx.commit(moveChip(ctx.state, chip.uid, event.target.value, Number.MAX_SAFE_INTEGER))}>
          {zoneIds(ctx.state).map((zone) => <option key={zone} value={zone}>{ctx.zoneLabel(zone)}</option>)}
        </select>
      </div>
      <button className="small-button button-danger tier-edit-remove" type="button" onClick={() => { ctx.commit(removeChip(ctx.state, chip.uid)); ctx.select(null); }}>
        <TrashIcon className="icon icon-sm" />
        {ctx.e.removeHero}
      </button>
    </div>
  );
}

function BuildEditor({ ctx, build, index, count, onRemoved }: { ctx: Ctx; build: BuildState; index: number; count: number; onRemoved: () => void }) {
  const { state, commit, e, g } = ctx;
  const text = (language: Language) => state.texts[language].buildTexts[build.id];
  const zoneLabels: Record<BuildZone, string> = { key: g.labelKey, important: g.labelImportant, other: g.labelOther, collection: g.labelCollection };
  const lists: [BuildListField, string][] = [["pros", g.labelPros], ["cons", g.labelCons], ["notes", e.notesLabel]];

  return (
    <section className="layout-build" data-build={build.id} aria-label={text(ctx.language)?.name || build.id}>
      <div className="layout-build-head">
        <TextInputs ctx={ctx} label={e.fieldName} get={(language) => text(language)?.name ?? ""} set={(language, value) => commit(setBuildLine(state, language, build.id, "name", value))} />
        <TextInputs ctx={ctx} label={e.fieldStatus} hint={e.fieldStatusHint} get={(language) => text(language)?.status ?? ""} set={(language, value) => commit(setBuildLine(state, language, build.id, "status", value))} />
        <div className="layout-build-wide">
          <TextInputs ctx={ctx} label={e.fieldTagline} multiline get={(language) => text(language)?.tagline ?? ""} set={(language, value) => commit(setBuildLine(state, language, build.id, "tagline", value))} />
        </div>
        <div className="tier-edit-row-actions layout-build-actions">
          <button className="small-button" type="button" disabled={index === 0} onClick={() => commit(moveBuild(state, build.id, -1))} aria-label={e.moveLeft}>←</button>
          <button className="small-button" type="button" disabled={index === count - 1} onClick={() => commit(moveBuild(state, build.id, 1))} aria-label={e.moveRight}>→</button>
          <button
            className="small-button button-danger"
            type="button"
            onClick={() => {
              if (!window.confirm(ctx.tf(e.removeBuildConfirm, { name: text(ctx.language)?.name || build.id }))) return;
              commit(removeBuild(state, build.id));
              onRemoved();
            }}
          >
            <TrashIcon className="icon icon-sm" />
            {e.removeBuild}
          </button>
        </div>
      </div>

      <div className="layout-zones">
        {BUILD_ZONES.map((zone) => (
          <Zone key={zone} ctx={ctx} zoneId={buildZoneId(build.id, zone)} label={zoneLabels[zone]} items={zone === "collection"} />
        ))}
      </div>

      <div className="layout-counters">
        <h3>{g.labelCounters}</h3>
        {build.counters.map((counter) => (
          <div className="layout-counter" key={counter.id}>
            <div className="layout-counter-head">
              <TextInputs
                ctx={ctx}
                label={e.counterName}
                get={(language) => state.texts[language].counterLabels[counter.id] ?? ""}
                set={(language, value) => commit(setText(state, language, "counterLabels" satisfies TextMap, counter.id, value))}
              />
              <button className="icon-button" type="button" aria-label={e.removeCounter} onClick={() => commit(removeCounter(state, build.id, counter.id))}>
                <TrashIcon className="icon icon-sm" />
              </button>
            </div>
            <Zone ctx={ctx} zoneId={counterZoneId(build.id, counter.id)} />
          </div>
        ))}
        <NamedForm label={e.addCounter} submit={e.addCounter} onSubmit={(label) => commit(addCounter(state, build.id, label).state)} />
      </div>

      <div className="layout-lines">
        {lists.map(([field, heading]) => (
          <div className="layout-line-list" data-field={field} key={field}>
            <h3>{heading}</h3>
            {(text(ctx.language)?.[field] ?? []).map((_, lineIndex) => (
              <div className="layout-line" key={lineIndex}>
                <TextInputs
                  ctx={ctx}
                  label={`${heading} ${lineIndex + 1}`}
                  multiline
                  get={(language) => text(language)?.[field][lineIndex] ?? ""}
                  set={(language, value) => commit(setBuildListItem(state, language, build.id, field, lineIndex, value))}
                />
                <button className="icon-button" type="button" aria-label={`${e.removeLine} ${lineIndex + 1}`} onClick={() => commit(removeBuildListItem(state, build.id, field, lineIndex))}>
                  <CloseIcon className="icon icon-sm" />
                </button>
              </div>
            ))}
            <button className="small-button" type="button" onClick={() => commit(addBuildListItem(state, ctx.language, build.id, field))}>
              <PlusIcon className="icon icon-sm" />
              {e.addLine}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function UtilityEditor({ ctx }: { ctx: Ctx }) {
  const { state, commit, e, g } = ctx;
  return (
    <section className="layout-utility">
      <h2>{g.utilityHeading}</h2>
      <div className="layout-roles">
        {state.utility.map((role) => (
          <article className="layout-role" key={role.id}>
            <TextInputs
              ctx={ctx}
              label={e.roleName}
              get={(language) => state.texts[language].roleNames[role.id] ?? ""}
              set={(language, value) => commit(setText(state, language, "roleNames", role.id, value))}
            />
            {role.groups.map((group) => (
              <div className="layout-counter" key={group.id}>
                <div className="layout-counter-head">
                  <TextInputs
                    ctx={ctx}
                    label={e.groupName}
                    get={(language) => state.texts[language].groupLabels[group.id] ?? ""}
                    set={(language, value) => commit(setText(state, language, "groupLabels", group.id, value))}
                  />
                  <button className="icon-button" type="button" aria-label={e.removeGroup} onClick={() => commit(removeGroup(state, role.id, group.id))}>
                    <TrashIcon className="icon icon-sm" />
                  </button>
                </div>
                <Zone ctx={ctx} zoneId={groupZoneId(role.id, group.id)} />
              </div>
            ))}
            <NamedForm label={e.addGroup} submit={e.addGroup} onSubmit={(label) => commit(addGroup(state, role.id, label).state)} />
          </article>
        ))}
      </div>
    </section>
  );
}

type PoolMode = "layout" | "build" | "all";

function HeroPool({ ctx, buildId }: { ctx: Ctx; buildId?: string }) {
  const id = useId();
  const { e, tf } = ctx;
  const [mode, setMode] = useState<PoolMode>("layout");
  const [rarity, setRarity] = useState<HeroRarity | "all">("all");
  const [query, setQuery] = useState("");
  const placed = useMemo(
    () => (mode === "all" ? new Set<string>() : heroesIn(ctx.state, mode === "build" ? buildId : undefined)),
    [ctx.state, mode, buildId],
  );
  const needle = searchable(query);
  const heroes = POOL.filter((hero) => (rarity === "all" || hero.rarity === rarity) && !placed.has(hero.name) && (!needle || searchable(hero.name).includes(needle)));
  const modes: [PoolMode, string][] = [["layout", e.poolNotInLayout], ["build", e.poolNotInBuild], ["all", e.poolAll]];

  return (
    <div className="layout-pool-inner">
      <h2>{e.poolTitle}</h2>
      <p className="tier-small">{e.poolHint}</p>
      <div className="layout-pool-modes" role="group" aria-label={e.poolTitle}>
        {modes.map(([value, label]) => (
          <button key={value} type="button" className="layout-toggle" aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>
        ))}
      </div>
      <div className="layout-pool-rarities" role="group" aria-label="Rarity">
        {(["all", ...HERO_RARITIES] as const).map((value) => (
          <button key={value} type="button" className="layout-toggle" data-rarity={value} aria-pressed={rarity === value} onClick={() => setRarity(value)}>
            {value === "all" ? e.poolRarityAll : value}
          </button>
        ))}
      </div>
      <label className="visually-hidden" htmlFor={`${id}-search`}>{e.poolSearch}</label>
      <input id={`${id}-search`} type="search" value={query} placeholder={e.poolSearch} onChange={(event) => setQuery(event.target.value)} />
      <p className="tier-small">{heroes.length === 1 ? e.poolCountOne : tf(e.poolCount, { count: heroes.length })}</p>
      {heroes.length > 0 ? (
        <ul className="layout-pool-list">
          {heroes.map((hero) => <PoolHero key={hero.name} ctx={ctx} name={hero.name} rarity={hero.rarity} buildId={buildId} />)}
        </ul>
      ) : (
        <p className="tier-empty">{e.poolEmpty}</p>
      )}
    </div>
  );
}

function PoolHero({ ctx, name, rarity, buildId }: { ctx: Ctx; name: string; rarity: HeroRarity; buildId?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${POOL_PREFIX}${name}` });
  const { e, g, tf } = ctx;
  const targets: [BuildZone, string, string][] = [["key", e.quickKey, g.labelKey], ["important", e.quickImportant, g.labelImportant], ["other", e.quickOther, g.labelOther]];
  return (
    <li ref={setNodeRef} className={isDragging ? "layout-pool-hero is-dragging" : "layout-pool-hero"} data-rarity={rarity}>
      <button type="button" className="layout-chip-handle" aria-label={tf(e.dragHandle, { hero: name })} {...attributes} {...listeners}>
        <GripIcon className="icon icon-sm" />
      </button>
      <span className="layout-pool-name">{name}</span>
      <span className="layout-rarity">{rarity}</span>
      {buildId ? (
        <span className="layout-pool-quick">
          {targets.map(([zone, short, long]) => (
            <button
              key={zone}
              type="button"
              className="layout-quick"
              aria-label={tf(e.addToZone, { hero: name, zone: long })}
              onClick={() => ctx.commit(insertHero(ctx.state, buildZoneId(buildId, zone), name).state)}
            >
              {short}
            </button>
          ))}
        </span>
      ) : null}
    </li>
  );
}

function problemText(ctx: Ctx, problem: LayoutProblem): string {
  switch (problem.code) {
    case "buildName": return ctx.tf(ctx.e.problemBuildName, { build: ctx.state.texts[ctx.language].buildTexts[problem.build]?.name || problem.build });
    case "emptyHero": return ctx.tf(ctx.e.problemEmptyHero, { zone: ctx.zoneLabel(problem.zone) });
    case "duplicate": return ctx.tf(ctx.e.problemDuplicate, { zone: ctx.zoneLabel(problem.zone), hero: problem.hero });
    case "noteText": return ctx.tf(ctx.e.problemNoteText, { hero: problem.hero });
  }
}

function LayoutExport({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const json = useMemo(() => serializeLayout(toLayout(ctx.state)), [ctx.state]);
  const blocks = useMemo(() => textBlocks(ctx.state), [ctx.state]);
  const problems = useMemo(() => findLayoutProblems(ctx.state), [ctx.state]);

  const copy = (key: string, value: string) =>
    navigator.clipboard?.writeText(value).then(() => setCopied(key), () => { /* clipboard blocked */ });
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "hero-layouts.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const copyButton = (key: string, value: string) => (
    <button className="small-button" type="button" onClick={() => void copy(key, value)}>
      {copied === key ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
      {copied === key ? ctx.e.copied : ctx.e.copy}
    </button>
  );

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
          <code>lib/data/hero-layouts.json</code>
          <div className="tier-edit-row-actions">
            {copyButton("json", json)}
            <button className="small-button" type="button" onClick={download}>
              <DownloadIcon className="icon icon-sm" />
              {ctx.e.download}
            </button>
          </div>
        </div>
        <textarea readOnly value={json} rows={10} spellCheck={false} aria-label="lib/data/hero-layouts.json" />
      </div>

      <div className="tier-export-block">
        <h3>{ctx.e.exportTexts}</h3>
        {LANGUAGES.map((language) => (
          <div key={language} className="tier-export-snippet">
            <div className="tier-export-head">
              <code>{`lib/i18n/dictionaries/${language}.ts`}</code>
              {copyButton(language, blocks[language])}
            </div>
            <textarea readOnly value={blocks[language]} rows={6} spellCheck={false} aria-label={`lib/i18n/dictionaries/${language}.ts`} />
          </div>
        ))}
      </div>
    </dialog>
  );
}
