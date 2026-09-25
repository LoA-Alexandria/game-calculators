"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { PREMIUM_PERIOD_DAYS, PREMIUM_PRICE_EUR } from "../../lib/content/premium";
import { PREMIUM_HREF } from "../../lib/site";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead } from "../components/Ui";

export default function PremiumPage() {
  const { t, tf, d } = useLocale();
  const { session, loading, refreshSession, signIn } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const [txn, setTxn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useDocumentTitle(t.premium.title);

  const priceVars = { price: PREMIUM_PRICE_EUR, days: PREMIUM_PERIOD_DAYS };

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
    <div className="premium-page">
      <PageHead
        eyebrow={t.premium.badge}
        title={t.premium.title}
        lede={tf(t.premium.lede, priceVars)}
      />

      <section className="panel premium-benefits">
        <h2>{t.premium.benefitsTitle}</h2>
        <ul className="premium-benefit-list">
          <li>{t.premium.benefitTools}</li>
          <li>{t.premium.benefitGuild}</li>
          <li>{tf(t.premium.benefitMonthly, priceVars)}</li>
        </ul>
      </section>

      {session?.premium ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>{t.premium.activeTitle}</h2>
          <p>
            {session.premiumExpiresAt
              ? tf(t.premium.activeUntil, { when: d(session.premiumExpiresAt.slice(0, 10)) })
              : t.premium.badge}
          </p>
          <p className="assumption">{tf(t.premium.renewHint, priceVars)}</p>
          <div className="premium-pay-row">
            <a className="button button-primary" href={PREMIUM_HREF} target="_blank" rel="noreferrer">
              {tf(t.premium.payAgain, priceVars)}
            </a>
            <figure className="premium-pay-qr">
              <a href={PREMIUM_HREF} target="_blank" rel="noreferrer">
                <img src="/premium/paypal-qr.png" alt={t.premium.payQrAlt} width={180} height={180} />
              </a>
              <figcaption>{t.premium.payQrHint}</figcaption>
            </figure>
          </div>
        </section>
      ) : (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>{tf(t.premium.payTitle, priceVars)}</h2>
          <p>{tf(t.premium.payLede, priceVars)}</p>
          <ol className="premium-steps">
            <li>{tf(t.premium.stepPay, priceVars)}</li>
            <li>{t.premium.stepSignIn}</li>
            <li>{t.premium.stepClaim}</li>
          </ol>
          <div className="premium-pay-row">
            <a className="button button-primary" href={PREMIUM_HREF} target="_blank" rel="noreferrer">
              {tf(t.premium.payCta, priceVars)}
            </a>
            <figure className="premium-pay-qr">
              <a href={PREMIUM_HREF} target="_blank" rel="noreferrer">
                <img src="/premium/paypal-qr.png" alt={t.premium.payQrAlt} width={180} height={180} />
              </a>
              <figcaption>{t.premium.payQrHint}</figcaption>
            </figure>
          </div>
        </section>
      )}

      <section className="panel" style={{ marginTop: 16 }} id="claim">
        <h2>{t.premium.claimTitle}</h2>
        <p>{tf(t.premium.claimLede, priceVars)}</p>
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
    </div>
  );
}
