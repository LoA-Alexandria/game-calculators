import type { Role } from "./roles.ts";

/* ==========================================================================
   DEMO DATA — NOT SECURITY
   ==========================================================================

   The site is a static export with no server, so there is nowhere to verify a
   password. Everything in this file ships to the browser in plain text: any
   visitor can read these credentials in the JavaScript bundle, and any visitor
   can grant themselves a role by editing localStorage.

   It exists so the admin and editor screens can be built, reviewed, and
   translated before the backend exists. The data shapes here are the ones the
   real API should return.

   Before this site handles anything that matters, DELETE this file and follow
   docs/AUTH-AND-CMS.md. Do not extend it, and do not put a real password in it.
   ========================================================================== */

export type DemoAccount = {
  handle: string;
  password: string;
  name: string;
  role: Role;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { handle: "admin", password: "demo-admin", name: "Demo Admin", role: "admin" },
  { handle: "manager", password: "demo-manager", name: "Demo Manager", role: "manager" },
  { handle: "writer", password: "demo-writer", name: "Demo Guide Writer", role: "guide_writer" },
];

/** Mirrors what a real `GET /api/session` would answer. */
export type Session = {
  name: string;
  handle: string;
  role: Role;
  /** ISO timestamp. */
  signedInAt: string;
  /** Always true here — a reminder that this session proves nothing. */
  demo: true;
};

export function checkDemoCredentials(handle: string, password: string): Session | null {
  const account = DEMO_ACCOUNTS.find(
    (candidate) =>
      candidate.handle.toLowerCase() === handle.trim().toLowerCase() &&
      candidate.password === password,
  );
  if (!account) return null;
  return {
    name: account.name,
    handle: account.handle,
    role: account.role,
    signedInAt: new Date().toISOString(),
    demo: true,
  };
}

/** A Discord role mapped onto a site role. */
export type RoleMapping = {
  id: string;
  discordRoleName: string;
  /** Discord snowflake. The IDs below are placeholders, not real roles. */
  discordRoleId: string;
  role: Role;
};

export const DEMO_MAPPINGS: readonly RoleMapping[] = [
  { id: "map-1", discordRoleName: "Alexandria Lead", discordRoleId: "100000000000000001", role: "admin" },
  { id: "map-2", discordRoleName: "Officer", discordRoleId: "100000000000000002", role: "manager" },
  { id: "map-3", discordRoleName: "Guide Team", discordRoleId: "100000000000000003", role: "guide_writer" },
];

/** A team member as the members endpoint would return them. */
export type Member = {
  id: string;
  name: string;
  discordTag: string;
  role: Role;
  /** ISO date of their last sign-in, or null if never. */
  lastSeen: string | null;
};

export const DEMO_MEMBERS: readonly Member[] = [
  { id: "u-1", name: "Demo Admin", discordTag: "demo_admin", role: "admin", lastSeen: "2026-09-12" },
  { id: "u-2", name: "Demo Manager", discordTag: "demo_manager", role: "manager", lastSeen: "2026-09-11" },
  { id: "u-3", name: "Demo Guide Writer", discordTag: "demo_writer", role: "guide_writer", lastSeen: "2026-09-10" },
  { id: "u-4", name: "Demo Newcomer", discordTag: "demo_newcomer", role: "guide_writer", lastSeen: null },
];
