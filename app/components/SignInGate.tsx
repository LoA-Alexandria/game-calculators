"use client";

import { useState } from "react";
import Link from "next/link";
import { DEMO_ACCOUNTS } from "../../lib/auth/demo";
import { can, type Permission } from "../../lib/auth/roles";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";
import { AlertIcon } from "./Icons";

/** The demo sign-in form, with the credentials printed on it. */
export function SignInCard() {
  const { t } = useLocale();
  const { signIn } = useAuth();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);

  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          setFailed(!signIn(handle, password));
        }}
      >
        <h1>{t.auth.signIn}</h1>
        <p>{t.admin.title}</p>

        <div className="notice notice-warn">
          <AlertIcon className="icon" />
          <div>
            <strong>{t.auth.demoTitle}</strong>
            <p>{t.auth.demoBody}</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="handle">{t.auth.name}</label>
          <input
            id="handle"
            name="handle"
            autoComplete="off"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t.auth.password}</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {failed && <p className="result-error" role="alert">{t.auth.wrongCredentials}</p>}

        <div className="form-actions">
          <button className="button button-primary" type="submit">{t.auth.signIn}</button>
        </div>

        <div className="demo-creds">
          <div>{t.auth.demoAccounts}</div>
          {DEMO_ACCOUNTS.map((account) => (
            <div key={account.handle}>
              <b>{account.handle}</b> / {account.password} → {account.role}
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}

/**
 * Shows `children` only when the demo session holds `permission`.
 *
 * This is a convenience for the interface, not a security boundary: the page
 * and its code are already in the browser. Every write must be checked again
 * on the server.
 */
export function PermissionGate({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const { session } = useAuth();

  if (!session) return <SignInCard />;

  if (!can(session.role, permission)) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>{t.auth.noAccess}</h1>
          <p>
            {t.auth.signedInAs} <strong>{session.name}</strong> · {session.role}
          </p>
          <Link className="button" href="/admin/">{t.auth.toAdmin}</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
