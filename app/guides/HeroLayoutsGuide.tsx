"use client";

import Link from "next/link";
import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import { guideLayout } from "../../lib/content/guides";
import type { Dictionary } from "../../lib/i18n";
import {
  COLLECTION_ITEMS,
  FORMATION_COLUMNS,
  FORMATION_ORDER,
  LAYOUT_DATA,
  layoutTexts,
  slotWeight,
  type LayoutPick,
  type LayoutTexts,
} from "../../lib/content/hero-layouts";
import { useAuth } from "../components/AuthProvider";
import { HeroAvatar } from "../components/HeroAvatar";
import { useLocale } from "../components/LocaleProvider";
import { CheckIcon, CloseIcon, PenIcon } from "../components/Icons";

type Guide = Dictionary["guideEntries"]["heroLayouts"];


export function isHeroLayoutsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "heroLayouts";
}

function initial(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}

function Pick({ pick, guide, texts }: { pick: LayoutPick; guide: Guide; texts: LayoutTexts }) {
  const name = pick.hero;
  const note = pick.note ? texts.pickNotes[pick.note] ?? "" : "";
  const item = COLLECTION_ITEMS.has(name);
  return (
    <li className={item ? "pick pick-item" : "pick"}>
      {item ? <span className="pick-avatar" aria-hidden="true">◆</span> : <HeroAvatar name={name} fallback={initial(name)} />}
      <span className="pick-name">{name}</span>
      {note ? <small className="pick-note">{note}</small> : null}
      {item ? <span className="visually-hidden"> ({guide.legendCollection})</span> : null}
    </li>
  );
}

function PickList({ picks, guide, texts }: { picks: readonly LayoutPick[]; guide: Guide; texts: LayoutTexts }) {
  return (
    <ul className="pick-list">
      {picks.map((pick) => (
        <Pick key={`${pick.hero}-${pick.note ?? ""}`} pick={pick} guide={guide} texts={texts} />
      ))}
    </ul>
  );
}

function FormationBoard({ guide }: { guide: Guide }) {
  const { tf } = useLocale();
  const columnLabel = { back: guide.columnBack, middle: guide.columnMiddle, front: guide.columnFront };
  return (
    <figure className="formation-board">
      <div className="formation-columns">
        {FORMATION_ORDER.map((column) => (
          <div className={`formation-column formation-${column}`} key={column}>
            <p className="formation-column-label">{columnLabel[column]}</p>
            <ol className="formation-slots">
              {FORMATION_COLUMNS[column].map((slot, row) =>
                slot === 0 ? (
                  <li className="formation-slot is-empty" aria-hidden="true" key={`empty-${row}`} />
                ) : (
                  <li
                    className="formation-slot"
                    key={slot}
                    style={{ "--w": slotWeight(slot) } as CSSProperties}
                    aria-label={tf(guide.slotLabel, { slot })}
                  >
                    {slot}
                  </li>
                ),
              )}
            </ol>
          </div>
        ))}
      </div>
      {/* The frontline is on the right, so the legend runs first-to-last left to right. */}
      <div className="formation-legend" aria-hidden="true">
        <span>{guide.legendFirst}</span>
        <span>{guide.legendLast}</span>
      </div>
      <figcaption>{guide.boardCaption}</figcaption>
    </figure>
  );
}

function BuildTabs({ guide, texts }: { guide: Guide; texts: LayoutTexts }) {
  const builds = LAYOUT_DATA.builds;
  const base = useId();
  const [activeId, setActiveId] = useState(builds[0]?.id ?? "");
  const active = builds.find((build) => build.id === activeId) ?? builds[0];
  if (!active) return null;

  const tabId = (id: string) => `${base}-tab-${id}`;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = builds.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setActiveId(builds[next].id);
    document.getElementById(tabId(builds[next].id))?.focus();
  };

  const text = texts.buildTexts[active.id] ?? { name: active.id, status: "", tagline: "", pros: [], cons: [], notes: [] };
  const nameOf = (id: string) => texts.buildTexts[id]?.name || id;

  const tiers = [
    { id: "key", label: guide.labelKey, picks: active.key },
    { id: "important", label: guide.labelImportant, picks: active.important },
    { id: "other", label: guide.labelOther, picks: active.other },
    { id: "collection", label: guide.labelCollection, picks: active.collection },
  ].filter((tier) => tier.picks.length > 0);

  return (
    <>
      <div className="build-tabs" role="tablist" aria-label={guide.buildsHeading}>
        {builds.map((build, index) => {
          const selected = build.id === active.id;
          return (
            <button
              key={build.id}
              id={tabId(build.id)}
              type="button"
              role="tab"
              className="build-tab"
              data-build={build.id}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(build.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="build-dot" aria-hidden="true" />
              {nameOf(build.id)}
            </button>
          );
        })}
      </div>

      <div
        className="build-panel"
        data-build={active.id}
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={tabId(active.id)}
      >
        <header className="build-head">
          <div className="build-title">
            <h3>{text.name}</h3>
            {text.status ? <span className="build-status">{text.status}</span> : null}
          </div>
          {text.tagline ? <p>{text.tagline}</p> : null}
        </header>

        <div className="build-body">
          <div className="build-tiers">
            {tiers.map((tier) => (
              <div className="build-tier" data-tier={tier.id} key={tier.id}>
                <h4>{tier.label}</h4>
                <PickList picks={tier.picks} guide={guide} texts={texts} />
              </div>
            ))}
          </div>

          <aside className="build-counters">
            <h4>{guide.labelCounters}</h4>
            <ul>
              {active.counters.map((counter) => (
                <li key={counter.id}>
                  <span className="counter-label">{texts.counterLabels[counter.id]}</span>
                  {counter.picks.length > 0 ? <PickList picks={counter.picks} guide={guide} texts={texts} /> : null}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <div className="procon-grid">
          <div className="procon procon-pros">
            <h4><CheckIcon className="icon icon-sm" />{guide.labelPros}</h4>
            <ul>
              {text.pros.map((line, index) => <li key={index}>{line}</li>)}
            </ul>
          </div>
          <div className="procon procon-cons">
            <h4><CloseIcon className="icon icon-sm" />{guide.labelCons}</h4>
            <ul>
              {text.cons.map((line, index) => <li key={index}>{line}</li>)}
            </ul>
          </div>
        </div>

        {text.notes.length > 0 ? (
          <div className="build-notes">
            {text.notes.map((line, index) => <p key={index}>{line}</p>)}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function HeroLayoutsGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const { allows } = useAuth();
  const texts = layoutTexts(guide);
  return (
    <div className="guide-wide hero-layouts">
      <p className="intro">{guide.intro}</p>
      <p className="guide-credit">
        <span>{guide.credit}</span>
        <span>{guide.creditDate}</span>
      </p>

      <div className="formation-intro">
        <div>
          <h2>{guide.boardHeading}</h2>
          <FormationBoard guide={guide} />
        </div>
        <div>
          <h2>{guide.rulesHeading}</h2>
          <div className="formation-rules">
            {guide.sections.map((section, index) => (
              <article className="formation-rule" key={section.heading}>
                <span className="formation-rule-index" aria-hidden="true">{index + 1}</span>
                <h3>{section.heading}</h3>
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </article>
            ))}
          </div>
        </div>
      </div>

      <h2>{guide.tipsHeading}</h2>
      <ul className="tip-list">
        {guide.tips.map((tip) => (
          <li key={tip}>
            <CheckIcon className="icon icon-sm" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
      {guide.note ? <p className="callout">{guide.note}</p> : null}

      <div className="tier-lists-head">
        <h2>{guide.buildsHeading}</h2>
        {allows("guides.draft") ? (
          <Link className="small-button" href="/guides/hero-layouts/edit/">
            <PenIcon className="icon icon-sm" />
            {t.layoutEditor.openEditor}
          </Link>
        ) : null}
      </div>
      <div className="build-lede">
        <p>{guide.buildsLede}</p>
        <ul className="pick-list pick-legend" aria-hidden="true">
          <li className="pick"><span className="pick-avatar">A</span><span className="pick-name">{guide.legendHero}</span></li>
          <li className="pick pick-item"><span className="pick-avatar">◆</span><span className="pick-name">{guide.legendCollection}</span></li>
        </ul>
      </div>
      <BuildTabs guide={guide} texts={texts} />

      <h2>{guide.utilityHeading}</h2>
      <p className="utility-lede">{guide.utilityLede}</p>
      <div className="utility-grid">
        {LAYOUT_DATA.utility.map((role) => (
          <article className="utility-card" key={role.id}>
            <h3>{texts.roleNames[role.id]}</h3>
            {role.groups.map((group) => (
              <div className="utility-group" key={group.id}>
                {texts.groupLabels[group.id] ? <h4>{texts.groupLabels[group.id]}</h4> : null}
                <PickList picks={group.picks} guide={guide} texts={texts} />
              </div>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}
