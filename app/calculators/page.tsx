"use client";

import { sectionById } from "../../lib/navigation";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { SectionIndex } from "../components/Ui";

export default function CalculatorsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.calculators.title);

  return (
    <SectionIndex
      section={sectionById("calculators")}
      title={t.calculators.title}
      lede={t.calculators.lede}
      emptyMessage={t.common.empty}
    />
  );
}
