"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  addCity,
  countVoyageChanges,
  exportRoutes,
  exportShipwreck,
  findVoyageProblems,
  fromVoyageData,
  parseMatrix,
  parseVoyageDraft,
  readCell,
  removeCity,
  serializeVoyage,
  setCargo,
  setCell,
  setCity,
  setMatrix,
  setPrice,
  setShipwreck,
  type RouteData,
  type ShipwreckData,
  type VoyageEditorState,
  type VoyageProblem,
} from "../../lib/calculators/grand-voyage-editor";
import { GRAND_VOYAGE_DRAFT_STORAGE_KEY } from "../../lib/site";
import { type Dictionary } from "../../lib/i18n";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";
import { createPersistentStore } from "../components/persistentStore";
import { BackLink, PageHead } from "../components/Ui";
import { SaveToSite } from "../guides/SaveToSite";
import { useGuideData } from "../guides/GuideOverrides";

type EditorText = Dictionary["voyageEditor"];
type Tf = (template: string, values: Record<string, string | number>) => string;

const draftStore = createPersistentStore<VoyageEditorState | null>({
  key: GRAND_VOYAGE_DRAFT_STORAGE_KEY,
  serverValue: null,
  parse: parseVoyageDraft,
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

function problemText(e: EditorText, tf: Tf, problem: VoyageProblem): string {
  if (problem.code === "noCity") return tf(e.problemNoCity, { index: problem.index + 1 });
  if (problem.code === "duplicateCity") return tf(e.problemDuplicateCity, { city: problem.city });
  if (problem.code === "selfLeg") return tf(e.problemSelfLeg, { city: problem.city });
  if (problem.code === "negativeDays") return tf(e.problemNegativeDays, { from: problem.from, to: problem.to });
  if (problem.code === "unknownOrigin") return tf(e.problemUnknownOrigin, { city: problem.city });
  if (problem.code === "unknownPriceCity") return tf(e.problemUnknownPriceCity, { city: problem.city });
  return tf(e.problemBadCell, {
    table: problem.table === "days" ? e.tableDays : e.tableProfits,
    from: problem.from,
    to: problem.to,
  });
}

/** Paste a block from the spreadsheet into one of the two matrices. */
function PasteBox({
  e,
  tf,
  size,
  onRows,
}: {
  e: EditorText;
  tf: Tf;
  size: number;
  onRows: (rows: string[][]) => void;
}) {
  const ids = useId();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  const take = () => {
    const parsed = parseMatrix(text, size);
    if (!parsed.ok) {
      setNote(
        parsed.reason === "empty"
          ? e.pasteEmpty
          : tf(e.pasteSize, { rows: parsed.rows, columns: parsed.columns, size }),
      );
      return;
    }
    onRows(parsed.rows);
    setText("");
    setNote(tf(e.pasteTaken, { size }));
  };

  return (
    <div className="field gv-edit-paste">
      <label htmlFor={ids}>{e.pasteLabel}</label>
      <textarea id={ids} rows={3} spellCheck={false} value={text} onChange={(event) => setText(event.target.value)} />
      <div className="form-actions">
        <button className="small-button" type="button" onClick={take} disabled={!text.trim()}>
          {e.pasteTake}
        </button>
        {note ? <span className="tier-small">{note}</span> : null}
      </div>
    </div>
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
  state: VoyageEditorState;
  problems: VoyageProblem[];
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState("");
  const files = useMemo(
    () => [
      { name: "lib/data/grand-voyage-routes.json", text: serializeVoyage(exportRoutes(state)) },
      { name: "lib/data/grand-voyage-shipwreck-observation.json", text: serializeVoyage(exportShipwreck(state)) },
    ],
    [state],
  );

  const copy = (name: string, text: string) =>
    navigator.clipboard?.writeText(text).then(() => setCopied(name), () => { /* clipboard blocked */ });
  const download = (name: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name.split("/").at(-1) ?? "grand-voyage.json";
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
          <textarea readOnly value={entry.text} rows={6} spellCheck={false} aria-label={entry.name} />
        </div>
      ))}
    </dialog>
  );
}

/**
 * The Grand Voyage numbers: a city against every other city in travel days and
 * reference profit, and one observed shipwreck cargo with what it sold for.
 *
 * Both came out of spreadsheets, so the matrices take a pasted block as
 * readily as a corrected cell — and a block has to be exactly as wide and as
 * tall as the city list, because one that is not came from somewhere else.
 */
export function GrandVoyageEditor() {
  const { t, tf } = useLocale();
  const e = t.voyageEditor;

  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, draftStore.getServerSnapshot);
  // The editor opens on what the site serves, not on the built files.
  const liveRoutes = useGuideData<RouteData>("grand-voyage-routes");
  const liveWreck = useGuideData<ShipwreckData>("grand-voyage-shipwreck-observation");
  const published = useMemo(() => fromVoyageData(liveRoutes, liveWreck), [liveRoutes, liveWreck]);
  const state = draft ?? published;
  const commit = (next: VoyageEditorState) => draftStore.set(next);

  const [from, setFrom] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const routes = useMemo(() => exportRoutes(state), [state]);
  const wreck = useMemo(() => exportShipwreck(state), [state]);
  const changes = useMemo(() => countVoyageChanges(published, state), [published, state]);
  const problems = useMemo(() => findVoyageProblems(state), [state]);

  const origin = Math.min(from, Math.max(0, state.cities.length - 1));
  const goods = state.shipwreck.cargo.map((row) => row.good);

  const reset = () => {
    if (!window.confirm(e.resetConfirm)) return;
    draftStore.clear();
  };

  return (
    <div className="grand-voyage-editor">
      <BackLink href="/simulations/grand-voyage/" label={e.back} />
      <PageHead eyebrow={e.eyebrow} title={e.title} lede={e.lede} />

      <div className="tier-toolbar tier-edit-toolbar">
        <div className="tier-edit-actions">
          <span className="tier-edit-status" aria-live="polite">
            {changes > 0
              ? `${changes === 1 ? e.changeOne : tf(e.changes, { count: changes })} · ${e.savedNote}`
              : e.unchanged}
          </span>
          <button className="button" type="button" onClick={reset} disabled={!draft}>{e.reset}</button>
          <SaveToSite
            file="grand-voyage-routes"
            data={routes}
            more={[{ file: "grand-voyage-shipwreck-observation", data: wreck }]}
          />
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

      <section>
        <h2>{e.citiesHeading}</h2>
        <p className="guide-lede">{e.citiesLede}</p>
        <ol className="gv-edit-cities">
          {state.cities.map((city, index) => (
            <li key={`${city}-${index}`}>
              <input
                aria-label={tf(e.cityLabel, { index: index + 1 })}
                value={city}
                onChange={(event) => commit(setCity(state, index, event.target.value))}
              />
              <button
                type="button"
                className="small-button button-danger"
                onClick={() => commit(removeCity(state, index))}
              >
                <TrashIcon className="icon icon-sm" />
                {tf(e.removeCity, { city: city || String(index + 1) })}
              </button>
            </li>
          ))}
        </ol>
        <div className="form-actions">
          <button className="button" type="button" onClick={() => commit(addCity(state, ""))}>
            <PlusIcon className="icon icon-sm" />
            {e.addCity}
          </button>
        </div>
      </section>

      <section>
        <h2>{e.legsHeading}</h2>
        <p className="guide-lede">{e.legsLede}</p>
        <div className="field gv-edit-pick">
          <label htmlFor="gv-edit-from">{e.fromLabel}</label>
          <select id="gv-edit-from" value={origin} onChange={(event) => setFrom(Number(event.target.value))}>
            {state.cities.map((city, index) => (
              <option key={`${city}-${index}`} value={index}>{city || tf(e.cityLabel, { index: index + 1 })}</option>
            ))}
          </select>
        </div>

        <PasteBox e={e} tf={tf} size={state.cities.length} onRows={(rows) => commit(setMatrix(state, "days", rows))} />
        <PasteBox e={e} tf={tf} size={state.cities.length} onRows={(rows) => commit(setMatrix(state, "profits", rows))} />

        <div className="table-scroll">
          <table className="data-table gv-edit-table">
            <thead>
              <tr>
                <th scope="col">{e.toLabel}</th>
                <th scope="col">{e.tableDays}</th>
                <th scope="col">{e.tableProfits}</th>
              </tr>
            </thead>
            <tbody>
              {state.cities.map((city, to) => (
                <tr key={`${city}-${to}`} data-self={to === origin ? "" : undefined}>
                  <th scope="row">{city || tf(e.cityLabel, { index: to + 1 })}</th>
                  <td>
                    <input
                      aria-label={`${e.tableDays} ${city}`}
                      value={state.days[origin]?.[to] ?? ""}
                      aria-invalid={readCell(state.days[origin]?.[to] ?? "") === null || undefined}
                      onChange={(event) => commit(setCell(state, "days", origin, to, event.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${e.tableProfits} ${city}`}
                      value={state.profits[origin]?.[to] ?? ""}
                      aria-invalid={readCell(state.profits[origin]?.[to] ?? "") === null || undefined}
                      onChange={(event) => commit(setCell(state, "profits", origin, to, event.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>{e.observationHeading}</h2>
        <p className="guide-lede">{e.observationLede}</p>
        <div className="gv-edit-fields">
          <div className="field">
            <label htmlFor="gv-edit-origin">{e.fieldOrigin}</label>
            <select
              id="gv-edit-origin"
              value={state.shipwreck.origin}
              onChange={(event) => commit(setShipwreck(state, { origin: event.target.value }))}
            >
              {state.cities.map((city, index) => (
                <option key={`${city}-${index}`} value={city}>{city}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="gv-edit-date">{e.fieldEffectiveDate}</label>
            <input
              id="gv-edit-date"
              value={state.shipwreck.effectiveDate}
              onChange={(event) => commit(setShipwreck(state, { effectiveDate: event.target.value }))}
            />
          </div>
        </div>

        <h3>{e.cargoHeading}</h3>
        <ol className="gv-edit-cargo">
          {state.shipwreck.cargo.map((row, index) => (
            <li key={row.good || index}>
              <input
                aria-label={e.fieldGood}
                value={row.good}
                onChange={(event) => commit(setCargo(state, index, { good: event.target.value }))}
              />
              <input
                aria-label={e.fieldQuantity}
                inputMode="numeric"
                value={row.quantity}
                onChange={(event) => commit(setCargo(state, index, { quantity: event.target.value }))}
              />
              <input
                aria-label={e.fieldBuy}
                inputMode="numeric"
                value={row.buy}
                onChange={(event) => commit(setCargo(state, index, { buy: event.target.value }))}
              />
            </li>
          ))}
        </ol>

        <h3>{e.pricesHeading}</h3>
        <div className="table-scroll">
          <table className="data-table gv-edit-table">
            <thead>
              <tr>
                <th scope="col">{e.toLabel}</th>
                {goods.map((good) => <th scope="col" key={good}>{good}</th>)}
              </tr>
            </thead>
            <tbody>
              {state.shipwreck.prices.map((row) => (
                <tr key={row.city}>
                  <th scope="row">{row.city}</th>
                  {goods.map((good, index) => (
                    <td key={good}>
                      <input
                        aria-label={`${row.city} ${good}`}
                        inputMode="numeric"
                        value={row.prices[index] ?? ""}
                        onChange={(event) => commit(setPrice(state, row.city, index, event.target.value))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {exportOpen ? (
        <ExportDialog e={e} tf={tf} state={state} problems={problems} onClose={() => setExportOpen(false)} />
      ) : null}
    </div>
  );
}
