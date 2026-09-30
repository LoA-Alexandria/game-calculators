"use client";

import { useAuth } from "../components/AuthProvider";
import { SignInCard } from "../components/SignInGate";
import { useLocale } from "../components/LocaleProvider";
import { ContentBuilder } from "./ContentBuilder";

export default function ContentBuilderPage() {
  const { t } = useLocale();
  const { session, loading } = useAuth();
  if (loading) return <div className="auth-screen"><div className="auth-card"><p>Checking access…</p></div></div>;
  if (!session) return <SignInCard />;
  if (!session.role) return <div className="auth-screen"><div className="auth-card"><h1>{t.auth.noAccess}</h1><p>{t.auth.signedInAs} <strong>{session.name}</strong></p></div></div>;
  return <ContentBuilder />;
}
