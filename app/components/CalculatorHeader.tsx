"use client";

import { useDocumentTitle, useLocale } from "./LocaleProvider";
import { BackLink, PageHead } from "./Ui";

/** Back link, eyebrow, heading, and intro shared by every calculator page. */
export function CalculatorHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  const { t } = useLocale();
  useDocumentTitle(title);
  return (
    <>
      <BackLink href="/calculators/" label={t.nav.calculators} />
      <PageHead eyebrow={eyebrow} title={title} lede={description} />
    </>
  );
}
