"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PREMIUM_PERIOD_DAYS, PREMIUM_PRICE_EUR } from "../../lib/content/premium";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";

/**
 * Soft-locks Premium calculators and simulations: signed-in Premium members
 * see the tool; everyone else gets a dimmed body preview and a price-tag unlock.
 * Keep page titles / headers outside this gate so they stay readable.
 */
export function PremiumGate({ children }: { children: ReactNode }) {
  const { t, tf } = useLocale();
  const { session, loading } = useAuth();

  if (loading) {
    return <p className="assumption">{t.common.comingSoon}</p>;
  }

  if (session?.premium) return <>{children}</>;

  return (
    <div className="premium-gate">
      <div className="premium-gate-blur" aria-hidden="true">
        {children}
      </div>
      <div className="premium-gate-overlay">
        <div className="premium-price-tag premium-price-tag-lg">
          <span className="premium-price-tag-brand">{t.premium.badge}</span>
          <span className="premium-price-tag-meta">{t.premium.unlockHint}</span>
        </div>
        <h2>{t.premium.lockedTitle}</h2>
        <p>{tf(t.premium.lockedLede, { price: PREMIUM_PRICE_EUR, days: PREMIUM_PERIOD_DAYS })}</p>
        <Link className="button button-primary" href="/premium/">
          {tf(t.shell.buyPremium, { price: PREMIUM_PRICE_EUR })}
        </Link>
      </div>
    </div>
  );
}
