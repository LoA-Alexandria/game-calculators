"use client";

import Link from "next/link";
import Image from "next/image";
import { asset, BASE_PATH } from "../../lib/site";
import { HEROES, heroImageUrl } from "../../lib/content/heroes";
import { GODDESSES, goddessImageUrl } from "../../lib/content/goddesses";
import { HeroPortrait } from "./HeroPortrait";
import { useLocale } from "./LocaleProvider";

/** Renders the small, safe content notation emitted by the Content Builder. */
export function RichContentText({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).map((block, index) => {
    const line = block.trim();
    if (!line) return null;
    if (line.startsWith("## ")) return <h3 key={index}>{line.slice(3)}</h3>;
    if (line.startsWith("> ")) return <p className="callout" key={index}>{inline(line.slice(2))}</p>;
    const character = /^\[\[(hero|goddess):([a-z0-9-]+)\]\]$/i.exec(line);
    if (character) return <CoreCharacterEmbed key={index} kind={character[1].toLowerCase() as "hero" | "goddess"} id={character[2]} />;
    const arrow = /^\[\[arrow:(right|down|left)\]\]$/i.exec(line);
    if (arrow) {
      const direction = arrow[1].toLowerCase();
      const symbol = direction === "down" ? "↓" : direction === "left" ? "←" : "→";
      return <div className={`guide-content-arrow is-${direction}`} key={index} aria-hidden="true"><span>{symbol}</span></div>;
    }
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line);
    if (image && safeImage(image[2])) {
      return (
        <figure className="content-builder-inline-image" key={index}>
          <Image src={imageSrc(image[2])} alt={image[1]} width={1200} height={800} unoptimized />
          {image[1] ? <figcaption>{image[1]}</figcaption> : null}
        </figure>
      );
    }
    return <p key={index}>{inline(line)}</p>;
  })}</>;
}

function CoreCharacterEmbed({ kind, id }: { kind: "hero" | "goddess"; id: string }) {
  const { t } = useLocale();
  const person = kind === "hero" ? HEROES.find((entry) => entry.id === id) : GODDESSES.find((entry) => entry.id === id);
  if (!person) return null;
  const image = person.images[0];
  const src = image ? (kind === "hero" ? heroImageUrl(image) : goddessImageUrl(image)) : null;
  const href = `/guides/${kind === "hero" ? "heroes" : "goddesses"}/#${encodeURIComponent(person.id)}`;
  return <Link className="guide-content-character" href={href}>
    <HeroPortrait name={person.name} rarity={person.rarity} src={src} className="hero-portrait-medium" />
    <span className="guide-content-character-copy"><strong>{person.name}</strong><small>{person.rarity} · {kind === "hero" ? t.contentBuilder.coreHero : t.contentBuilder.coreGoddess}</small></span>
    <span className="guide-content-character-link" aria-hidden="true">↗</span>
  </Link>;
}

function safeImage(value: string) {
  return (value.startsWith("/") && !value.startsWith("//")) || /^https:\/\//i.test(value);
}

function imageSrc(value: string) {
  if (/^https:\/\//i.test(value) || (BASE_PATH && value.startsWith(`${BASE_PATH}/`))) return value;
  return asset(value);
}

function inline(value: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (!safeLink(match[2])) continue;
    if (match.index > last) parts.push(value.slice(last, match.index));
    parts.push(match[2].startsWith("/")
      ? <Link key={`${match.index}-${match[1]}`} href={match[2]}>{match[1]}</Link>
      : <a key={`${match.index}-${match[1]}`} href={match[2]} target="_blank" rel="noreferrer">{match[1]}</a>);
    last = pattern.lastIndex;
  }
  if (last < value.length) parts.push(value.slice(last));
  return parts.length ? parts : value;
}

function safeLink(value: string) {
  return (value.startsWith("/") && !value.startsWith("//")) || /^https:\/\//i.test(value);
}
