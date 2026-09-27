"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  guildListingStatus,
  premiumDaysLeft,
  premiumRunsOutSoon,
  type PremiumRow,
} from "../../lib/content/account";
import { isDiscordUserId, guildRoomHref, type Guild } from "../../lib/content/guilds";
import {
  isLifetimePremium,
  isPremiumActive,
  PREMIUM_PERIOD_DAYS,
  PREMIUM_PRICE_EUR,
} from "../../lib/content/premium";
import { PREMIUM_HREF } from "../../lib/site";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { SignInCard } from "../components/SignInGate";
import { GlobeIcon, StarIcon } from "../components/Icons";
import { PageHead } from "../components/Ui";

type OwnRequest = {
  id: string;
  name: string;
  status: string;
  created_guild_id: string | null;
};

type OwnGuild = Pick<Guild, "id" | "slug" | "name" | "server_name" | "master_discord_user_id">;

/** Your Premium and the guild it holds open, in one place. */
export default function AccountPage() {
  const { t, tf, d } = useLocale();
  const { session, loading, refreshSession } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  useDocumentTitle(t.account.title);

  const [premium, setPremium] = useState<PremiumRow | null>(null);
  const [request, setRequest] = useState<OwnRequest | null>(null);
  const [guild, setGuild] = useState<OwnGuild | null>(null);
  const [masterDraft, setMasterDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    if (!supabase || !session) return;
    let gone = false;
    void (async () => {
      const [premiumRow, requestRow] = await Promise.all([
        supabase
          .from("premium_entitlements")
          .select("status, expires_at, note, auto_renew")
          .eq("user_id", session.userId)
          .maybeSingle(),
        supabase
          .from("guild_create_requests")
          .select("id, name, status, created_guild_id")
          .eq("user_id", session.userId)
          .in("status", ["pending", "approved"])
          .maybeSingle(),
      ]);
      if (gone) return;
      if (premiumRow.error) setError(premiumRow.error.message);
      else setPremium((premiumRow.data as PremiumRow | null) ?? null);
      if (requestRow.error) setError(requestRow.error.message);
      else setRequest((requestRow.data as OwnRequest | null) ?? null);

      const guildId = (requestRow.data as OwnRequest | null)?.created_guild_id;
      if (!guildId) {
        setGuild(null);
        return;
      }
      const guildRow = await supabase
        .from("guilds")
        .select("id, slug, name, server_name, master_discord_user_id")
        .eq("id", guildId)
        .maybeSingle();
      if (gone) return;
      if (guildRow.error) setError(guildRow.error.message);
      else {
        const row = (guildRow.data as OwnGuild | null) ?? null;
        setGuild(row);
        setMasterDraft(row?.master_discord_user_id ?? "");
      }
    })();
    return () => {
      gone = true;
    };
  }, [supabase, session, reloadToken]);

  const active = isPremiumActive(premium);
  const lifetime = isLifetimePremium(premium);
  const daysLeft = useMemo(() => premiumDaysLeft(premium?.expires_at), [premium]);
  const runningOut = useMemo(() => premiumRunsOutSoon(premium), [premium]);
  const listing = guildListingStatus(request);

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p>…</p>
        </div>
      </div>
    );
  }
  if (!session) return <SignInCard />;

  const setAutoRenew = async (on: boolean) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    const { error: rpcError } = await supabase.rpc("set_premium_auto_renew", { p_on: on });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setPremium((row) => (row ? { ...row, auto_renew: on } : row));
  };

  const saveMaster = async () => {
    if (!supabase || !guild) return;
    const id = masterDraft.trim();
    if (!isDiscordUserId(id)) {
      setError(t.account.guildMasterInvalid);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const { error: rpcError } = await supabase.rpc("set_guild_master", {
      p_guild_id: guild.id,
      p_discord_user_id: id,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setMessage(t.account.guildMasterSaved);
    reload();
  };

  const deleteGuild = async () => {
    if (!supabase || !guild) return;
    setBusy(true);
    setError("");
    setMessage("");
    const { error: rpcError } = await supabase.rpc("delete_own_guild", { p_guild_id: guild.id });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setConfirmDelete(false);
    setMessage(t.account.guildDeleted);
    await refreshSession();
    reload();
  };

  const priceVars = { price: PREMIUM_PRICE_EUR, days: PREMIUM_PERIOD_DAYS };

  return (
    <>
      <PageHead eyebrow={t.account.eyebrow} title={t.account.title} lede={t.account.lede} />

      {error ? (
        <p className="result-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="assumption" role="status">
          {message}
        </p>
      ) : null}

      <section className="panel account-panel">
        <h2>
          <StarIcon className="icon" /> {t.premium.badge}
        </h2>

        {lifetime ? (
          <p className="account-premium-state" data-state="lifetime">
            {t.account.premiumLifetime}
          </p>
        ) : active ? (
          <>
            <p className="account-premium-state" data-state={runningOut ? "soon" : "active"}>
              {tf(t.account.premiumActive, {
                when: d((premium?.expires_at ?? "").slice(0, 10)),
                days: daysLeft,
              })}
            </p>
            {runningOut ? <p className="assumption">{t.account.premiumRunningOut}</p> : null}
          </>
        ) : (
          <p className="account-premium-state" data-state="none">
            {t.account.premiumNone}
          </p>
        )}

        {active && !lifetime ? (
          <div className="account-renew">
            <label className="account-toggle" htmlFor={`${ids}-auto`}>
              <input
                id={`${ids}-auto`}
                type="checkbox"
                checked={Boolean(premium?.auto_renew)}
                disabled={busy}
                onChange={(event) => void setAutoRenew(event.target.checked)}
              />
              <span>{t.account.autoRenew}</span>
            </label>
            <p className="assumption">{tf(t.account.autoRenewNote, priceVars)}</p>
          </div>
        ) : null}

        <p className="account-actions">
          <a className="button button-primary" href={PREMIUM_HREF} target="_blank" rel="noreferrer">
            {active ? tf(t.premium.payAgain, priceVars) : tf(t.premium.payCta, priceVars)}
          </a>
          <Link className="small-button" href="/premium/#claim">
            {t.premium.claimTitle}
          </Link>
        </p>
      </section>

      <section className="panel account-panel">
        <h2>{t.account.guildTitle}</h2>

        {listing === "none" ? (
          <>
            <p>{t.account.guildNone}</p>
            <p className="account-actions">
              <Link className="button button-secondary" href="/guilds/">
                {t.nav.guilds}
              </Link>
            </p>
          </>
        ) : listing === "pending" ? (
          <>
            <p>{t.premium.guildRequestPending}</p>
            <p className="assumption">{request?.name}</p>
          </>
        ) : guild ? (
          <>
            <div className="account-guild">
              <div>
                <h3>{guild.name}</h3>
                {guild.server_name ? (
                  <p className="guild-chip">
                    <GlobeIcon className="icon" />
                    {guild.server_name}
                  </p>
                ) : null}
              </div>
              <Link className="small-button" href={guildRoomHref(guild.slug)}>
                {t.guilds.openRoom}
              </Link>
            </div>

            <div className="field account-master">
              <label htmlFor={`${ids}-master`}>{t.account.guildMaster}</label>
              <input
                id={`${ids}-master`}
                className="mono"
                inputMode="numeric"
                value={masterDraft}
                onChange={(event) => setMasterDraft(event.target.value)}
              />
              <p className="label-note">{t.account.guildMasterHint}</p>
              <button
                className="small-button button-primary"
                type="button"
                disabled={busy || masterDraft.trim() === guild.master_discord_user_id}
                onClick={() => void saveMaster()}
              >
                {t.account.guildMasterSave}
              </button>
            </div>

            <div className="account-danger">
              {confirmDelete ? (
                <>
                  <p>{t.account.guildDeleteConfirm}</p>
                  <p className="account-actions">
                    <button
                      className="small-button button-danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteGuild()}
                    >
                      {t.account.guildDelete}
                    </button>
                    <button
                      className="small-button"
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDelete(false)}
                    >
                      {t.guilds.requestCancel}
                    </button>
                  </p>
                </>
              ) : (
                <button
                  className="small-button button-danger"
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  {t.account.guildDelete}
                </button>
              )}
              <p className="assumption">{t.account.guildDeleteNote}</p>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
