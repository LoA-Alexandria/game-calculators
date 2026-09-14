"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { HERO_ABILITY_KINDS, type Hero, type HeroAbility, type HeroAbilityKind } from "../../lib/content/heroes";
import type { Dictionary } from "../../lib/i18n";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["heroes"];

const NUMBER = /(\d+(?:[.,]\d+)?%?)/;

/** For each word of `next`, whether it also appears, in order, in `before` (longest common subsequence). */
function keptWords(before: readonly string[], next: readonly string[]): boolean[] {
  const rows = before.length;
  const cols = next.length;
  const table = Array.from({ length: rows + 1 }, () => new Uint16Array(cols + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === next[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const kept = new Array<boolean>(cols).fill(false);
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === next[j]) {
      kept[j] = true;
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return kept;
}

/**
 * Game text with every number highlighted. Numbers in words that are new since
 * the level below are marked as changed, so moving the slider shows what a
 * level improves.
 */
export function AbilityText({ text, previous }: { text: string; previous?: string }) {
  const tokens = text.split(/(\s+)/);
  const words = tokens.filter((_, index) => index % 2 === 0);
  const kept = previous ? keptWords(previous.split(/\s+/), words) : words.map(() => true);
  const nodes: ReactNode[] = [];
  tokens.forEach((token, index) => {
    if (index % 2 === 1) {
      nodes.push(token);
      return;
    }
    const changed = !kept[index / 2];
    token.split(NUMBER).forEach((part, partIndex) => {
      if (partIndex % 2 === 0) {
        if (part) nodes.push(part);
        return;
      }
      nodes.push(
        <span key={`${index}-${partIndex}`} className={changed ? "ability-num is-changed" : "ability-num"}>
          {part}
        </span>,
      );
    });
  });
  return <>{nodes}</>;
}

function AbilityCard({ kind, ability, guide }: { kind: HeroAbilityKind; ability?: HeroAbility; guide: Guide }) {
  const { tf } = useLocale();
  const id = useId();
  const levels = ability?.levels ?? [];
  // Like the game's skill screen, open at the highest level that is known.
  const [level, setLevel] = useState(Math.max(1, levels.length));
  const text = levels[level - 1] ?? "";
  const previous = level > 1 ? levels[level - 2] || undefined : undefined;
  const fill = levels.length > 1 ? ((level - 1) / (levels.length - 1)) * 100 : 100;

  return (
    <article className={ability ? "ability-card" : "ability-card is-missing"} data-kind={kind} aria-labelledby={`${id}-name`}>
      <header className="ability-head">
        <span className="ability-kind">{guide.abilityKinds[kind]}</span>
        <h4 id={`${id}-name`}>{ability?.name || guide.abilityMissing}</h4>
      </header>
      {levels.length > 1 ? (
        <div className="ability-level">
          <label htmlFor={`${id}-level`}>{tf(guide.levelLabel, { level })}</label>
          <input
            id={`${id}-level`}
            type="range"
            min={1}
            max={levels.length}
            step={1}
            value={level}
            aria-valuetext={tf(guide.levelLabel, { level })}
            style={{ "--fill": `${fill}%` } as CSSProperties}
            onChange={(event) => setLevel(Number(event.target.value))}
          />
        </div>
      ) : null}
      {ability ? (
        <p className="ability-text">
          {text ? <AbilityText text={text} previous={previous} /> : <span className="ability-unknown">{tf(guide.levelUnknown, { level })}</span>}
        </p>
      ) : (
        <p className="ability-text ability-unknown">{guide.abilityPending}</p>
      )}
    </article>
  );
}

/** The three abilities of a hero, plus the artifact when there is one. */
export function HeroAbilities({ hero, guide }: { hero: Hero; guide: Guide }) {
  return (
    <div className="ability-grid">
      {HERO_ABILITY_KINDS.map((kind) => (
        <AbilityCard key={kind} kind={kind} ability={hero[kind]} guide={guide} />
      ))}
      {hero.artifact ? (
        <article className="ability-card" data-kind="artifact">
          <header className="ability-head">
            <span className="ability-kind">{guide.artifactLabel}</span>
            <h4>{hero.artifact.name}</h4>
          </header>
          <p className="ability-text"><AbilityText text={hero.artifact.text} /></p>
        </article>
      ) : null}
    </div>
  );
}
