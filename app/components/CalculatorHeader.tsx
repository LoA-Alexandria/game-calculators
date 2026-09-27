"use client";

import { usePathname } from "next/navigation";
import { toolTitleBanner } from "../../lib/content/banners";
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
  const pathname = usePathname();
  useDocumentTitle(title);
  // The banner already says the title, so the heading keeps it as alt text.
  const art = toolTitleBanner(pathname);
  return (
    <>
      <BackLink href="/calculators/" label={t.nav.calculators} />
      <PageHead eyebrow={eyebrow} title={title} lede={description} art={art ?? undefined} />
    </>
  );
}
