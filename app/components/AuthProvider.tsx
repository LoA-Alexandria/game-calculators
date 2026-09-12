"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { can, type Permission, type Role } from "../../lib/auth/roles";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { BASE_PATH } from "../../lib/site";

type Session = { userId: string; name: string; handle: string; role: Role | null };
type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  error: string;
  allows: (permission: Permission) => boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function displaySession(session: SupabaseSession, canEdit: boolean): Session {
  const metadata = session.user.user_metadata;
  return {
    userId: session.user.id,
    name: metadata.full_name ?? metadata.name ?? metadata.preferred_username ?? "Discord member",
    handle: metadata.preferred_username ?? metadata.name ?? "discord-member",
    role: canEdit ? "guide_writer" : null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");

  const refreshAccess = useCallback(async (current: SupabaseSession) => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    if (current.provider_token) {
      const { error: verificationError } = await supabase.functions.invoke("verify-discord-role", { body: { providerToken: current.provider_token } });
      if (verificationError) setError("Discord role verification is temporarily unavailable.");
    }
    const { data, error: accessError } = await supabase.from("editor_access").select("can_edit").eq("user_id", current.user.id).maybeSingle();
    if (accessError) setError("Editor access could not be loaded.");
    setSession(displaySession(current, data?.can_edit === true));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void refreshAccess(data.session);
      else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) window.setTimeout(() => void refreshAccess(next), 0);
      else { setSession(null); setLoading(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, [refreshAccess, supabase]);

  const signIn = useCallback(async () => {
    if (!supabase) { setError("Supabase has not been configured for this deployment."); return; }
    setError("");
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: new URL(`${BASE_PATH}/`, window.location.origin).toString(), scopes: "identify guilds.members.read" },
    });
    if (signInError) setError(signInError.message);
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(() => ({ session, loading, error, allows: (permission) => can(session?.role, permission), signIn, signOut }), [error, loading, session, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
