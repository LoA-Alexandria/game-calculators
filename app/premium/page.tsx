"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { PREMIUM_PERIOD_DAYS } from "../../lib/content/premium";
import { PREMIUM_HREF } from "../../lib/site";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead } from "../components/Ui";

export default function PremiumPage() {
  const { t, d } = useLocale();
  const { session, loading, refreshSession, signIn } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const [txn, setTxn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useDocumentTitle(t.premium.title);

  const submitClaim = async () => {
    if (!supabase || !session) return;
    const id = txn.trim();
    if (id.length < 4) {
      setError(t.premium.claimTxnRequired);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const { error: insertError } = await supabase.from("premium_claims").insert({
      user_id: session.userId,
      paypal_txn_id: id,
      note: note.trim() || null,
      status: "pending",
    });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTxn("");
    setNote("");
    setMessage(t.premium.claimSubmitted);
    await refreshSession();
  };

  return (
    <>
      <PageHead eyebrow={t.premium.badge} title={t.premium.title} lede={t.premium.lede} />

      <section className="panel premium-benefits">
        <h2>{t.premium.benefitsTitle}</h2>
        <ul className="premium-benefit-list">
          <li>{t.premium.benefitTools}</li>
          <li>{t.premium.benefitGuild}</li>
          <li>{t.premium.benefitMonthly.replace("{days}", String(PREMIUM_PERIOD_DAYS))}</li>
        </ul>
      </section>

      {session?.premium ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>{t.premium.activeTitle}</h2>
          <p>
            {session.premiumExpiresAt
              ? t.premium.activeUntil.replace("{when}", d(session.premiumExpiresAt.slice(0, 10)))
              : t.premium.badge}
          </p>
          <p className="assumption">{t.premium.renewHint}</p>
          <a className="button button-primary" href={PREMIUM_HREF} target="_blank" rel="noreferrer">
            {t.premium.payAgain}
          </a>
        </section>
      ) : (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>{t.premium.payTitle}</h2>
          <p>{t.premium.payLede}</p>
          <ol className="premium-steps">
            <li>{t.premium.stepPay}</li>
            <li>{t.premium.stepSignIn}</li>
            <li>{t.premium.stepClaim}</li>
          </ol>
          <a className="button button-primary" href={PREMIUM_HREF} target="_blank" rel="noreferrer">
            {t.shell.buyPremium}
          </a>
        </section>
      )}

      <section className="panel" style={{ marginTop: 16 }} id="claim">
        <h2>{t.premium.claimTitle}</h2>
        <p>{t.premium.claimLede}</p>
        {loading ? (
          <p className="assumption">…</p>
        ) : !session ? (
          <p>
            <button type="button" className="button button-secondary" onClick={() => void signIn()}>
              {t.auth.signIn}
            </button>
          </p>
        ) : (
          <form
            className="premium-claim-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitClaim();
            }}
          >
            <label htmlFor={`${ids}-txn`}>
              <span>{t.premium.claimTxn}</span>
              <input
                id={`${ids}-txn`}
                value={txn}
                onChange={(event) => setTxn(event.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <label htmlFor={`${ids}-note`}>
              <span>{t.premium.claimNote}</span>
              <input id={`${ids}-note`} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            {error ? (
              <p className="sign-in-error" role="alert">
                {error}
              </p>
            ) : null}
            {message ? <p className="assumption">{message}</p> : null}
            <button className="button button-primary" type="submit" disabled={busy}>
              {t.premium.claimSubmit}
            </button>
          </form>
        )}
      </section>

      <p className="assumption" style={{ marginTop: 20 }}>
        <Link href="/calculators/">{t.nav.calculators}</Link>
        {" · "}
        <Link href="/simulations/">{t.nav.simulations}</Link>
      </p>
    </>
  );
}
