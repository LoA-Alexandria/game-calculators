"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { can, isRole, type Permission, type Role } from "../../lib/auth/roles";
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

/**
 * `functions.invoke` reports any non-2xx as one generic error, which hid the
 * reason behind "temporarily unavailable" — a member missing from the guild and
 * an undeployed function looked identical. The failing `Response` hangs off the
 * error as `context`; this reads the function's own `{ error }` out of it.
 *
 * Duck-typed on purpose: `FunctionsHttpError` lives in a sub-package, and
 * matching on the shape survives that moving.
 */
async function functionErrorDetail(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return "";
  try {
    const body: unknown = await context.clone().json();
    const reported = (body as { error?: unknown })?.error;
    return typeof reported === "string" ? reported : "";
  } catch {
    return "";
  }
}

function displaySession(session: SupabaseSession, role: Role | null): Session {
  const metadata = session.user.user_metadata;
  return {
    userId: session.user.id,
    name: metadata.full_name ?? metadata.name ?? metadata.preferred_username ?? "Discord member",
    handle: metadata.preferred_username ?? metadata.name ?? "discord-member",
    role,
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
      if (verificationError) {
        const detail = await functionErrorDetail(verificationError);
        setError(detail || "Discord role verification is temporarily unavailable.");
      }
    }
    const { data, error: accessError } = await supabase
      .from("editor_access")
      .select("role, can_edit")
      .eq("user_id", current.user.id)
      .maybeSingle();
    if (accessError) setError("Editor access could not be loaded.");
    // `role` is the real answer; `can_edit` is the older column, still read so
    // a session that predates the migration keeps working until it is dropped.
    const stored = isRole(data?.role) ? data.role : data?.can_edit === true ? "guide_writer" : null;
    setSession(displaySession(current, stored));
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
