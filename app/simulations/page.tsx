"use client";

import { sectionById } from "../../lib/navigation";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { SectionIndex } from "../components/Ui";

export default function SimulationsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.simulations.title);

  return (
    <SectionIndex
      section={sectionById("simulations")}
      title={t.simulations.title}
      lede={t.simulations.lede}
      emptyMessage={t.common.empty}
    />
  );
}
