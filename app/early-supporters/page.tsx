"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabasePublicClient } from "../../lib/supabase/client";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead } from "../components/Ui";

type SupporterCredit = { display_name: string; granted_at: string };

export default function EarlySupportersPage() {
  const { t, d } = useLocale();
  const supabase = getSupabasePublicClient();
  const [credits, setCredits] = useState<SupporterCredit[]>([]);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [error, setError] = useState("");

  useDocumentTitle(t.premium.supporterPageTitle);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("early_supporters")
        .select("display_name, granted_at")
        .order("granted_at");
      if (gone) return;
      if (queryError) setError(queryError.message);
      else setCredits((data ?? []) as SupporterCredit[]);
      setLoading(false);
    })();
    return () => {
      gone = true;
    };
  }, [supabase]);

  return (
    <div className="premium-page">
      <PageHead
        eyebrow={t.premium.badge}
        title={t.premium.supporterPageTitle}
        lede={t.premium.supporterPageLede}
      />
      <section className="panel">
        <h2>{t.premium.supporterBenefitsTitle}</h2>
        <ul className="premium-benefit-list">
          <li>{t.premium.supporterRoleBenefit}</li>
          <li>{t.premium.supporterTestBenefit}</li>
          <li>{t.premium.supporterVotingBenefit}</li>
          <li>{t.premium.supporterPreviewBenefit}</li>
        </ul>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>{t.premium.supporterCreditsTitle}</h2>
        {loading ? <p className="assumption">…</p> : null}
        {error ? <p className="result-error" role="alert">{error}</p> : null}
        {!loading && !error && credits.length === 0 ? (
          <p className="assumption">{t.premium.supporterCreditsEmpty}</p>
        ) : null}
        {credits.length > 0 ? (
          <ul className="early-supporter-credits">
            {credits.map((credit) => (
              <li key={`${credit.granted_at}-${credit.display_name}`}>
                <strong>{credit.display_name}</strong>
                <time dateTime={credit.granted_at}>{d(credit.granted_at.slice(0, 10))}</time>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <p className="account-actions">
        <Link className="button button-primary" href="/premium/">{t.premium.supporterPremiumLink}</Link>
      </p>
    </div>
  );
}
