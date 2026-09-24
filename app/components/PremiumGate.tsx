"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";

/**
 * Soft-locks Premium calculators and simulations: signed-in Premium members
 * see the tool; everyone else gets a blurred shell and a buy link.
 */
export function PremiumGate({ children }: { children: ReactNode }) {
  const { t } = useLocale();
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
        <p className="pill">{t.premium.badge}</p>
        <h2>{t.premium.lockedTitle}</h2>
        <p>{t.premium.lockedLede}</p>
        <Link className="button button-primary" href="/premium/">
          {t.shell.buyPremium}
        </Link>
      </div>
    </div>
  );
}
