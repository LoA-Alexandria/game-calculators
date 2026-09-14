"use client";

import Link from "next/link";
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { guideLayout } from "../../lib/content/guides";
import {
  BATTLE_TIERS,
  OVERALL_TIERS,
  PRODUCTIVITY_TIERS,
  TIER_IDS,
  UTILITY_TIERS,
  matchesHero,
  parseGrade,
  type Grade,
  type NoteKey,
  type ReasonKey,
  type TierId,
  type VariantKey,
} from "../../lib/content/hero-tiers";
import type { Dictionary } from "../../lib/i18n";
import { useLocale } from "../components/LocaleProvider";
import { useAuth } from "../components/AuthProvider";
import { HeroAvatar } from "../components/HeroAvatar";
import { CloseIcon, PenIcon, SearchIcon } from "../components/Icons";

type Guide = Dictionary["guideEntries"]["heroTierList"];

const LISTS = ["overall", "battle", "utility", "productivity"] as const;
type ListId = (typeof LISTS)[number];

export function isHeroTierListGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "heroTierList";
}

function percent(values: readonly number[]): string {
  return `${values.map((value) => `+${value}`).join(" / ")} %`;
}

function HeroName({ guide, hero, variant }: { guide: Guide; hero: string; variant?: VariantKey }) {
  return (
    <span className="tier-hero">
      <HeroAvatar name={hero} className="pick-avatar tier-avatar" />
      <span className="tier-hero-name">{hero}</span>
      {variant ? <small>{guide.variants[variant]}</small> : null}
    </span>
  );
}

function Note({ guide, note }: { guide: Guide; note?: NoteKey }) {
  return note ? <p className="tier-note">{guide.notes[note]}</p> : null;
}

function Reason({ guide, hero, reason }: { guide: Guide; hero: string; reason?: ReasonKey }) {
  const { tf } = useLocale();
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!reason) return null;
  return (
    <>
      <button
        type="button"
        className="tier-why"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? guide.reasonHide : guide.reasonShow}
      </button>
      <p className="tier-reason" id={id} hidden={!open} aria-label={tf(guide.reasonLabel, { hero })}>
        {guide.reasons[reason]}
      </p>
    </>
  );
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

function TierRow({
  tier,
  meta,
  description,
  children,
}: {
  tier: TierId;
  meta?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="tier-row" data-tier={tier} aria-label={tier}>
      <div className="tier-badge" aria-hidden="true">{tier}</div>
      <div className="tier-content">
        {meta || description ? (
          <p className="tier-meta">
            {meta ? <strong>{meta}</strong> : null}
            {description ? <span>{description}</span> : null}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

function OverallList({ guide, query }: { guide: Guide; query: string }) {
  const { tf } = useLocale();
  const rows = OVERALL_TIERS.map((row) => ({
    ...row,
    entries: row.entries.filter((entry) => matchesHero(entry.hero, query)),
  })).filter((row) => row.entries.length > 0);
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((row) => {
        const graded = row.entries.some((entry) => entry.battle);
        return (
          <TierRow key={row.tier} tier={row.tier} meta={row.ordered ? guide.ordered : guide.unordered}>
            {graded ? (
              <ol className="tier-cards">
                {row.entries.map((entry) => {
                  const rank = OVERALL_TIERS.find((source) => source.tier === row.tier)?.entries.indexOf(entry) ?? 0;
                  return (
                    <li className="tier-card" key={`${entry.hero}-${entry.variant ?? ""}`}>
                      <div className="tier-card-head">
                        {row.ordered ? <span className="tier-rank">{tf(guide.rank, { rank: rank + 1 })}</span> : null}
                        <HeroName guide={guide} hero={entry.hero} variant={entry.variant} />
                        {entry.linker ? <span className="tier-tag">{guide.linker}</span> : null}
                      </div>
                      <div className="grade-strip">
                        <GradeCell grade={entry.battle} label={guide.gradeBattle} short={guide.gradeBattleShort} empty={guide.noGrade} />
                        <GradeCell grade={entry.utility} label={guide.gradeUtility} short={guide.gradeUtilityShort} empty={guide.noGrade} />
                        <GradeCell grade={entry.productivity} label={guide.gradeProductivity} short={guide.gradeProductivityShort} empty={guide.noGrade} />
                      </div>
                      <Note guide={guide} note={entry.note} />
                      <Reason guide={guide} hero={entry.hero} reason={entry.reason} />
                    </li>
                  );
                })}
              </ol>
            ) : (
              <ul className="tier-chips">
                {row.entries.map((entry) => (
                  <li key={entry.hero}>{entry.hero}</li>
                ))}
              </ul>
            )}
          </TierRow>
        );
      })}
    </>
  );
}

function BattleList({ guide, query }: { guide: Guide; query: string }) {
  const rows = BATTLE_TIERS.map((row) => ({
    ...row,
    entries: row.entries.filter((entry) => matchesHero(entry.hero, query)),
  })).filter((row) => row.entries.length > 0);
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((row) => (
        <TierRow key={row.tier} tier={row.tier} description={guide.battleTiers[row.tier]}>
          <ul className="tier-cards">
            {row.entries.map((entry) => (
              <li className="tier-card" key={`${entry.hero}-${entry.variant ?? ""}`}>
                <div className="tier-card-head">
                  <HeroName guide={guide} hero={entry.hero} variant={entry.variant} />
                  {entry.linker ? <span className="tier-tag">{guide.linker}</span> : null}
                </div>
                {entry.roles.length > 0 ? (
                  <ul className="role-tags">
                    {entry.roles.map((role) => (
                      <li key={role}>{guide.roles[role]}</li>
                    ))}
                  </ul>
                ) : null}
                <Note guide={guide} note={entry.note} />
              </li>
            ))}
          </ul>
        </TierRow>
      ))}
    </>
  );
}

function UtilityList({ guide, query }: { guide: Guide; query: string }) {
  const rows = UTILITY_TIERS.map((row) => ({
    ...row,
    entries: row.entries.filter((entry) => matchesHero(entry.hero, query)),
  })).filter((row) => row.entries.length > 0);
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((row) => (
        <TierRow key={row.tier} tier={row.tier} description={guide.utilityTiers[row.tier]}>
          <ul className="tier-cards">
            {row.entries.map((entry) => (
              <li className="tier-card" key={`${entry.hero}-${entry.effect}-${entry.note ?? ""}`}>
                <div className="tier-card-head">
                  <HeroName guide={guide} hero={entry.hero} variant={entry.variant} />
                  {entry.situational ? <span className="tier-tag">{guide.situational}</span> : null}
                </div>
                <p className="tier-effect">{guide.effects[entry.effect]}</p>
                <Note guide={guide} note={entry.note} />
              </li>
            ))}
          </ul>
        </TierRow>
      ))}
    </>
  );
}

function ProductivityList({ guide, query }: { guide: Guide; query: string }) {
  // Every tier is considered, so a tier with only a description (D: replaceable)
  // still shows when the data has no row for it.
  const rows = TIER_IDS.map((tier) => ({
    tier,
    groups: (PRODUCTIVITY_TIERS.find((row) => row.tier === tier)?.groups ?? [])
      .map((group) => ({ ...group, entries: group.entries.filter((entry) => matchesHero(entry.hero, query)) }))
      .filter((group) => group.entries.length > 0),
  })).filter((row) => row.groups.length > 0 || (query.trim() === "" && guide.productivityTiers[row.tier]));
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((row) => (
        <TierRow key={row.tier} tier={row.tier} description={guide.productivityTiers[row.tier]}>
          {row.groups.length > 0 ? (
            <div className="resource-groups">
              {row.groups.map((group) => (
                <div className="resource-group" data-resource={group.resource} key={group.resource}>
                  <h4>{guide.resources[group.resource]}</h4>
                  <ul>
                    {group.entries.map((entry) => (
                      <li key={entry.hero}>
                        <span className="tier-resource-hero">
                          <HeroAvatar name={entry.hero} />
                          <span className="tier-hero-name">{entry.hero}</span>
                        </span>
                        <span className="resource-bonus">{percent(entry.bonus)}</span>
                        {entry.note ? <small>{guide.notes[entry.note]}</small> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </TierRow>
      ))}
    </>
  );
}

function TierTabs({ guide }: { guide: Guide }) {
  const { tf } = useLocale();
  const base = useId();
  const [active, setActive] = useState<ListId>("overall");
  const [query, setQuery] = useState("");
  const labels: Record<ListId, string> = {
    overall: guide.tabOverall,
    battle: guide.tabBattle,
    utility: guide.tabUtility,
    productivity: guide.tabProductivity,
  };
  const tabId = (id: ListId) => `${base}-tab-${id}`;

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

  const list =
    active === "overall" ? <OverallList guide={guide} query={query} />
    : active === "battle" ? <BattleList guide={guide} query={query} />
    : active === "utility" ? <UtilityList guide={guide} query={query} />
    : <ProductivityList guide={guide} query={query} />;

  // The list components render nothing when nothing matches, but an element is
  // never null, so emptiness is checked against the data itself.
  const hasMatches =
    active === "overall" ? OVERALL_TIERS.some((row) => row.entries.some((entry) => matchesHero(entry.hero, query)))
    : active === "battle" ? BATTLE_TIERS.some((row) => row.entries.some((entry) => matchesHero(entry.hero, query)))
    : active === "utility" ? UTILITY_TIERS.some((row) => row.entries.some((entry) => matchesHero(entry.hero, query)))
    : query.trim() === "" || PRODUCTIVITY_TIERS.some((row) => row.groups.some((group) => group.entries.some((entry) => matchesHero(entry.hero, query))));

  const lede =
    active === "overall" ? guide.overallLede
    : active === "battle" ? guide.battleLede
    : active === "utility" ? guide.utilityLede
    : guide.productivityLede;

  return (
    <div className="tier-lists">
      <div className="tier-toolbar">
        <div className="tier-tabs" role="tablist" aria-label={guide.listsLabel}>
          {LISTS.map((id, index) => (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              className="tier-tab"
              aria-selected={active === id}
              aria-controls={`${base}-panel`}
              tabIndex={active === id ? 0 : -1}
              onClick={() => setActive(id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {labels[id]}
            </button>
          ))}
        </div>
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
      </div>

      <div className="tier-panel" id={`${base}-panel`} role="tabpanel" aria-labelledby={tabId(active)}>
        <p className="tier-lede">{lede}</p>
        {active === "battle" ? (
          <details className="tier-types">
            <summary>{guide.battleTypesHeading}</summary>
            <ul>
              {guide.battleTypes.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </details>
        ) : null}
        <div className="tier-board" aria-live="polite">
          {hasMatches ? list : <p className="tier-empty">{tf(guide.filterEmpty, { query: query.trim() })}</p>}
        </div>
      </div>
    </div>
  );
}

export function HeroTierListGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const { allows } = useAuth();
  return (
    <div className="guide-wide hero-tiers">
      <p className="intro">{guide.intro}</p>
      <p className="guide-credit">
        <span>{guide.credit}</span>
        <span>{guide.creditDate}</span>
      </p>

      <h2>{guide.purposesHeading}</h2>
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

      <h2>{guide.rulesHeading}</h2>
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

      <div className="tier-lists-head">
        <h2>{guide.listsLabel}</h2>
        {allows("guides.draft") ? (
          <Link className="small-button" href="/guides/hero-tier-list/edit/">
            <PenIcon className="icon icon-sm" />
            {t.tierEditor.openEditor}
          </Link>
        ) : null}
      </div>
      <TierTabs guide={guide} />

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
