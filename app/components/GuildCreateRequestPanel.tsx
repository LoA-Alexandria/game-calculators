"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  formatGuildServer,
  guildOwnerChoice,
  normalizeGuildOwnerHandle,
  normalizeGuildServerNumber,
  GUILD_OWNER_HANDLE_MAX,
  GUILD_SERVER_NUMBER_MAX,
  type GuildRequestOwnerKind,
} from "../../lib/content/guilds";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";
import { ChevronIcon, CloseIcon, GuildsIcon } from "./Icons";

type OwnRequest = {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  server_number: string;
  server_name: string;
};

/**
 * Premium perk: one guild-create request while the entitlement is active.
 *
 * The form used to stand open above the guild list and pushed it off the first
 * screen. It is a one-line bar now, and the form only appears when asked for.
 */
export function GuildCreateRequestPanel() {
  const { t, tf } = useLocale();
  const { session } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const [own, setOwn] = useState<OwnRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [serverNumber, setServerNumber] = useState("");
  const [serverName, setServerName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerKind, setOwnerKind] = useState<GuildRequestOwnerKind>("self");
  const [ownerHandle, setOwnerHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!supabase || !session) return;
    let gone = false;
    void (async () => {
      const { data, error: loadError } = await supabase
        .from("guild_create_requests")
        .select("id, name, status, server_number, server_name")
        .eq("user_id", session.userId)
        .in("status", ["pending", "approved"])
        .maybeSingle();
      if (gone) return;
      if (loadError) setError(loadError.message);
      else setOwn((data as OwnRequest | null) ?? null);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, session, reloadToken]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!session) return null;

  const serverLabel = formatGuildServer(serverNumber, serverName);
  const ownServerLabel = formatGuildServer(own?.server_number ?? "", own?.server_name ?? "");

  const submit = async () => {
    if (!supabase) return;
    if (name.trim().length < 2) {
      setError(t.premium.guildRequestNameRequired);
      return;
    }
    setBusy(true);
    setError("");
    const owner = guildOwnerChoice(ownerKind, ownerHandle, {
      userId: session.userId,
      discordUserId: session.discordUserId,
      name: session.name,
    });
    const { error: insertError } = await supabase.from("guild_create_requests").insert({
      user_id: session.userId,
      name: name.trim(),
      server_number: normalizeGuildServerNumber(serverNumber),
      server_name: serverName.trim(),
      description: description.trim(),
      status: "pending",
      ...owner,
    });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    setServerNumber("");
    setServerName("");
    setDescription("");
    setOwnerKind("self");
    setOwnerHandle("");
    setOpen(false);
    setReloadToken((value) => value + 1);
  };

  // One bar, four possible messages; its state decides what a tap opens.
  const pending = own?.status === "pending";
  const approved = own?.status === "approved";
  const locked = Boolean(own);

  const barLabel = pending
    ? tf(t.premium.guildRequestBarPending, { name: own?.name ?? "" })
    : approved
      ? tf(t.premium.guildRequestBarApproved, { name: own?.name ?? "" })
      : session.premium
        ? t.premium.guildRequestBarOpen
        : t.premium.guildRequestBarPremium;

  const bar = (
    <div className="guild-request-bar-row">
      {session.premium || locked ? (
        <button
          type="button"
          className="guild-request-bar"
          data-state={pending ? "pending" : approved ? "approved" : "open"}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <GuildsIcon className="icon" />
          <span className="guild-request-bar-label">{barLabel}</span>
          <ChevronIcon className="icon icon-sm" />
        </button>
      ) : (
        <Link className="guild-request-bar" data-state="premium" href="/premium/">
          <GuildsIcon className="icon" />
          <span className="guild-request-bar-label">{barLabel}</span>
          <ChevronIcon className="icon icon-sm" />
        </Link>
      )}
    </div>
  );

  if (!open) {
    return (
      <>
        {bar}
        {error ? (
          <p className="result-error" role="alert">
            {error}
          </p>
        ) : null}
      </>
    );
  }

  // `.content > *` caps its children at the 1440px reading column, which cut
  // the backdrop off at both sides. The dialog belongs to the window, so it
  // renders on <body> instead of inside the page.
  const dialog = (
    <div className="guild-modal-layer">
      <button
        type="button"
        className="guild-modal-backdrop"
        aria-label={t.premium.guildRequestClose}
        onClick={() => setOpen(false)}
      />
      <div className="guild-modal" role="dialog" aria-modal="true" aria-label={t.premium.guildRequestTitle}>
        <header className="guild-modal-head">
          <h2>{t.premium.guildRequestTitle}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t.premium.guildRequestClose}
            onClick={() => setOpen(false)}
          >
            <CloseIcon className="icon" />
          </button>
        </header>

        {error ? (
          <p className="sign-in-error" role="alert">
            {error}
          </p>
        ) : null}

        {locked ? (
          <>
            <p>{pending ? t.premium.guildRequestPending : t.premium.guildRequestApproved}</p>
            <p className="assumption">
              {own?.name}
              {ownServerLabel ? ` · ${ownServerLabel}` : ""}
            </p>
            <p className="assumption">{t.premium.guildRequestLocked}</p>
          </>
        ) : (
          <form
            className="premium-claim-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <p className="assumption">{t.premium.guildRequestLede}</p>

            <label htmlFor={`${ids}-name`}>
              <span>{t.premium.guildRequestName}</span>
              <input
                id={`${ids}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </label>

            <div className="guild-request-server">
              <label htmlFor={`${ids}-server-no`}>
                <span>{t.premium.guildRequestServerNumber}</span>
                <input
                  id={`${ids}-server-no`}
                  value={serverNumber}
                  inputMode="numeric"
                  maxLength={GUILD_SERVER_NUMBER_MAX}
                  onChange={(event) => setServerNumber(normalizeGuildServerNumber(event.target.value))}
                />
              </label>
              <label htmlFor={`${ids}-server-name`}>
                <span>{t.premium.guildRequestServerName}</span>
                <input
                  id={`${ids}-server-name`}
                  value={serverName}
                  maxLength={80}
                  onChange={(event) => setServerName(event.target.value)}
                />
              </label>
            </div>
            {serverLabel ? (
              <p className="assumption">
                {t.premium.guildRequestServerPreview} <strong>{serverLabel}</strong>
              </p>
            ) : null}

            <label htmlFor={`${ids}-desc`}>
              <span>{t.premium.guildRequestDescription}</span>
              <input
                id={`${ids}-desc`}
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <fieldset className="guild-request-owner">
              <legend>{t.premium.guildRequestOwner}</legend>
              <div className="guild-request-owner-choice">
                <label>
                  <input
                    type="radio"
                    name={`${ids}-owner`}
                    value="self"
                    checked={ownerKind === "self"}
                    onChange={() => setOwnerKind("self")}
                  />
                  <span>{t.premium.guildRequestOwnerSelf}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name={`${ids}-owner`}
                    value="other"
                    checked={ownerKind === "other"}
                    onChange={() => setOwnerKind("other")}
                  />
                  <span>{t.premium.guildRequestOwnerOther}</span>
                </label>
              </div>
              {ownerKind === "other" ? (
                <label htmlFor={`${ids}-handle`}>
                  <span>{t.premium.guildRequestOwnerHandle}</span>
                  <input
                    id={`${ids}-handle`}
                    value={ownerHandle}
                    maxLength={GUILD_OWNER_HANDLE_MAX}
                    onChange={(event) => setOwnerHandle(normalizeGuildOwnerHandle(event.target.value))}
                  />
                </label>
              ) : null}
              <p className="assumption">
                {ownerKind === "other"
                  ? tf(t.premium.guildRequestOwnerFallback, { name: session.name })
                  : tf(t.premium.guildRequestOwnerSelfHint, { name: session.name })}
              </p>
            </fieldset>

            <button className="button button-primary" type="submit" disabled={busy}>
              {t.premium.guildRequestSubmit}
            </button>
          </form>
        )}
    </div>
    </div>
  );

  return (
    <>
      {bar}
      {typeof document === "undefined" ? null : createPortal(dialog, document.body)}
    </>
  );
}
