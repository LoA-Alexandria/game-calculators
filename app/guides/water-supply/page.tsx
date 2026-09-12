"use client";

import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { BackLink, PageHead } from "../../components/Ui";

export default function WaterSupplyGuide() {
  const { t } = useLocale();
  const guide = t.guideEntries.waterSupply;
  useDocumentTitle(guide.title);

  return (
    <>
      <BackLink href="/guides/" label={t.nav.guides} />
      <PageHead eyebrow={t.nav.guides} title={guide.title} />
      <article className="article">
        <p className="intro">{guide.intro}</p>
        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        ))}
        <p className="callout">{guide.note}</p>
      </article>
    </>
  );
}
