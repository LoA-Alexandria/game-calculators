/**
 * Password accounts identify with a username in the UI. Supabase Auth still
 * needs an email column, so we map usernames to a private, deterministic
 * address that is never shown to members and never receives mail.
 */

export const PASSWORD_ACCOUNT_EMAIL_DOMAIN = "accounts.popepoch.invalid";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;

export function isPasswordUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value.trim());
}

/** Lowercase username used for uniqueness and the synthetic email local-part. */
export function normalizePasswordUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function passwordAccountEmail(username: string): string {
  return `${normalizePasswordUsername(username)}@${PASSWORD_ACCOUNT_EMAIL_DOMAIN}`;
}
