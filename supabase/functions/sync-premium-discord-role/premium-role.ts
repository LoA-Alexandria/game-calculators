export type PremiumRoleEntitlement = {
  status?: unknown;
  starts_at?: string | null;
  expires_at?: string | null;
};

export function premiumRoleShouldBePresent(entitlement: PremiumRoleEntitlement | null, now = Date.now()): boolean {
  if (entitlement?.status !== "active" || !entitlement.starts_at || !entitlement.expires_at) return false;
  const startsAt = Date.parse(entitlement.starts_at);
  const expiresAt = Date.parse(entitlement.expires_at);
  return Number.isFinite(startsAt) && Number.isFinite(expiresAt) && startsAt <= now && expiresAt > now;
}
