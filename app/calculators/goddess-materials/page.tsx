"use client";

import { CalculatorHeader } from "../../components/CalculatorHeader";
import { MaterialsCalculator } from "../../components/MaterialsCalculator";
import { useLocale } from "../../components/LocaleProvider";
import { GODDESS_MATERIALS } from "../../../lib/calculators/event-materials";

export default function GoddessMaterialsPage() {
  const { t } = useLocale();
  return (
    <>
      <CalculatorHeader
        eyebrow={t.calculator.goddessMaterialsEyebrow}
        title={t.tools.goddessMaterials.name}
        description={t.calculator.goddessMaterialsIntro}
      />
      <MaterialsCalculator
        materials={GODDESS_MATERIALS}
        resultLabel={t.calculator.goddessMaterialsResult}
      />
      <p className="assumption">{t.calculator.materialsNote}</p>
    </>
  );
}
