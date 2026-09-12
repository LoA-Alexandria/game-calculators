"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import {
  checkDemoCredentials,
  DEMO_MAPPINGS,
  type RoleMapping,
  type Session,
} from "../../lib/auth/demo";
import { can, isRole, type Permission, type Role } from "../../lib/auth/roles";
import { MAPPINGS_STORAGE_KEY, SESSION_STORAGE_KEY } from "../../lib/site";
import { createPersistentStore } from "./persistentStore";

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.handle === "string" &&
    isRole(candidate.role) &&
    typeof candidate.signedInAt === "string"
  );
}

function parseJson<T>(raw: string | null, guard: (value: unknown) => value is T): T | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The demo session. It lives in localStorage and proves nothing — see the
 * warning at the top of lib/auth/demo.ts. Replace this store with a call to a
 * real session endpoint; the `Session` shape stays the same.
 */
const sessionStore = createPersistentStore<Session | null>({
  key: SESSION_STORAGE_KEY,
  serverValue: null,
  parse: (raw) => parseJson(raw, isSession),
  fallback: () => null,
  serialize: (value) => JSON.stringify(value),
});

/** Discord-role mappings edited in the admin panel. */
const mappingStore = createPersistentStore<RoleMapping[]>({
  key: MAPPINGS_STORAGE_KEY,
  serverValue: [...DEMO_MAPPINGS],
  parse: (raw) =>
    parseJson(raw, (value): value is RoleMapping[] =>
      Array.isArray(value) &&
      value.every(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as RoleMapping).discordRoleName === "string" &&
          isRole((entry as RoleMapping).role),
      ),
    ),
  fallback: () => [...DEMO_MAPPINGS],
  serialize: (value) => JSON.stringify(value),
});

type AuthContextValue = {
  session: Session | null;
  role: Role | null;
  /** Whether the signed-in role holds a permission. UI hint only. */
  allows: (permission: Permission) => boolean;
  signIn: (handle: string, password: string) => boolean;
  signOut: () => void;
  mappings: RoleMapping[];
  setMappings: (mappings: RoleMapping[]) => void;
  resetMappings: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getServerSnapshot,
  );
  const mappings = useSyncExternalStore(
    mappingStore.subscribe,
    mappingStore.getSnapshot,
    mappingStore.getServerSnapshot,
  );

  const signIn = useCallback((handle: string, password: string) => {
    const next = checkDemoCredentials(handle, password);
    if (!next) return false;
    sessionStore.set(next);
    return true;
  }, []);

  const signOut = useCallback(() => sessionStore.clear(), []);
  const setMappings = useCallback((next: RoleMapping[]) => mappingStore.set(next), []);
  const resetMappings = useCallback(() => mappingStore.clear(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      role: session?.role ?? null,
      allows: (permission) => can(session?.role, permission),
      signIn,
      signOut,
      mappings,
      setMappings,
      resetMappings,
    }),
    [session, mappings, signIn, signOut, setMappings, resetMappings],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
