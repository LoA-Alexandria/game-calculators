"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ANECDOTE_GROUPS,
  ANECDOTES,
  anecdoteImageUrl,
  anecdotesAfter,
  chainPosition,
  localizedAnecdote,
  searchAnecdotes,
  type Anecdote,
  type AnecdoteGroup,
  type AnecdoteTexts,
} from "../../lib/content/anecdotes";
import { guideLayout } from "../../lib/content/guides";
import { LOCALE_CODES, fill, getDictionary, type Dictionary } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { InfoIcon, PenIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["anecdotes"];

export function isAnecdotesGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "anecdotes";
}

/** A picture frame with a mountain and a sun: the slot a screenshot goes into. */
function PictureSlotIcon() {
  return (
    <svg className="anecdote-slot-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="6" y="9" width="36" height="30" rx="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="17" cy="19" r="3.5" fill="currentColor" />
      <path d="M8 35l10-10 7 7 5-5 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export type AnecdoteLink = { id: string; name: string };

/**
 * One anecdote as readers see it. The editor renders the same card as its
 * preview, so it takes names and pictures already resolved.
 */
export function AnecdoteCard({
  anecdote,
  guide,
  after,
  next,
  chain,
  image,
  headingLevel = 4,
  showGroup = false,
  onJump,
}: {
  anecdote: Anecdote;
  guide: Guide;
  after: AnecdoteLink | null;
  next: AnecdoteLink[];
  chain: { step: number; total: number } | null;
  image: string | null;
  headingLevel?: 3 | 4;
  /** The guide already groups the cards under a heading; the editor preview does not. */
  showGroup?: boolean;
  /** Follows a link to another anecdote; without it the names are plain text. */
  onJump?: (id: string) => void;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const jump = (target: AnecdoteLink) =>
    onJump ? (
      <a
        href={`#${target.id}`}
        onClick={(event) => {
          event.preventDefault();
          onJump(target.id);
        }}
      >
        {target.name}
      </a>
    ) : (
      <span>{target.name}</span>
    );

  return (
    <article className="anecdote" id={onJump ? anecdote.id : undefined} data-group={anecdote.group}>
      <div className="anecdote-media">
        {image ? (
          <a className="anecdote-picture" href={image} target="_blank" rel="noreferrer" aria-label={fill(guide.imageOpen, { anecdote: anecdote.name })}>
            {/* Screenshots come in any shape, so they are cropped to the slot. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" loading="lazy" decoding="async" />
          </a>
        ) : (
          <div className="anecdote-slot">
            <PictureSlotIcon />
            <span>{guide.imagePending}</span>
          </div>
        )}
      </div>

      <div className="anecdote-body">
        <header className="anecdote-head">
          {showGroup || chain ? (
            <div className="anecdote-tags">
              {showGroup ? <span className="anecdote-group">{guide.groups[anecdote.group]}</span> : null}
              {chain ? <span className="anecdote-chain">{fill(guide.chainLabel, chain)}</span> : null}
            </div>
          ) : null}
          <Heading className="anecdote-title">
            {onJump ? (
              <a href={`#${anecdote.id}`} title={fill(guide.linkLabel, { anecdote: anecdote.name })}>{anecdote.name}</a>
            ) : (
              anecdote.name
            )}
          </Heading>
        </header>

        {after || anecdote.prerequisite || anecdote.reward ? (
          <dl className="anecdote-facts">
            {after ? (
              <div className="anecdote-fact is-after">
                <dt>{guide.afterLabel}</dt>
                <dd>{jump(after)}</dd>
              </div>
            ) : null}
            {anecdote.prerequisite ? (
              <div className="anecdote-fact">
                <dt>{guide.prerequisiteLabel}</dt>
                <dd>{anecdote.prerequisite}</dd>
              </div>
            ) : null}
            {anecdote.reward ? (
              <div className="anecdote-fact is-reward">
                <dt>{guide.rewardLabel}</dt>
                <dd>{anecdote.reward}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {anecdote.steps.length > 0 ? (
          <ol className="anecdote-steps">
            {anecdote.steps.map((step, index) => (
              <li key={index}>
                <span>{step.text}</span>
                {step.substeps?.length ? (
                  <ol className="anecdote-substeps">
                    {step.substeps.map((substep, position) => (
                      <li key={position} data-letter={LETTERS[position] ?? ""}>{substep}</li>
                    ))}
                  </ol>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="anecdote-nosteps">{guide.noSteps}</p>
        )}

        {anecdote.note ? (
          <p className="anecdote-note">
            <InfoIcon className="icon icon-sm" />
            <span>
              <strong>{guide.noteLabel}:</strong> {anecdote.note}
            </span>
          </p>
        ) : null}

        {next.length > 0 || anecdote.thanks?.length ? (
          <footer className="anecdote-foot">
            {next.length > 0 ? (
              <p className="anecdote-next">
                <span>{guide.nextLabel}:</span>{" "}
                {next.map((target, index) => (
                  <span key={target.id}>
                    {index > 0 ? ", " : null}
                    {jump(target)}
                  </span>
                ))}
              </p>
            ) : null}
            {anecdote.thanks?.length ? (
              <p className="anecdote-thanks">{fill(guide.thanksLabel, { names: anecdote.thanks.join(", ") })}</p>
            ) : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}

const CATALOGS: AnecdoteTexts[] = LOCALE_CODES.map((code) => getDictionary(code).guideEntries.anecdotes.anecdoteTexts);

export function AnecdotesGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const { allows } = useAuth();
  const [group, setGroup] = useState<AnecdoteGroup | "all">("all");
  const [query, setQuery] = useState("");

  // Search every language's wording, so a reader finds an anecdote by the name they know.
  const rows = useMemo(() => searchAnecdotes(query, group, CATALOGS), [query, group]);
  const texts = guide.anecdoteTexts as AnecdoteTexts;
  const nameOf = (id: string) => {
    const row = ANECDOTES.find((anecdote) => anecdote.id === id);
    return row ? localizedAnecdote(row, texts).name : id;
  };

  const jumpTo = (id: string) => {
    // The target may be hidden by the filter or the search.
    setGroup("all");
    setQuery("");
    window.setTimeout(() => {
      if (window.location.hash === `#${id}`) document.getElementById(id)?.scrollIntoView({ block: "start" });
      else window.location.hash = id;
    }, 0);
  };

  return (
    <div className="guide-wide anecdote-guide">
      <p className="intro">{guide.intro}</p>
      {guide.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      ))}

      <div className="tier-lists-head">
        <h2>{guide.listHeading}</h2>
        {allows("guides.draft") ? (
          <Link className="small-button" href="/guides/anecdotes/edit/">
            <PenIcon className="icon icon-sm" />
            {t.anecdoteEditor.openEditor}
          </Link>
        ) : null}
      </div>
      <p className="guide-lede">{guide.listLede}</p>

      <div className="hero-toolbar anecdote-toolbar">
        <div className="hero-filters" role="group" aria-label={guide.filterLabel}>
          <button type="button" className="hero-filter" aria-pressed={group === "all"} onClick={() => setGroup("all")}>
            {guide.groupAll}
            <span className="hero-filter-count">{ANECDOTES.length}</span>
          </button>
          {ANECDOTE_GROUPS.map((entry) => (
            <button key={entry} type="button" className="hero-filter" aria-pressed={group === entry} onClick={() => setGroup(entry)}>
              {guide.groups[entry]}
              <span className="hero-filter-count">{ANECDOTES.filter((anecdote) => anecdote.group === entry).length}</span>
            </button>
          ))}
        </div>
        <label className="hero-search">
          <span className="visually-hidden">{guide.searchLabel}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={guide.searchPlaceholder} />
        </label>
      </div>
      <p className="hero-count" aria-live="polite">{fill(guide.countLabel, { count: rows.length })}</p>

      {rows.length === 0 ? <p className="empty-state">{guide.empty}</p> : null}
      {ANECDOTE_GROUPS.map((entry) => {
        const inGroup = rows.filter((anecdote) => anecdote.group === entry);
        if (inGroup.length === 0) return null;
        return (
          <section key={entry} className="anecdote-group-section" data-group={entry} aria-labelledby={`anecdotes-${entry}`}>
            <div className="anecdote-group-head">
              <h3 id={`anecdotes-${entry}`}>{guide.groups[entry]}</h3>
              <p>{guide.groupLedes[entry]}</p>
            </div>
            <div className="anecdote-list">
              {inGroup.map((row) => {
                const anecdote = localizedAnecdote(row, texts);
                return (
                  <AnecdoteCard
                    key={row.id}
                    anecdote={anecdote}
                    guide={guide}
                    after={row.after ? { id: row.after, name: nameOf(row.after) } : null}
                    next={anecdotesAfter(row.id).map((follower) => ({ id: follower.id, name: nameOf(follower.id) }))}
                    chain={chainPosition(row.id)}
                    image={row.image ? anecdoteImageUrl(row.image) : null}
                    onJump={jumpTo}
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
