"use client";

import { can, type Permission } from "../../lib/auth/roles";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";
import { DiscordIcon } from "./Icons";

export function SignInCard() {
  const { t } = useLocale();
  const { signIn, error } = useAuth();
  return <div className="auth-screen"><div className="auth-card">
    <h1>{t.auth.signIn}</h1>
    <p>{t.auth.needSignIn}</p>
    <button className="button button-primary" type="button" onClick={() => void signIn()}><DiscordIcon className="icon" /> {t.auth.signIn}</button>
    {error && <p className="result-error" role="alert">{error}</p>}
  </div></div>;
}

export function PermissionGate({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { t } = useLocale();
  const { session, loading, error } = useAuth();
  if (loading) return <div className="auth-screen"><div className="auth-card"><p>Checking Discord access…</p></div></div>;
  if (!session) return <SignInCard />;
  if (!can(session.role, permission)) return <div className="auth-screen"><div className="auth-card">
    <h1>{t.auth.noAccess}</h1>
    <p>{t.auth.signedInAs} <strong>{session.name}</strong></p>
    {error && <p className="result-error" role="alert">{error}</p>}
  </div></div>;
  return <>{children}</>;
}
