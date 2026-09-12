"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type AccessState = "checking" | "editor" | "member";

function redirectUrl() {
  const basePath = window.location.hostname.endsWith("github.io") ? "/game-calculators/" : "/";
  return new URL(basePath, window.location.origin).toString();
}

export function AuthControls() {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<AccessState>("checking");
  const [error, setError] = useState("");

  const checkAccess = useCallback(async (currentSession: Session) => {
    if (!supabase) return;
    setAccess("checking");
    if (currentSession.provider_token) {
      const { error: verificationError } = await supabase.functions.invoke("verify-discord-role", {
        body: { providerToken: currentSession.provider_token },
      });
      if (verificationError) setError("We could not refresh your Discord role yet.");
    }
    const { data } = await supabase.from("editor_access").select("can_edit").eq("user_id", currentSession.user.id).maybeSingle();
    setAccess(data?.can_edit ? "editor" : "member");
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void checkAccess(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) window.setTimeout(() => void checkAccess(nextSession), 0);
      else setAccess("checking");
    });
    return () => listener.subscription.unsubscribe();
  }, [checkAccess, supabase]);

  if (!supabase) return <span className="auth-note">Discord login awaiting site configuration</span>;

  if (!session) {
    return <button className="auth-button" type="button" onClick={async () => {
      setError("");
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: redirectUrl(), scopes: "identify guilds.members.read" },
      });
      if (signInError) setError(signInError.message);
    }}>Sign in with Discord</button>;
  }

  const name = session.user.user_metadata.full_name ?? session.user.user_metadata.name ?? session.user.user_metadata.preferred_username ?? "Discord member";
  return <div className="auth-account">
    <span>{name}{access === "editor" && <strong>Wiki editor</strong>}{access === "checking" && <small>Checking role…</small>}{access === "member" && <small>Member access</small>}</span>
    <button type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
    {error && <small className="auth-error">{error}</small>}
  </div>;
}
