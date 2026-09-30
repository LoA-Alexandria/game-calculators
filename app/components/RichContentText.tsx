"use client";

import Link from "next/link";
import Image from "next/image";
import { asset, BASE_PATH } from "../../lib/site";

/** Renders the small, safe content notation emitted by the Content Builder. */
export function RichContentText({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).map((block, index) => {
    const line = block.trim();
    if (!line) return null;
    if (line.startsWith("## ")) return <h3 key={index}>{line.slice(3)}</h3>;
    if (line.startsWith("> ")) return <p className="callout" key={index}>{inline(line.slice(2))}</p>;
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
