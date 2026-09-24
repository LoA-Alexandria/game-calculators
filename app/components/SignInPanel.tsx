"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";

/**
 * Discord or username/password sign-in. Opens as a small panel from the topbar
 * instead of sending everyone straight to Discord OAuth.
 */
export function SignInPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const { signIn, signInWithPassword, signUpWithPassword, error } = useAuth();
  const ids = useId();
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setLocalError("");
    const name = username.trim();
    const ok =
      mode === "signIn"
        ? await signInWithPassword(name, password)
        : await signUpWithPassword(name, password);
    setBusy(false);
    if (ok) onClose();
    else if (!error) setLocalError(t.auth.authFailed);
  };

  return (
    <div className="menu-pop sign-in-panel" ref={root} role="dialog" aria-label={t.auth.signIn}>
      <div className="sign-in-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={mode === "signIn" ? "is-active" : undefined}
          aria-selected={mode === "signIn"}
          onClick={() => setMode("signIn")}
        >
          {t.auth.signIn}
        </button>
        <button
          type="button"
          role="tab"
          className={mode === "signUp" ? "is-active" : undefined}
          aria-selected={mode === "signUp"}
          onClick={() => setMode("signUp")}
        >
          {t.auth.signUp}
        </button>
      </div>

      <button
        type="button"
        className="button button-secondary sign-in-discord"
        onClick={() => void signIn()}
      >
        {t.auth.signInDiscord}
      </button>

      <p className="sign-in-or">{t.auth.orPassword}</p>

      <form
        className="sign-in-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={`${ids}-user`}>
          <span>{t.auth.username}</span>
          <input
            id={`${ids}-user`}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_]{3,24}"
            required
          />
        </label>
        <label htmlFor={`${ids}-password`}>
          <span>{t.auth.password}</span>
          <input
            id={`${ids}-password`}
            type="password"
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>
        {(localError || error) && (
          <p className="sign-in-error" role="alert">
            {localError || error}
          </p>
        )}
        <button className="button button-primary" type="submit" disabled={busy}>
          {mode === "signIn" ? t.auth.signIn : t.auth.signUp}
        </button>
      </form>
    </div>
  );
}
