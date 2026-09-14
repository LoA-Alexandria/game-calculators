"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { guideLayout } from "../../lib/content/guides";
import {
  GODDESS_RARITIES,
  GODDESSES,
  goddessImageUrl,
  goddessNamed,
  goddessPortrait,
  goddessesByRarity,
  searchGoddesses,
  type Goddess,
  type GoddessRarity,
} from "../../lib/content/goddesses";
import { fill, type Dictionary } from "../../lib/i18n";
import { sectionById } from "../../lib/navigation";
import { ChevronIcon, CloseIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { ToolCard } from "../components/Ui";
import { counted } from "./HeroRoster";

type Guide = Dictionary["guideEntries"]["goddesses"];
type Phase = NonNullable<Guide["phases"]>[number];
type RosterRow = NonNullable<Guide["roster"]>[number];

export function isGoddessesGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Dictionary["guideEntries"]["goddesses"] {
  return guideLayout(guide) === "goddesses";
}

function rosterRow(guide: Guide, name: string): RosterRow | undefined {
  return (guide.roster ?? []).find((row) => row.name.toLowerCase() === name.trim().toLowerCase());
}

function NameCell({ name }: { name: string }) {
  const goddess = goddessNamed(name);
  const src = goddessPortrait(name);
  return (
    <span className="guide-name">
      <HeroPortrait name={name} rarity={goddess?.rarity} src={src} className="hero-portrait-small" />
      {name}
    </span>
  );
}

function PhaseCard({ phase, colName, colTarget, colHint }: {
  phase: Phase;
  colName: string;
  colTarget: string;
  colHint: string;
}) {
  const showHint = phase.rows.some((row) => row.hint);
  return (
    <article className="phase-card" data-tone={phase.tone}>
      <header className="phase-card-head">
        <span className="phase-index" aria-hidden="true">{phase.tone}</span>
        <div>
          <p className="phase-kicker">{phase.title}</p>
          <h3>{phase.subtitle}</h3>
        </div>
      </header>
      {phase.lede ? <p className="phase-lede">{phase.lede}</p> : null}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{colName}</th>
              <th>{colTarget}</th>
              {showHint ? <th>{colHint}</th> : null}
            </tr>
          </thead>
          <tbody>
            {phase.rows.map((row) => (
              <tr key={row.name}>
                <td data-label={colName}><NameCell name={row.name} /></td>
                <td data-label={colTarget}><strong className="mono">{row.target}</strong></td>
                {showHint ? <td data-label={colHint}>{row.hint || "—"}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

const subscribeHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

function goddessUrl(id: string | null): string {
  return `${window.location.pathname}${window.location.search}${id ? `#${encodeURIComponent(id)}` : ""}`;
}

function notifyHash() {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function openGoddessHash(id: string) {
  window.history.pushState({ goddessDialog: true }, "", goddessUrl(id));
  notifyHash();
}

function stepGoddessHash(id: string) {
  window.history.replaceState(window.history.state, "", goddessUrl(id));
  notifyHash();
}

function closeGoddessHash() {
  if ((window.history.state as { goddessDialog?: boolean } | null)?.goddessDialog) {
    window.history.back();
    return;
  }
  window.history.replaceState(window.history.state, "", goddessUrl(null));
  notifyHash();
}

function GoddessTile({ goddess, guide, onOpen }: { goddess: Goddess; guide: Guide; onOpen: (goddess: Goddess) => void }) {
  const skins = goddess.images.length - 1;
  return (
    <li>
      <button type="button" className="hero-tile" data-rarity={goddess.rarity} aria-haspopup="dialog" onClick={() => onOpen(goddess)}>
        <HeroPortrait name={goddess.name} rarity={goddess.rarity} src={goddess.images[0] ? goddessImageUrl(goddess.images[0]) : null} />
        <span className="hero-tile-name">{goddess.name}</span>
        <span className="hero-tile-meta">
          <span className="rarity" data-rarity={goddess.rarity}>{goddess.rarity}</span>
        </span>
        {skins > 0 ? (
          <span className="hero-tile-skins">
            <span aria-hidden="true">+{skins}</span>
            <span className="visually-hidden">{counted(skins, guide.skinCountOne, guide.skinCount)}</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function GoddessesGuide({ guide }: { guide: Guide }) {
  const tools = sectionById("calculators").items.filter((item) => item.href.includes("goddess"));
  const [rarity, setRarity] = useState<GoddessRarity | "all">("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () =>
      searchGoddesses(query, rarity, (goddess) => {
        const row = rosterRow(guide, goddess.name);
        return `${row?.affinity ?? ""} ${row?.obtain ?? ""}`;
      }),
    [query, rarity, guide],
  );
  const grouped = rarity === "all" && !query.trim();

  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const openId = decodeURIComponent(hash.slice(1));
  const open = openId ? GODDESSES.find((goddess) => goddess.id === openId) ?? null : null;
  const stepList = open && rows.some((goddess) => goddess.id === open.id) ? rows : GODDESSES;

  return (
    <div className="guide-wide hero-roster">
      <p className="intro">{guide.intro}</p>

      <h2>{guide.rosterHeading}</h2>
      <p className="guide-lede">{guide.rosterLede}</p>

      <div className="hero-toolbar">
        <div className="hero-filters" role="group" aria-label={guide.filterLabel}>
          <button type="button" className="hero-filter" aria-pressed={rarity === "all"} onClick={() => setRarity("all")}>
            {guide.filterAll}
            <span className="hero-filter-count">{GODDESSES.length}</span>
          </button>
          {GODDESS_RARITIES.map((tier) => (
            <button
              key={tier}
              type="button"
              className="hero-filter"
              data-rarity={tier}
              aria-pressed={rarity === tier}
              onClick={() => setRarity(tier)}
            >
              {tier}
              <span className="hero-filter-count">{goddessesByRarity(tier).length}</span>
            </button>
          ))}
        </div>
        <label className="hero-search">
          <span className="visually-hidden">{guide.searchLabel}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={guide.searchPlaceholder}
          />
        </label>
      </div>
      <p className="hero-count" aria-live="polite">{fill(guide.countLabel, { count: rows.length })}</p>

      {rows.length === 0 ? (
        <p className="empty-state">{guide.empty}</p>
      ) : grouped ? (
        GODDESS_RARITIES.map((tier) => {
          const goddesses = rows.filter((goddess) => goddess.rarity === tier);
          if (goddesses.length === 0) return null;
          return (
            <section className="hero-group" data-rarity={tier} key={tier} aria-label={tier}>
              <h3 className="hero-group-head">
                <span className="rarity" data-rarity={tier}>{tier}</span>
                <small>{counted(goddesses.length, guide.groupCountOne, guide.groupCount)}</small>
              </h3>
              <ul className="hero-tiles">
                {goddesses.map((goddess) => (
                  <GoddessTile key={goddess.id} goddess={goddess} guide={guide} onOpen={(entry) => openGoddessHash(entry.id)} />
                ))}
              </ul>
            </section>
          );
        })
      ) : (
        <ul className="hero-tiles">
          {rows.map((goddess) => (
            <GoddessTile key={goddess.id} goddess={goddess} guide={guide} onOpen={(entry) => openGoddessHash(entry.id)} />
          ))}
        </ul>
      )}
      <p className="hero-credit">{guide.portraitCredit}</p>

      <h2>{guide.orderHeading}</h2>
      <div className="phase-grid">
        {guide.phases.map((phase) => (
          <PhaseCard
            key={phase.tone}
            phase={phase}
            colName={guide.colName}
            colTarget={guide.colTarget}
            colHint={guide.colHint}
          />
        ))}
      </div>

      <h2>{guide.toolsHeading}</h2>
      <div className="card-grid">
        {tools.map((item) => (
          <ToolCard item={item} key={item.href} />
        ))}
      </div>
      <p className="guide-more">
        <Link href="/calculators/">{guide.toolsMore}</Link>
      </p>

      {open ? (
        <GoddessDialog
          key={open.id}
          goddess={open}
          guide={guide}
          list={stepList}
          onStep={(goddess) => stepGoddessHash(goddess.id)}
          onClose={closeGoddessHash}
        />
      ) : null}
    </div>
  );
}

function GoddessDialog({
  goddess,
  guide,
  list,
  onStep,
  onClose,
}: {
  goddess: Goddess;
  guide: Guide;
  list: readonly Goddess[];
  onStep: (goddess: Goddess) => void;
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const attach = useCallback((node: HTMLDialogElement | null) => {
    dialog.current = node;
    if (node && !node.open) node.showModal();
  }, []);
  const index = list.findIndex((entry) => entry.id === goddess.id);
  const previous = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  const row = rosterRow(guide, goddess.name);
  const file = goddess.images[0];
  const [shown, setShown] = useState(0);
  const current = goddess.images[shown] ?? file;

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    const target = event.key === "ArrowLeft" ? previous : event.key === "ArrowRight" ? next : null;
    if (!target) return;
    event.preventDefault();
    onStep(target);
  };

  return (
    <dialog
      ref={attach}
      className="hero-detail"
      data-rarity={goddess.rarity}
      aria-labelledby={`${id}-name`}
      onClose={onClose}
      onKeyDown={onKeyDown}
    >
      <div className="hero-detail-nav">
        <button type="button" className="icon-button hero-detail-prev" aria-label={guide.previousGoddess} disabled={!previous} onClick={() => previous && onStep(previous)}>
          <ChevronIcon className="icon icon-sm" />
        </button>
        <span className="hero-detail-position">{index >= 0 ? `${index + 1} / ${list.length}` : ""}</span>
        <button type="button" className="icon-button" aria-label={guide.nextGoddess} disabled={!next} onClick={() => next && onStep(next)}>
          <ChevronIcon className="icon icon-sm" />
        </button>
        <button type="button" className="icon-button hero-detail-close" aria-label={guide.close} onClick={() => dialog.current?.close()}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>
      <header className="hero-detail-head">
        <HeroPortrait name={goddess.name} rarity={goddess.rarity} src={current ? goddessImageUrl(current) : null} className="hero-portrait-large" />
        <div className="hero-detail-title">
          <h2 id={`${id}-name`}>{goddess.name}</h2>
          <p>
            <span className="rarity" data-rarity={goddess.rarity}>{goddess.rarity}</span>
            {row?.obtain ? <span className="hero-obtain">{guide.colObtain}: {row.obtain}</span> : null}
          </p>
          {goddess.images.length > 1 ? (
            <div className="hero-skins" role="group" aria-label={guide.imagesLabel}>
              {goddess.images.map((image, position) => (
                <button
                  key={image}
                  type="button"
                  className="hero-skin"
                  aria-pressed={position === shown}
                  aria-label={position === 0 ? guide.portraitLabel : fill(guide.skinLabel, { number: position })}
                  onClick={() => setShown(position)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={goddessImageUrl(image)} alt="" width={120} height={121} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          ) : null}
          {goddess.skinRaisesTo ? <p className="hero-pending">{guide.skinSsrNote}</p> : null}
        </div>
      </header>
      <div className="hero-detail-body">
        <h3>{guide.colAffinity}</h3>
        <p>{row?.affinity.trim() ? row.affinity : "—"}</p>
        <h3>{guide.colObtain}</h3>
        <p>{row?.obtain.trim() ? row.obtain : "—"}</p>
      </div>
    </dialog>
  );
}
