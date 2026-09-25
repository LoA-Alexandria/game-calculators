"use client";

import Link from "next/link";
import { asset } from "../../../lib/site";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PremiumGate } from "../../components/PremiumGate";

const PLANNER_PATH = "/tools/irrigation-planner/index.html";

export default function IrrigationPlannerPage() {
  const { t } = useLocale();
  useDocumentTitle(t.tools.irrigation.name);

  return (
    <div className="planner-page">
      <div className="planner-bar">
        <Link className="back-link" href="/simulations/">
          <span aria-hidden="true">←</span> {t.nav.simulations}
        </Link>
        <div className="planner-title">
          <h1>{t.tools.irrigation.name}</h1>
          <span className="pill">{t.irrigation.eyebrow}</span>
        </div>
        <span className="spacer" />
        <a className="small-button" href={asset(PLANNER_PATH)} target="_blank" rel="noreferrer">
          {t.irrigation.openFullScreen} <span aria-hidden="true">↗</span>
        </a>
      </div>

      <PremiumGate>
        <iframe
          className="planner-frame"
          src={asset(`${PLANNER_PATH}?embed=1`)}
          title={t.irrigation.frameTitle}
        />

        <div className="planner-notes">
          <p className="assumption">{t.irrigation.model}</p>
          <p className="assumption">{t.irrigation.levels}</p>
          <p className="assumption">{t.irrigation.storage}</p>
          <p className="assumption">{t.irrigation.languageNote}</p>
        </div>
      </PremiumGate>
    </div>
  );
}
