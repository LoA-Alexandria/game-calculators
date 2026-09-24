"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PREMIUM_PRICE_EUR } from "../../lib/content/premium";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";
import { SignInPanel } from "./SignInPanel";
import { ChevronIcon, PenIcon, ShieldIcon } from "./Icons";

/**
 * Signed-in create and admin links used to sit in the sidebar footer, which
 * crowded Discord and GitHub once more than one permission was granted. They
 * live next to the account control instead, matching the language menu.
 */
export function AccountMenu() {
  const { t, d, tf } = useLocale();
  const { allows, session, loading, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (loading) return null;

  if (!session) {
    return (
      <div className="lang topbar-account" ref={root}>
        <button className="topbar-sign-in" type="button" onClick={() => setSignInOpen((value) => !value)}>
          {t.auth.signIn}
        </button>
        <SignInPanel open={signInOpen} onClose={() => setSignInOpen(false)} />
      </div>
    );
  }

  const actions = [
    allows("news.write") ? { href: "/news/new/", label: t.nav.newNews, icon: PenIcon } : null,
    allows("guides.draft") ? { href: "/guides/new/", label: t.nav.newGuide, icon: PenIcon } : null,
    allows("roles.assign") ? { href: "/admin/", label: t.nav.admin, icon: ShieldIcon } : null,
  ].filter((action): action is { href: string; label: string; icon: typeof PenIcon } => action !== null);

  return (
    <div className="lang topbar-account" ref={root}>
      <button
        type="button"
        className={open ? "topbar-account-trigger is-open" : "topbar-account-trigger"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.auth.accountMenu}
        title={t.auth.accountMenu}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="topbar-account-name">{session.name}</span>
        {session.premium ? <span className="pill topbar-premium-pill">{t.premium.badge}</span> : null}
        <ChevronIcon className="icon icon-sm" />
      </button>
      {open && (
        <ul className="menu-pop" role="menu" aria-label={t.auth.accountMenu}>
          {session.premium && session.premiumExpiresAt ? (
            <li className="menu-meta" role="presentation">
              {t.premium.activeUntil.replace("{when}", d(session.premiumExpiresAt.slice(0, 10)))}
            </li>
          ) : (
            <li>
              <Link className="lang-option" href="/premium/" role="menuitem" onClick={() => setOpen(false)}>
                {tf(t.shell.buyPremium, { price: PREMIUM_PRICE_EUR })}
              </Link>
            </li>
          )}
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.href}>
                <Link
                  className={pathname === action.href ? "lang-option is-active" : "lang-option"}
                  href={action.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <Icon className="icon icon-sm" />
                  <span>{action.label}</span>
                </Link>
              </li>
            );
          })}
          {(actions.length > 0 || !session.premium) && <li className="menu-sep" role="separator" />}
          <li>
            <button
              type="button"
              className="lang-option"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              {t.auth.signOut}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
