"use client";

import { CalculatorHeader } from "../../components/CalculatorHeader";
import { MaterialsCalculator } from "../../components/MaterialsCalculator";
import { useLocale } from "../../components/LocaleProvider";
import { RED_CARPET_MATERIALS } from "../../../lib/calculators/event-materials";

export default function RedCarpetMaterialsPage() {
  const { t } = useLocale();
  return (
    <>
      <CalculatorHeader
        eyebrow={t.calculator.redCarpetEyebrow}
        title={t.tools.redCarpet.name}
        description={t.calculator.redCarpetIntro}
      />
      <MaterialsCalculator materials={RED_CARPET_MATERIALS} />
      <p className="assumption">{t.calculator.materialsNote}</p>
    </>
  );
}
