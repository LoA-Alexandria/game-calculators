"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  addSection,
  countWikiChanges,
  eventOf,
  eventsWithoutHelp,
  exportWiki,
  findWikiProblems,
  fromWikiData,
  moveSection,
  parseWikiDraft,
  removeSection,
  serializeWiki,
  setEvent,
  setSection,
  setSource,
  type EditorWikiEvent,
  type WikiEditorState,
  type WikiProblem,
} from "../../lib/content/event-wiki-editor";
import { type EventWikiData } from "../../lib/content/event-guides";
import { EVENT_WIKI_DRAFT_STORAGE_KEY } from "../../lib/site";
import { asset } from "../../lib/site";
import { type Dictionary } from "../../lib/i18n";
import { CheckIcon, ChevronIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { SaveToSite } from "../guides/SaveToSite";
import { useGuideData } from "../guides/GuideOverrides";

type EditorText = Dictionary["eventWikiEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const draftStore = createPersistentStore<WikiEditorState | null>({
  key: EVENT_WIKI_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseWikiDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function problemText(e: EditorText, tf: Tf, problem: WikiProblem): string {
  if (problem.code === "noId") return tf(e.problemNoId, { title: problem.title || "—" });
  if (problem.code === "duplicateId") return tf(e.problemDuplicateId, { id: problem.id });
  if (problem.code === "emptySection") return tf(e.problemEmptySection, { event: problem.event });
  if (problem.code === "pictureWithoutAlt") return tf(e.problemPictureWithoutAlt, { event: problem.event, src: problem.src });
  return tf(e.problemStrayPicture, { event: problem.event, src: problem.src });
}

function EventForm({
  state,
  commit,
  e,
  tf,
  entry,
}: {
  state: WikiEditorState;
  commit: (next: WikiEditorState) => void;
  e: EditorText;
  tf: Tf;
  entry: EditorWikiEvent;
}) {
  const ids = useId();

  return (
    <>
      <div className="ew-edit-fields">
        <div className="field">
          <label htmlFor={`${ids}-title`}>{e.fieldWikiTitle}</label>
          <input
            id={`${ids}-title`}
            value={entry.wikiTitle}
            onChange={(event) => commit(setEvent(state, entry.uid, { wikiTitle: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-url`}>{e.fieldWikiUrl}</label>
          <input
            id={`${ids}-url`}
            value={entry.wikiUrl}
            onChange={(event) => commit(setEvent(state, entry.uid, { wikiUrl: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-icon`}>{e.fieldIcon}</label>
          <input
            id={`${ids}-icon`}
            value={entry.icon}
            placeholder="/events/…"
            onChange={(event) => commit(setEvent(state, entry.uid, { icon: event.target.value }))}
          />
        </div>
        <label className="tier-edit-check">
          <input
            type="checkbox"
            checked={entry.stub}
            onChange={(event) => commit(setEvent(state, entry.uid, { stub: event.target.checked }))}
          />
          {e.fieldStub}
        </label>
      </div>

      {entry.icon.trim() ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ew-edit-icon" src={asset(entry.icon.trim())} alt="" width={48} height={48} />
      ) : null}

      <div className="field">
        <label htmlFor={`${ids}-intro`}>{e.fieldIntro}</label>
        <textarea
          id={`${ids}-intro`}
          rows={3}
          value={entry.intro}
          onChange={(event) => commit(setEvent(state, entry.uid, { intro: event.target.value }))}
        />
      </div>

      <h3>{e.sectionsHeading}</h3>
      <ol className="ew-edit-sections">
        {entry.sections.map((section, index) => (
          <li className="panel" key={section.uid}>
            <div className="ew-edit-section-head">
              <span className="tier-small">{tf(e.sectionNumber, { n: index + 1 })}</span>
              <div className="tier-edit-row-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={e.moveUp}
                  disabled={index === 0}
                  onClick={() => commit(moveSection(state, entry.uid, section.uid, -1))}
                >
                  <ChevronIcon className="icon icon-sm text-guide-up" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={e.moveDown}
                  disabled={index === entry.sections.length - 1}
                  onClick={() => commit(moveSection(state, entry.uid, section.uid, 1))}
                >
                  <ChevronIcon className="icon icon-sm text-guide-down" />
                </button>
                <button
                  type="button"
                  className="small-button button-danger"
                  onClick={() => commit(removeSection(state, entry.uid, section.uid))}
                >
                  <TrashIcon className="icon icon-sm" />
                  {e.removeSection}
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${ids}-${section.uid}-heading`}>{e.fieldHeading}</label>
              <input
                id={`${ids}-${section.uid}-heading`}
                value={section.heading}
                onChange={(event) => commit(setSection(state, entry.uid, section.uid, { heading: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-${section.uid}-items`}>{e.fieldItems}</label>
              <textarea
                id={`${ids}-${section.uid}-items`}
                rows={5}
                value={section.items}
                onChange={(event) => commit(setSection(state, entry.uid, section.uid, { items: event.target.value }))}
              />
            </div>
          </li>
        ))}
      </ol>
      <div className="form-actions">
        <button className="button" type="button" onClick={() => commit(addSection(state, entry.uid).state)}>
          <PlusIcon className="icon icon-sm" />
          {e.addSection}
        </button>
      </div>

      <div className="field">
        <label htmlFor={`${ids}-images`}>{e.fieldImages}</label>
        <textarea
          id={`${ids}-images`}
          rows={3}
          spellCheck={false}
          value={entry.images}
          onChange={(event) => commit(setEvent(state, entry.uid, { images: event.target.value }))}
        />
        <p className="tier-small">{e.imagesHint}</p>
      </div>
    </>
  );
}

function ExportDialog({
  e,
  tf,
  state,
  problems,
  onClose,
}: {
  e: EditorText;
  tf: Tf;
  state: WikiEditorState;
  problems: WikiProblem[];
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => serializeWiki(exportWiki(state)), [state]);

  const copy = () => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => { /* clipboard blocked */ });
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "event-wiki.json";
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
            <ul>{problems.slice(0, 20).map((problem, index) => <li key={index}>{problemText(e, tf, problem)}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="tier-export-block">
        <div className="tier-export-head">
          <code>lib/data/event-wiki.json</code>
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
        <textarea readOnly value={json} rows={10} spellCheck={false} aria-label="lib/data/event-wiki.json" />
      </div>
    </dialog>
  );
}

/**
 * The in-game help on the event pages: what the wiki says an event is and how
 * it works.
 *
 * One event at a time, because that is how somebody corrects a rule they just
 * played. Where the help came from and when it was taken stay at the top, so a
 * correction can say so.
 */
export function EventWikiEditor() {
  const { t, tf } = useLocale();
  const e = t.eventWikiEditor;

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  // The editor opens on what the site serves, not on the built file.
  const liveData = useGuideData<EventWikiData>("event-wiki");
  const published = useMemo(() => fromWikiData(liveData), [liveData]);
  const state = draft ?? published;
  const commit = (next: WikiEditorState) => draftStore.set(next);

  const [uid, setUid] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const savePayload = useMemo(() => exportWiki(state), [state]);
  const changes = useMemo(() => countWikiChanges(published, state), [published, state]);
  const problems = useMemo(() => findWikiProblems(state), [state]);
  const empty = useMemo(() => eventsWithoutHelp(state), [state]);

  const chosen = eventOf(state, uid) ?? state.events[0];
  const ownProblems = problems.filter((problem) =>
    "event" in problem ? problem.event === (chosen?.wikiTitle.trim() || chosen?.id) : false,
  );

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
  };

  return (
    <div className="event-wiki-editor">
      <BackLink href="/events/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0
              ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}`
              : e.unchanged}
          </span>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <SaveToSite file="event-wiki" data={savePayload} />
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

      <div className="ew-edit-fields">
        <div className="field">
          <label htmlFor="ew-edit-source">{e.fieldSource}</label>
          <input
            id="ew-edit-source"
            value={state.source}
            onChange={(event) => commit(setSource(state, { source: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="ew-edit-fetched">{e.fieldFetched}</label>
          <input
            id="ew-edit-fetched"
            value={state.fetched}
            onChange={(event) => commit(setSource(state, { fetched: event.target.value }))}
          />
        </div>
      </div>

      {empty.length > 0 ? <p className="tier-small">{tf(e.withoutHelp, { count: empty.length })}</p> : null}

      <div className="field ew-edit-pick">
        <label htmlFor="ew-edit-event">{e.pickEvent}</label>
        <select id="ew-edit-event" value={chosen?.uid ?? ""} onChange={(event) => setUid(event.target.value)}>
          {state.events.map((entry) => (
            <option key={entry.uid} value={entry.uid}>
              {entry.wikiTitle || entry.id}
              {empty.includes(entry.wikiTitle.trim() || entry.id) ? ` · ${e.noHelpYet}` : ""}
            </option>
          ))}
        </select>
      </div>

      {chosen ? (
        <>
          {ownProblems.length > 0 ? (
            <div className="notice notice-warn" role="alert">
              <div>
                <strong>{e.problemsTitle}</strong>
                <ul>{ownProblems.map((problem, index) => <li key={index}>{problemText(e, tf, problem)}</li>)}</ul>
              </div>
            </div>
          ) : null}
          <EventForm state={state} commit={commit} e={e} tf={tf} entry={chosen} />
        </>
      ) : null}

      {exportOpen ? (
        <ExportDialog e={e} tf={tf} state={state} problems={problems} onClose={() => setExportOpen(false)} />
      ) : null}
    </div>
  );
}
