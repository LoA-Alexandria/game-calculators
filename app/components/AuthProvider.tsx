"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { can, isRole, type Permission, type Role } from "../../lib/auth/roles";
import { isPasswordUsername, passwordAccountEmail } from "../../lib/auth/password-account";
import { isPremiumActive, type PremiumEntitlement } from "../../lib/content/premium";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type Session = {
  userId: string;
  name: string;
  handle: string;
  role: Role | null;
  /** Discord snowflake from `editor_access`; used for guild-master matching. */
  discordUserId: string | null;
  premium: boolean;
  premiumExpiresAt: string | null;
};

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  error: string;
  allows: (permission: Permission) => boolean;
  /** Discord OAuth; optional redirect after return. */
  signIn: (redirectTo?: string) => Promise<void>;
  signInWithPassword: (username: string, password: string) => Promise<boolean>;
  signUpWithPassword: (username: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
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

function displaySession(
  session: SupabaseSession,
  role: Role | null,
  discordUserId: string | null,
  username: string | null,
  premium: PremiumEntitlement | null,
): Session {
  const metadata = session.user.user_metadata;
  const fromDiscord = metadata.full_name ?? metadata.name ?? metadata.preferred_username;
  const name = username || fromDiscord || session.user.email?.split("@")[0] || "Member";
  const handle = username || metadata.preferred_username || metadata.name || session.user.email?.split("@")[0] || "member";
  return {
    userId: session.user.id,
    name,
    handle,
    role,
    discordUserId,
    premium: isPremiumActive(premium),
    premiumExpiresAt: premium && isPremiumActive(premium) ? premium.expires_at : null,
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
      const { error: verificationError } = await supabase.functions.invoke("verify-discord-role", {
        body: { providerToken: current.provider_token },
      });
      if (verificationError) {
        const detail = await functionErrorDetail(verificationError);
        setError(detail || "Discord role verification is temporarily unavailable.");
      }
    }
    const [access, profile, premium] = await Promise.all([
      supabase.from("editor_access").select("role, can_edit, discord_user_id").eq("user_id", current.user.id).maybeSingle(),
      supabase.from("profiles").select("username").eq("user_id", current.user.id).maybeSingle(),
      supabase
        .from("premium_entitlements")
        .select("user_id, status, starts_at, expires_at, source, paypal_txn_id, note")
        .eq("user_id", current.user.id)
        .maybeSingle(),
    ]);
    if (access.error) setError("Editor access could not be loaded.");
    // `role` is the real answer; `can_edit` is the older column, still read so
    // a session that predates the migration keeps working until it is dropped.
    const stored = isRole(access.data?.role)
      ? access.data.role
      : access.data?.can_edit === true
        ? "guide_writer"
        : null;
    const discordUserId =
      typeof access.data?.discord_user_id === "string" && access.data.discord_user_id.length > 0
        ? access.data.discord_user_id
        : null;
    const username =
      typeof profile.data?.username === "string" && profile.data.username.length > 0
        ? profile.data.username
        : null;
    setSession(
      displaySession(
        current,
        stored,
        discordUserId,
        username,
        (premium.data as PremiumEntitlement | null) ?? null,
      ),
    );
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
      else {
        setSession(null);
        setLoading(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [refreshAccess, supabase]);

  const signIn = useCallback(
    async (redirectTo?: string) => {
      if (!supabase) {
        setError("Supabase has not been configured for this deployment.");
        return;
      }
      setError("");
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: redirectTo ?? window.location.href,
          scopes: "identify guilds.members.read",
        },
      });
      if (signInError) setError(signInError.message);
    },
    [supabase],
  );

  const signInWithPassword = useCallback(
    async (username: string, password: string) => {
      if (!supabase) {
        setError("Supabase has not been configured for this deployment.");
        return false;
      }
      setError("");
      if (!isPasswordUsername(username)) {
        setError("Username must be 3–24 letters, numbers, or underscores.");
        return false;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: passwordAccountEmail(username),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return false;
      }
      return true;
    },
    [supabase],
  );

  const signUpWithPassword = useCallback(
    async (username: string, password: string) => {
      if (!supabase) {
        setError("Supabase has not been configured for this deployment.");
        return false;
      }
      setError("");
      const clean = username.trim();
      if (!isPasswordUsername(clean)) {
        setError("Username must be 3–24 letters, numbers, or underscores.");
        return false;
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: passwordAccountEmail(clean),
        password,
        options: { data: { username: clean, full_name: clean } },
      });
      if (signUpError) {
        setError(signUpError.message);
        return false;
      }
      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          user_id: data.user.id,
          username: clean,
          updated_at: new Date().toISOString(),
        });
        if (profileError) {
          setError(profileError.message);
          return false;
        }
      }
      return true;
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
  }, [supabase]);

  const refreshSession = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) await refreshAccess(data.session);
  }, [refreshAccess, supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      error,
      allows: (permission) => can(session?.role, permission),
      signIn,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      refreshSession,
    }),
    [error, loading, refreshSession, session, signIn, signInWithPassword, signOut, signUpWithPassword],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
