import assert from "node:assert/strict";
import test from "node:test";

import {
  isPasswordUsername,
  normalizePasswordUsername,
  passwordAccountEmail,
  PASSWORD_ACCOUNT_EMAIL_DOMAIN,
} from "../lib/auth/password-account.ts";

test("password usernames are 3–24 letters, numbers, or underscores", () => {
  assert.equal(isPasswordUsername("Alex"), true);
  assert.equal(isPasswordUsername("a_b1"), true);
  assert.equal(isPasswordUsername("ab"), false);
  assert.equal(isPasswordUsername("has space"), false);
  assert.equal(isPasswordUsername("bad@name"), false);
});

test("synthetic email is deterministic and private", () => {
  assert.equal(normalizePasswordUsername("Alex_01"), "alex_01");
  assert.equal(passwordAccountEmail("Alex_01"), `alex_01@${PASSWORD_ACCOUNT_EMAIL_DOMAIN}`);
  assert.equal(PASSWORD_ACCOUNT_EMAIL_DOMAIN.endsWith(".invalid"), true);
});
