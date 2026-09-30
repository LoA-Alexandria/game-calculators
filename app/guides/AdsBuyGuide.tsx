"use client";

import Image from "next/image";
import { guideLayout } from "../../lib/content/guides";
import type { Dictionary } from "../../lib/i18n";
import { asset } from "../../lib/site";

type Guide = Dictionary["guideEntries"]["adsBuy"];
type Section = Guide["sections"][number];

export function isAdsBuyGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "adsBuy";
}

const tone = (index: number) => String((index % 4) + 1);

type GroupId = "ads" | "spend" | "other";

/** Split a section heading like "Ad priorities — daily" into the part after the dash. */
function sectionTitle(heading: string): string {
  const parts = heading.split(/\s+[—–-]\s+/);
  return (parts[1] ?? parts[0] ?? heading).trim();
}

function sectionGroup(heading: string): GroupId {
  if (/addendum|anhang/i.test(heading)) return "other";
  if (/kauf|spend|achat|buy/i.test(heading)) return "spend";
  return "ads";
}

function GuideSectionHeading({
  title,
  lede,
  art,
}: {
  title: string;
  lede: string;
  art: string;
}) {
  return (
    <header className="ads-buy-banner">
      <div className="ads-buy-banner-copy">
        <h2>{title}</h2>
        <p>{lede}</p>
      </div>
      <Image className="ads-buy-banner-art" src={asset(art)} alt="" width={120} height={120} />
    </header>
  );
}

/**
 * When later lines look like list entries (a label before : or ·), the first
 * line is a lede. Short tip pairs without labels stay as a flat list.
 */
function splitSection(body: readonly string[]): { lede?: string; items: string[] } {
  if (body.length <= 1) return { items: [...body] };
  const rest = body.slice(1);
  const restLookLikeItems = rest.some((line) => /[:·]/.test(line));
  if (restLookLikeItems) return { lede: body[0], items: rest };
  return { items: [...body] };
}

function PriorityBlock({
  section,
  index,
  ordered,
}: {
  section: Section;
  index: number;
  ordered: boolean;
}) {
  const { lede, items } = splitSection(section.body);
  const List = ordered ? "ol" : "ul";

  return (
    <li className="gl-phase ads-buy-phase" data-tone={tone(index)}>
      <header className="gl-phase-head">
        <span className="gl-phase-number" data-tone={tone(index)} aria-hidden="true">
          {index + 1}
        </span>
        <div>
          <h3>{sectionTitle(section.heading)}</h3>
          {lede ? <p className="gl-phase-lede">{lede}</p> : null}
        </div>
      </header>
      {items.length === 1 && !lede ? (
        <p className="ads-buy-alone">{items[0]}</p>
      ) : items.length > 0 ? (
        <List className={ordered ? "ads-buy-items is-ordered" : "ads-buy-items"}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </List>
      ) : null}
    </li>
  );
}

export function AdsBuyGuide({ guide }: { guide: Guide }) {
  const ads = guide.sections.filter((section) => sectionGroup(section.heading) === "ads");
  const spend = guide.sections.filter((section) => sectionGroup(section.heading) === "spend");
  const other = guide.sections.filter((section) => sectionGroup(section.heading) === "other");

  return (
    <div className="guide-wide ads-buy-guide">
      <p className="intro">{guide.intro}</p>

      <section className="ads-buy-section is-ads">
        <GuideSectionHeading
          title={guide.adsHeading}
          lede={guide.adsLede}
          art="/guides/ads-buy-phone.webp"
        />
        <ol className="gl-phases ads-buy-phases">
          {ads.map((section, index) => (
            <PriorityBlock
              key={section.heading}
              section={section}
              index={index}
              ordered={/sofort|immediate|immédiat|jeden tag|every day|chaque jour|chronolog/i.test(section.heading)}
            />
          ))}
        </ol>
      </section>

      <section className="ads-buy-section is-spending">
        <GuideSectionHeading
          title={guide.spendHeading}
          lede={guide.spendLede}
          art="/guides/ads-buy-chest.webp"
        />
        <ol className="gl-phases ads-buy-phases">
          {spend.map((section, index) => (
            <PriorityBlock key={section.heading} section={section} index={index} ordered />
          ))}
        </ol>
      </section>

      {other.map((section) => {
        const { lede, items } = splitSection(section.body);
        return (
          <section key={section.heading} className="ads-buy-addendum">
            <h2>{section.heading}</h2>
            {lede ? <p className="guide-lede">{lede}</p> : null}
            {items.length === 1 && !lede ? (
              <p>{items[0]}</p>
            ) : (
              <ul className="ads-buy-items">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {"credit" in guide && guide.credit ? <p className="hero-credit">{guide.credit}</p> : null}
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
