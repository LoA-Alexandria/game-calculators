/**
 * Roles and permissions.
 *
 * This file is the contract between the interface and whatever backend ends up
 * enforcing it. The UI uses it to decide what to show; the server must use the
 * same table to decide what to allow. **Hiding a button is not access control.**
 *
 * Adding a permission: add it to `PERMISSIONS`, then grant it in
 * `ROLE_PERMISSIONS`. TypeScript will point at any role you forgot.
 */
export const ROLES = ["admin", "manager", "guide_writer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  /** Create and edit guide drafts. */
  "guides.draft",
  /** Make a guide visible on the public site. */
  "guides.publish",
  /** Write news entries. */
  "news.write",
  /** Upload images for guides and news. */
  "media.upload",
  /** Map Discord roles onto site roles. */
  "roles.assign",
  /** Add, remove, and re-role team members. */
  "members.manage",
  /** Change site-wide settings. */
  "settings.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  manager: ["guides.draft", "guides.publish", "news.write", "media.upload", "members.manage"],
  guide_writer: ["guides.draft", "media.upload"],
};

/**
 * Higher wins when someone holds several mapped Discord roles at once. The
 * backend needs the same rule, otherwise a user's effective role depends on
 * the order Discord happens to return their roles in.
 */
export const ROLE_RANK: Record<Role, number> = {
  guide_writer: 1,
  manager: 2,
  admin: 3,
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function highestRole(roles: readonly Role[]): Role | null {
  return roles.reduce<Role | null>(
    (best, role) => (best === null || ROLE_RANK[role] > ROLE_RANK[best] ? role : best),
    null,
  );
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
