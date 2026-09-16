"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { GODDESS_LEVELING_DATA } from "../../lib/content/goddess-leveling";
import { guideHref, guideLayout } from "../../lib/content/guides";
import {
  GODDESS_RARITIES,
  GODDESSES,
  goddessImageUrl,
  goddessNamed,
  goddessesByRarity,
  localizedGoddess,
  searchGoddesses,
  type Goddess,
  type GoddessRarity,
} from "../../lib/content/goddesses";
import { GODDESS_SKIN_GROUPS, GODDESS_SKINS, skinSearchText, skinsFor } from "../../lib/content/skins";
import { fill, type Dictionary } from "../../lib/i18n";
import { sectionById } from "../../lib/navigation";
import { ChevronIcon, CloseIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { ToolCard } from "../components/Ui";
import { counted } from "./HeroRoster";
import { ObtainMark } from "./ObtainMark";
import { SkinCatalog, SkinLines } from "./SkinCatalog";

type Guide = Dictionary["guideEntries"]["goddesses"];

/** The first goddesses the upgrade order raises, with a portrait, for the link card. */
const LEVELING_FACES = GODDESS_LEVELING_DATA.phases
  .flatMap((phase) => phase.rows.map((row) => (row.goddess ? GODDESSES.find((goddess) => goddess.id === row.goddess) : undefined)))
  .filter((goddess, index, all): goddess is Goddess => Boolean(goddess?.images[0]) && all.indexOf(goddess) === index)
  .slice(0, 4);

export function isGoddessesGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Dictionary["guideEntries"]["goddesses"] {
  return guideLayout(guide) === "goddesses";
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

function ObtainBadge({ goddess, guide }: { goddess: Goddess; guide: Guide }) {
  return (
    <ObtainMark
      missable={goddess.missable}
      unconfirmed={goddess.unconfirmed}
      missableLabel={guide.missableLabel}
      unconfirmedLabel={guide.unconfirmedLabel}
    />
  );
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
          <ObtainBadge goddess={goddess} guide={guide} />
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
        const text = localizedGoddess(goddess, guide.goddessTexts);
        return `${text.affinity} ${text.obtain} ${skinSearchText(goddess.name, GODDESS_SKINS, [guide.skinTexts])}`;
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

      <h2>{guide.sourcesHeading}</h2>
      <div className="rule-grid">
        {guide.sources.map((source) => (
          <article className="rule-card source-card" key={source.title}>
            <div>
              <h3>{source.title}</h3>
              <p>{source.body}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="hero-credit">{guide.obtainCredit}</p>

      <h2>{guide.skinsHeading}</h2>
      <p className="guide-lede">{guide.skinsLede}</p>
      <div className="rule-grid">
        {guide.skinSources.map((source) => (
          <article className="rule-card source-card" key={source.title}>
            <div>
              <h3>{source.title}</h3>
              <p>{source.body}</p>
            </div>
          </article>
        ))}
      </div>
      <SkinCatalog
        skins={GODDESS_SKINS}
        groups={guide.skinGroups}
        groupOrder={GODDESS_SKIN_GROUPS}
        texts={guide.skinTexts}
        colName={guide.colName}
        colSkin={guide.colSkin}
        colObtain={guide.colObtain}
        missableLabel={guide.missableLabel}
        unconfirmedLabel={guide.unconfirmedLabel}
        ownerOf={(name) => {
          const goddess = goddessNamed(name);
          return {
            name,
            href: goddess ? `${guideHref("goddesses")}#${encodeURIComponent(goddess.id)}` : null,
            rarity: goddess?.rarity,
            src: goddess?.images[0] ? goddessImageUrl(goddess.images[0]) : null,
          };
        }}
      />
      <p className="hero-credit">{guide.skinsCredit}</p>

      <h2>{guide.levelingTitle}</h2>
      <Link className="guide-link-card" href={guideHref("goddessLeveling")}>
        <span className="guide-link-card-art" aria-hidden="true">
          {LEVELING_FACES.map((goddess) => (
            <HeroPortrait key={goddess.id} name={goddess.name} rarity={goddess.rarity} src={goddessImageUrl(goddess.images[0])} className="hero-portrait-small" />
          ))}
        </span>
        <span className="guide-link-card-text">
          <span>{guide.levelingBody}</span>
          <strong>{guide.levelingLink} →</strong>
        </span>
      </Link>

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
  const text = localizedGoddess(goddess, guide.goddessTexts);
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
            <ObtainBadge goddess={goddess} guide={guide} />
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
        <p>{text.affinity || "—"}</p>
        <h3>{guide.colObtain}</h3>
        <p>{text.obtain || "—"}</p>
        {skinsFor(GODDESS_SKINS, goddess.name).length > 0 ? (
          <>
            <h3>{guide.skinsHeading}</h3>
            <SkinLines
              skins={skinsFor(GODDESS_SKINS, goddess.name)}
              texts={guide.skinTexts}
              missableLabel={guide.missableLabel}
              unconfirmedLabel={guide.unconfirmedLabel}
            />
          </>
        ) : null}
      </div>
    </dialog>
  );
}
