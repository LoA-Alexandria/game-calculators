"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { guideLayout } from "../../lib/content/guides";
import {
  BATTLE_TIERS,
  OVERALL_TIERS,
  PRODUCTIVITY_TIERS,
  ROLE_GROUPS,
  TIER_IDS,
  UTILITY_TIERS,
  entryRarity,
  matchesHero,
  parseGrade,
  placementCaption,
  roleGroup,
  tierPlacements,
  type BattleEntry,
  type Grade,
  type OverallEntry,
  type ProductivityEntry,
  type ResourceKey,
  type TierId,
  type TierListId,
  type UtilityEntry,
} from "../../lib/content/hero-tiers";
import { HERO_RARITIES, heroNamed, heroPortrait, type HeroRarity } from "../../lib/content/heroes";
import type { Dictionary } from "../../lib/i18n";
import { HeroPortrait } from "../components/HeroPortrait";
import { CloseIcon, SearchIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["heroTierList"];

const LISTS: readonly TierListId[] = ["overall", "battle", "utility", "productivity"];

export function isHeroTierListGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "heroTierList";
}

function percent(values: readonly number[]): string {
  return `${values.map((value) => `+${value}`).join(" / ")} %`;
}

/** One hero on the board, with everything its card and detail dialog need. */
type Card =
  | { list: "overall"; tier: TierId; entry: OverallEntry; rank?: number }
  | { list: "battle"; tier: TierId; entry: BattleEntry }
  | { list: "utility"; tier: TierId; entry: UtilityEntry }
  | { list: "productivity"; tier: TierId; entry: ProductivityEntry; resource: ResourceKey };

type Filter = { query: string; rarity: HeroRarity | "all" };

/** A placement's rarity counts for the filter, so Joan of Arc at UR+ shows under UR+. */
function visible(entry: { hero: string; rarity?: HeroRarity }, filter: Filter): boolean {
  if (!matchesHero(entry.hero, filter.query)) return false;
  return filter.rarity === "all" || entryRarity(entry) === filter.rarity;
}

function cardKey(card: Card): string {
  const extra = card.list === "utility" ? card.entry.effect : card.list === "productivity" ? card.resource : "";
  return `${card.list}-${card.tier}-${card.entry.hero}-${card.entry.rarity ?? ""}-${card.entry.variant ?? ""}-${extra}-${card.entry.note ?? ""}`;
}

function GradeCell({ grade, label, short, empty }: { grade?: Grade; label: string; short: string; empty: string }) {
  const parsed = grade ? parseGrade(grade) : null;
  return (
    <span className="grade" data-tier={parsed?.tier ?? "none"}>
      <span className="grade-label" aria-hidden="true">{short}</span>
      <span className="visually-hidden">{label}: </span>
      <span className="grade-value">
        {parsed ? (
          <>
            {parsed.tier}
            {parsed.to ? <span className="grade-to">→{parsed.to}</span> : null}
            {parsed.fine ? <sup>({parsed.fine})</sup> : null}
            {parsed.flagged ? <sup>*</sup> : null}
          </>
        ) : (
          empty
        )}
      </span>
    </span>
  );
}

/** The short text under a card: grades, skill labels, effect, or bonus. */
function CardTags({ card, guide }: { card: Card; guide: Guide }) {
  if (card.list === "overall") {
    const grades: [string, Grade | undefined][] = [
      [guide.gradeBattleShort, card.entry.battle],
      [guide.gradeUtilityShort, card.entry.utility],
      [guide.gradeProductivityShort, card.entry.productivity],
    ];
    return (
      <span className="tl-grades">
        {grades.map(([short, grade]) => {
          const parsed = grade ? parseGrade(grade) : null;
          return (
            <span key={short} className="tl-grade" data-tier={parsed?.tier ?? "none"} title={short}>
              <small aria-hidden="true">{short.charAt(0)}</small>
              <span className="visually-hidden">{short}: </span>
              {parsed ? parsed.tier : guide.noGrade}
            </span>
          );
        })}
      </span>
    );
  }
  if (card.list === "battle") {
    return card.entry.roles.length ? <span className="tl-tags">{card.entry.roles.map((role) => guide.roles[role]).join(", ")}</span> : null;
  }
  if (card.list === "utility") return <span className="tl-tags tl-tags-effect">{guide.effects[card.entry.effect]}</span>;
  return <span className="tl-tags tl-tags-bonus">{percent(card.entry.bonus)}</span>;
}

function TierCard({ card, guide, onOpen }: { card: Card; guide: Guide; onOpen: (card: Card) => void }) {
  const { tf } = useLocale();
  const { entry } = card;
  const rarity = entryRarity(entry);
  const caption = placementCaption(guide, entry);
  const linker = (card.list === "overall" || card.list === "battle") && card.entry.linker;
  const situational = card.list === "utility" && card.entry.situational;
  const hasMore = Boolean(entry.note || (card.list === "overall" && card.entry.reason));
  return (
    <li className="tl-card" data-rarity={rarity}>
      <button type="button" className="tl-card-button" aria-haspopup="dialog" onClick={() => onOpen(card)}>
        <span className="tl-card-art">
          <HeroPortrait name={entry.hero} rarity={rarity} src={heroPortrait(entry.hero)} className="tl-portrait" />
          {card.list === "overall" && card.rank ? <span className="tl-rank">{tf(guide.rank, { rank: card.rank })}</span> : null}
          {linker ? <span className="tl-flag" title={guide.linker}>L</span> : null}
          {situational ? <span className="tl-flag" title={guide.situational}>~</span> : null}
          {hasMore ? <span className="tl-more" aria-hidden="true">i</span> : null}
        </span>
        <span className="tl-card-name">{entry.hero}</span>
        {caption ? <span className="tl-card-variant">{caption}</span> : null}
        <CardTags card={card} guide={guide} />
        {linker ? <span className="visually-hidden">{guide.linker}</span> : null}
        {situational ? <span className="visually-hidden">{guide.situational}</span> : null}
      </button>
    </li>
  );
}

function CardList({ cards, guide, onOpen }: { cards: readonly Card[]; guide: Guide; onOpen: (card: Card) => void }) {
  return (
    <ul className="tl-cards">
      {cards.map((card) => <TierCard key={cardKey(card)} card={card} guide={guide} onOpen={onOpen} />)}
    </ul>
  );
}

type Row = { tier: TierId; meta?: string; description?: string; cards: Card[] };

function rowsFor(list: TierListId, guide: Guide, filter: Filter): Row[] {
  if (list === "overall") {
    return OVERALL_TIERS.map((row) => ({
      tier: row.tier,
      meta: row.ordered ? guide.ordered : undefined,
      cards: row.entries
        .map((entry, index): Card => ({ list: "overall", tier: row.tier, entry, ...(row.ordered ? { rank: index + 1 } : {}) }))
        .filter((card) => visible(card.entry, filter)),
    }));
  }
  if (list === "battle") {
    return BATTLE_TIERS.map((row) => ({
      tier: row.tier,
      description: guide.battleTiers[row.tier],
      cards: row.entries.map((entry): Card => ({ list: "battle", tier: row.tier, entry })).filter((card) => visible(card.entry, filter)),
    }));
  }
  if (list === "utility") {
    return UTILITY_TIERS.map((row) => ({
      tier: row.tier,
      description: guide.utilityTiers[row.tier],
      cards: row.entries.map((entry): Card => ({ list: "utility", tier: row.tier, entry })).filter((card) => visible(card.entry, filter)),
    }));
  }
  return TIER_IDS.map((tier) => ({
    tier,
    description: guide.productivityTiers[tier],
    cards: (PRODUCTIVITY_TIERS.find((row) => row.tier === tier)?.groups ?? []).flatMap((group) =>
      group.entries
        .map((entry): Card => ({ list: "productivity", tier, entry, resource: group.resource }))
        .filter((card) => visible(card.entry, filter)),
    ),
  }));
}

function listSize(list: TierListId): number {
  const heroes = new Set<string>();
  if (list === "overall") OVERALL_TIERS.forEach((row) => row.entries.forEach((entry) => heroes.add(entry.hero)));
  if (list === "battle") BATTLE_TIERS.forEach((row) => row.entries.forEach((entry) => heroes.add(entry.hero)));
  if (list === "utility") UTILITY_TIERS.forEach((row) => row.entries.forEach((entry) => heroes.add(entry.hero)));
  if (list === "productivity") PRODUCTIVITY_TIERS.forEach((row) => row.groups.forEach((group) => group.entries.forEach((entry) => heroes.add(entry.hero))));
  return heroes.size;
}

const LIST_SIZES = Object.fromEntries(LISTS.map((list) => [list, listSize(list)])) as Record<TierListId, number>;

function RowBody({ row, list, guide, onOpen }: { row: Row; list: TierListId; guide: Guide; onOpen: (card: Card) => void }) {
  if (list === "battle") {
    return (
      <div className="tl-cells">
        {ROLE_GROUPS.map((group) => {
          const cards = row.cards.filter((card) => card.list === "battle" && roleGroup(card.entry.roles) === group);
          return (
            <div className="tl-cell" data-group={group} key={group}>
              <span className="tl-cell-label">{guide.roleGroups[group]}</span>
              {cards.length ? <CardList cards={cards} guide={guide} onOpen={onOpen} /> : null}
            </div>
          );
        })}
      </div>
    );
  }
  if (list === "productivity") {
    const resources = [...new Set(row.cards.map((card) => (card.list === "productivity" ? card.resource : null)))].filter(
      (resource): resource is ResourceKey => resource !== null,
    );
    return (
      <div className="tl-resources">
        {resources.map((resource) => (
          <div className="tl-resource" data-resource={resource} key={resource}>
            <h4>{guide.resources[resource]}</h4>
            <CardList
              cards={row.cards.filter((card) => card.list === "productivity" && card.resource === resource)}
              guide={guide}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    );
  }
  return <CardList cards={row.cards} guide={guide} onOpen={onOpen} />;
}

function TierBoard({ guide }: { guide: Guide }) {
  const { tf } = useLocale();
  const base = useId();
  const [active, setActive] = useState<TierListId>("overall");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<HeroRarity | "all">("all");
  const [open, setOpen] = useState<Card | null>(null);
  const labels: Record<TierListId, string> = {
    overall: guide.tabOverall,
    battle: guide.tabBattle,
    utility: guide.tabUtility,
    productivity: guide.tabProductivity,
  };
  const ledes: Record<TierListId, string> = {
    overall: guide.overallLede,
    battle: guide.battleLede,
    utility: guide.utilityLede,
    productivity: guide.productivityLede,
  };
  const tabId = (id: TierListId) => `${base}-tab-${id}`;
  const filter = useMemo(() => ({ query, rarity }), [query, rarity]);
  const rows = useMemo(() => rowsFor(active, guide, filter), [active, guide, filter]);
  const filtering = query.trim() !== "" || rarity !== "all";
  // While filtering, empty tiers collapse; otherwise a described tier stays so D ("replaceable") still reads.
  const shown = rows.filter((row) => row.cards.length > 0 || (!filtering && row.description));
  const matches = rows.reduce((sum, row) => sum + row.cards.length, 0);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = LISTS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setActive(LISTS[next]);
    document.getElementById(tabId(LISTS[next]))?.focus();
  };

  return (
    <div className="tl">
      <div className="tl-modes" role="tablist" aria-label={guide.listsLabel}>
        {LISTS.map((id, index) => (
          <button
            key={id}
            id={tabId(id)}
            type="button"
            role="tab"
            className="tl-mode"
            data-list={id}
            aria-selected={active === id}
            aria-controls={`${base}-panel`}
            tabIndex={active === id ? 0 : -1}
            onClick={() => setActive(id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className="tl-mode-title">{labels[id]}</span>
            <span className="tl-mode-count">{tf(guide.listCount, { count: LIST_SIZES[id] })}</span>
          </button>
        ))}
      </div>

      <div className="tl-filters">
        <div className="tier-filter">
          <label className="visually-hidden" htmlFor={`${base}-filter`}>{guide.filterLabel}</label>
          <SearchIcon className="icon icon-sm" />
          <input
            id={`${base}-filter`}
            type="search"
            value={query}
            placeholder={guide.filterPlaceholder}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="button" className="tier-filter-clear" aria-label={guide.filterClear} onClick={() => setQuery("")}>
              <CloseIcon className="icon icon-sm" />
            </button>
          ) : null}
        </div>
        <div className="hero-filters" role="group" aria-label={guide.rarityLabel}>
          <button type="button" className="hero-filter" aria-pressed={rarity === "all"} onClick={() => setRarity("all")}>
            {guide.rarityAll}
          </button>
          {HERO_RARITIES.map((tier) => (
            <button key={tier} type="button" className="hero-filter" data-rarity={tier} aria-pressed={rarity === tier} onClick={() => setRarity(tier)}>
              {tier}
            </button>
          ))}
        </div>
      </div>

      <div className="tl-panel" id={`${base}-panel`} role="tabpanel" aria-labelledby={tabId(active)}>
        <p className="tier-lede">{ledes[active]}</p>
        {active === "battle" ? (
          <details className="tier-types">
            <summary>{guide.battleTypesHeading}</summary>
            <ul>
              {guide.battleTypes.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </details>
        ) : null}

        <div className="tl-board" data-list={active} aria-live="polite">
          {matches === 0 && filtering ? (
            <p className="tier-empty">{tf(guide.filterEmpty, { query: query.trim() || rarity })}</p>
          ) : (
            <>
              {active === "battle" ? (
                <div className="tl-columns" aria-hidden="true">
                  <span />
                  {ROLE_GROUPS.map((group) => (
                    <span key={group} data-group={group}>{guide.roleGroups[group]}</span>
                  ))}
                </div>
              ) : null}
              {shown.map((row) => (
                <section className="tl-row" data-tier={row.tier} key={row.tier} aria-label={row.tier}>
                  <div className="tl-label">
                    <strong>{row.tier}</strong>
                    {row.meta ? <small>{row.meta}</small> : null}
                  </div>
                  <div className="tl-body">
                    {row.description ? <p className="tl-desc">{row.description}</p> : null}
                    {row.cards.length > 0 ? <RowBody row={row} list={active} guide={guide} onOpen={setOpen} /> : null}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
        {active === "battle" ? <p className="tier-small">{guide.columnsNote}</p> : null}
      </div>

      {open ? <TierDetail card={open} guide={guide} labels={labels} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function TierDetail({
  card,
  guide,
  labels,
  onClose,
}: {
  card: Card;
  guide: Guide;
  labels: Record<TierListId, string>;
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const attach = useCallback((node: HTMLDialogElement | null) => {
    dialog.current = node;
    if (node && !node.open) node.showModal();
  }, []);
  const { entry } = card;
  const hero = heroNamed(entry.hero);
  const rarity = entryRarity(entry);
  const caption = placementCaption(guide, entry);
  const placements = tierPlacements(entry.hero);
  const reason = card.list === "overall" ? card.entry.reason : undefined;

  return (
    <dialog ref={attach} className="hero-detail tl-detail" data-rarity={rarity} aria-labelledby={`${id}-name`} onClose={onClose}>
      <div className="hero-detail-nav">
        <button type="button" className="icon-button hero-detail-close" aria-label={guide.detailClose} onClick={() => dialog.current?.close()}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>
      <header className="hero-detail-head">
        <HeroPortrait name={entry.hero} rarity={rarity} src={heroPortrait(entry.hero)} className="hero-portrait-large" />
        <div className="hero-detail-title">
          <h2 id={`${id}-name`}>{entry.hero}</h2>
          <p>
            {rarity ? <span className="rarity" data-rarity={rarity}>{rarity}</span> : null}
            {caption ? <span className="hero-obtain">{caption}</span> : null}
          </p>
          {hero ? (
            <p className="tl-detail-link">
              <Link href={`/guides/heroes/#${hero.id}`}>{guide.detailHeroLink} →</Link>
            </p>
          ) : null}
        </div>
      </header>

      <div className="hero-detail-body">
        <h3>{labels[card.list]}</h3>
        <div className="tl-detail-main">
          <span className="tl-detail-tier" data-tier={card.tier}>{card.tier}</span>
          <div className="tl-detail-facts">
            {card.list === "overall" ? (
              <div className="grade-strip">
                <GradeCell grade={card.entry.battle} label={guide.gradeBattle} short={guide.gradeBattleShort} empty={guide.noGrade} />
                <GradeCell grade={card.entry.utility} label={guide.gradeUtility} short={guide.gradeUtilityShort} empty={guide.noGrade} />
                <GradeCell grade={card.entry.productivity} label={guide.gradeProductivity} short={guide.gradeProductivityShort} empty={guide.noGrade} />
              </div>
            ) : null}
            {card.list === "battle" && card.entry.roles.length ? (
              <ul className="role-tags">
                {card.entry.roles.map((role) => <li key={role}>{guide.roles[role]}</li>)}
              </ul>
            ) : null}
            {card.list === "utility" ? <p className="tier-effect">{guide.effects[card.entry.effect]}</p> : null}
            {card.list === "productivity" ? (
              <p className="tier-effect">
                {guide.resources[card.resource]} · <span className="resource-bonus">{percent(card.entry.bonus)}</span>
              </p>
            ) : null}
            {(card.list === "overall" || card.list === "battle") && card.entry.linker ? <span className="tier-tag">{guide.linker}</span> : null}
            {card.list === "utility" && card.entry.situational ? <span className="tier-tag">{guide.situational}</span> : null}
            {entry.note ? <p className="tier-note">{guide.notes[entry.note]}</p> : null}
          </div>
        </div>

        {reason ? (
          <>
            <h3>{guide.reasonHeading}</h3>
            <p className="tl-detail-reason">{guide.reasons[reason]}</p>
          </>
        ) : null}

        {placements.length > 1 ? (
          <>
            <h3>{guide.detailAllLists}</h3>
            <ul className="hero-links">
              {LISTS.filter((list) => placements.some((placement) => placement.list === list)).map((list) => (
                <li key={list}>
                  <span className="tl-detail-list">{labels[list]}</span>
                  <span className="hero-link-values">
                    {placements
                      .filter((placement) => placement.list === list)
                      .map((placement, index) => (
                        <span className="hero-link-tier" data-tier={placement.tier} key={`${placement.tier}-${index}`}>
                          <strong>{placement.tier}</strong>
                          {placement.rarity || placement.variant ? <small>{placementCaption(guide, placement)}</small> : null}
                          {placement.resource ? <small>{guide.resources[placement.resource]}</small> : null}
                        </span>
                      ))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </dialog>
  );
}

export function HeroTierListGuide({ guide }: { guide: Guide }) {
  return (
    <div className="guide-wide hero-tiers">
      <p className="intro">{guide.intro}</p>

      <div className="tier-lists-head">
        <h2>{guide.listsLabel}</h2>
      </div>
      <TierBoard guide={guide} />

      <details className="tier-changelog tier-howto">
        <summary>
          <span>{guide.howToRead}</span>
        </summary>

        <h3>{guide.purposesHeading}</h3>
        <div className="tier-purposes">
          {guide.purposes.map((purpose) => (
            <article className="tier-purpose" data-purpose={purpose.id} key={purpose.id}>
              <h3>{purpose.title}</h3>
              <p>{purpose.body}</p>
            </article>
          ))}
        </div>

        <div className="tier-overview">
          <section className="tier-panel-card">
            <h3>{guide.starsHeading}</h3>
            <p className="tier-small">{guide.starsLede}</p>
            <ol className="star-steps">
              {guide.stars.map((effect, index) => (
                <StarStep key={index} star={index + 1} effect={effect} label={guide.starLabel} />
              ))}
            </ol>
            <p className="tier-small">{guide.starsNote}</p>
          </section>
          <section className="tier-panel-card">
            <h3>{guide.stagesHeading}</h3>
            <ol className="stage-steps">
              {guide.stages.map((stage) => (
                <li key={stage.label}>
                  <strong>{stage.label}</strong>
                  <span>{stage.range}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <h3>{guide.rulesHeading}</h3>
        <div className="tier-rules">
          {guide.sections.map((section) => (
            <article className="tier-rule" key={section.heading}>
              <h3>{section.heading}</h3>
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>
          ))}
          <Link className="tier-rule tier-rule-link" href="/guides/hero-layouts/">
            <h3>{guide.layoutsLink}</h3>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        {guide.note ? <p className="callout">{guide.note}</p> : null}
      </details>

      <Changelog guide={guide} />
    </div>
  );
}

function StarStep({ star, effect, label }: { star: number; effect: string; label: string }) {
  const { tf } = useLocale();
  return (
    <li>
      <span className="star-mark" aria-label={tf(label, { star })}>
        <span aria-hidden="true">★</span>
        {star}
      </span>
      <span>{effect}</span>
    </li>
  );
}

function Changelog({ guide }: { guide: Guide }) {
  const { d } = useLocale();
  return (
    <details className="tier-changelog">
      <summary>
        <span>{guide.changelogHeading}</span>
      </summary>
      <p className="tier-small">{guide.changelogLede}</p>
      <ol className="changelog-list">
        {guide.changelog.map((entry) => (
          <li key={entry.date}>
            <time dateTime={entry.date}>{d(entry.date)}</time>
            <ul>
              {entry.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </details>
  );
}
