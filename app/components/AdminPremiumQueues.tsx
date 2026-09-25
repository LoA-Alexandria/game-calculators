"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  isLifetimePremium,
  isPremiumActive,
  lifetimePremiumExpiry,
  nextPremiumExpiry,
  PREMIUM_LIFETIME_NOTE,
  type PremiumEntitlement,
} from "../../lib/content/premium";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";

type Claim = {
  id: string;
  user_id: string;
  paypal_txn_id: string;
  status: string;
  note: string | null;
  created_at: string;
};

type GuildRequest = {
  id: string;
  user_id: string;
  name: string;
  server_name: string;
  description: string;
  master_discord_user_id: string;
  status: string;
  created_at: string;
};

type ProfileRow = { user_id: string; username: string };
type AccessRow = { user_id: string; discord_user_id: string };

type MemberOption = {
  userId: string;
  label: string;
  username: string | null;
  discordUserId: string | null;
};

type EntitlementRow = Pick<
  PremiumEntitlement,
  "user_id" | "status" | "expires_at" | "source" | "note"
>;

/**
 * Admin queue for PayPal Premium claims and guild-create requests.
 * Approving a claim extends `premium_entitlements` by 30 days.
 * Admins can also grant Lifetime Premium (far-future expiry + note).
 */
export function AdminPremiumQueues({ reloadToken, onChanged }: { reloadToken: number; onChanged: () => void }) {
  const { t, d } = useLocale();
  const { session } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [guildRequests, setGuildRequests] = useState<GuildRequest[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [accessRows, setAccessRows] = useState<AccessRow[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [manualUserId, setManualUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const [claimRows, guildRows, profileRows, access, premiumRows] = await Promise.all([
        supabase
          .from("premium_claims")
          .select("id, user_id, paypal_txn_id, status, note, created_at")
          .eq("status", "pending")
          .order("created_at"),
        supabase
          .from("guild_create_requests")
          .select("id, user_id, name, server_name, description, master_discord_user_id, status, created_at")
          .eq("status", "pending")
          .order("created_at"),
        supabase.from("profiles").select("user_id, username").order("username"),
        supabase.from("editor_access").select("user_id, discord_user_id"),
        supabase
          .from("premium_entitlements")
          .select("user_id, status, expires_at, source, note")
          .order("expires_at", { ascending: false }),
      ]);
      if (gone) return;
      if (claimRows.error) setError(claimRows.error.message);
      else setClaims((claimRows.data ?? []) as Claim[]);
      if (guildRows.error) setError(guildRows.error.message);
      else setGuildRequests((guildRows.data ?? []) as GuildRequest[]);
      if (profileRows.error) setError(profileRows.error.message);
      else setProfiles((profileRows.data ?? []) as ProfileRow[]);
      if (access.error) setError(access.error.message);
      else setAccessRows((access.data ?? []) as AccessRow[]);
      if (premiumRows.error) setError(premiumRows.error.message);
      else setEntitlements((premiumRows.data ?? []) as EntitlementRow[]);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, reloadToken]);

  const members = useMemo(() => {
    const byId = new Map<string, MemberOption>();
    for (const profile of profiles) {
      byId.set(profile.user_id, {
        userId: profile.user_id,
        username: profile.username,
        discordUserId: null,
        label: profile.username,
      });
    }
    for (const row of accessRows) {
      const existing = byId.get(row.user_id);
      if (existing) {
        existing.discordUserId = row.discord_user_id;
        if (!existing.username) {
          existing.label = row.discord_user_id;
        }
      } else {
        byId.set(row.user_id, {
          userId: row.user_id,
          username: null,
          discordUserId: row.discord_user_id,
          label: row.discord_user_id,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [accessRows, profiles]);

  const entitlementByUser = useMemo(() => {
    const map = new Map<string, EntitlementRow>();
    for (const row of entitlements) map.set(row.user_id, row);
    return map;
  }, [entitlements]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members.slice(0, 40);
    return members
      .filter(
        (member) =>
          member.label.toLowerCase().includes(q) ||
          member.userId.toLowerCase().includes(q) ||
          (member.username?.toLowerCase().includes(q) ?? false) ||
          (member.discordUserId?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 40);
  }, [members, search]);

  const activeEntitlements = useMemo(
    () => entitlements.filter((row) => isPremiumActive(row)),
    [entitlements],
  );

  const reviewClaim = async (claim: Claim, approve: boolean) => {
    if (!supabase || !session) return;
    setBusy(true);
    setError("");
    setGranted(false);
    const reviewedAt = new Date().toISOString();
    if (approve) {
      const existing = await supabase
        .from("premium_entitlements")
        .select("expires_at, starts_at, note")
        .eq("user_id", claim.user_id)
        .maybeSingle();
      if (existing.error) {
        setError(existing.error.message);
        setBusy(false);
        return;
      }
      // Do not shorten an existing lifetime grant when approving a paid claim.
      if (isLifetimePremium(existing.data)) {
        const { error: updateError } = await supabase
          .from("premium_claims")
          .update({
            status: "approved",
            reviewed_at: reviewedAt,
            reviewed_by: session.userId,
          })
          .eq("id", claim.id);
        if (updateError) setError(updateError.message);
        else onChanged();
        setBusy(false);
        return;
      }
      const expires = nextPremiumExpiry(existing.data?.expires_at ?? null);
      const { error: upsertError } = await supabase.from("premium_entitlements").upsert({
        user_id: claim.user_id,
        status: "active",
        starts_at: existing.data?.starts_at ?? reviewedAt,
        expires_at: expires.toISOString(),
        source: "paypal_ncp",
        paypal_txn_id: claim.paypal_txn_id,
        updated_at: reviewedAt,
      });
      if (upsertError) {
        setError(upsertError.message);
        setBusy(false);
        return;
      }
    }
    const { error: updateError } = await supabase
      .from("premium_claims")
      .update({
        status: approve ? "approved" : "rejected",
        reviewed_at: reviewedAt,
        reviewed_by: session.userId,
      })
      .eq("id", claim.id);
    if (updateError) setError(updateError.message);
    else onChanged();
    setBusy(false);
  };

  const reviewGuildRequest = async (request: GuildRequest, approve: boolean) => {
    if (!supabase || !session) return;
    setBusy(true);
    setError("");
    setGranted(false);
    const reviewedAt = new Date().toISOString();
    let createdGuildId: string | null = null;
    if (approve) {
      const slugBase = request.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      const slug = `${slugBase || "guild"}-${request.id.slice(0, 8)}`;
      const { data: created, error: insertError } = await supabase
        .from("guilds")
        .insert({
          name: request.name.trim(),
          slug,
          description: request.description.trim(),
          server_name: request.server_name.trim().slice(0, 80),
          master_discord_user_id: request.master_discord_user_id,
          created_by: session.userId,
        })
        .select("id")
        .single();
      if (insertError) {
        setError(insertError.message);
        setBusy(false);
        return;
      }
      createdGuildId = created?.id ?? null;
    }
    const { error: updateError } = await supabase
      .from("guild_create_requests")
      .update({
        status: approve ? "approved" : "rejected",
        reviewed_at: reviewedAt,
        reviewed_by: session.userId,
        created_guild_id: createdGuildId,
      })
      .eq("id", request.id);
    if (updateError) setError(updateError.message);
    else onChanged();
    setBusy(false);
  };

  const grantTargetId = manualUserId.trim() || selectedUserId;

  const grantLifetime = async () => {
    if (!supabase || !grantTargetId) return;
    setBusy(true);
    setError("");
    setGranted(false);
    const now = new Date().toISOString();
    const existing = await supabase
      .from("premium_entitlements")
      .select("starts_at, paypal_txn_id")
      .eq("user_id", grantTargetId)
      .maybeSingle();
    if (existing.error) {
      setError(existing.error.message);
      setBusy(false);
      return;
    }
    const { error: upsertError } = await supabase.from("premium_entitlements").upsert({
      user_id: grantTargetId,
      status: "active",
      starts_at: existing.data?.starts_at ?? now,
      expires_at: lifetimePremiumExpiry(),
      source: "manual",
      note: PREMIUM_LIFETIME_NOTE,
      paypal_txn_id: existing.data?.paypal_txn_id ?? null,
      updated_at: now,
    });
    if (upsertError) {
      setError(upsertError.message);
      setBusy(false);
      return;
    }
    setGranted(true);
    onChanged();
    setBusy(false);
  };

  const memberLabel = (userId: string) => {
    const member = members.find((entry) => entry.userId === userId);
    return member?.label ?? `${userId.slice(0, 8)}…`;
  };

  return (
    <>
      <section className="panel">
        <h2>{t.premium.adminLifetimeTitle}</h2>
        <p>{t.premium.adminLifetimeLede}</p>
        {error ? <p className="sign-in-error" role="alert">{error}</p> : null}
        {granted ? (
          <p className="assumption" role="status">
            {t.premium.adminLifetimeGranted}
          </p>
        ) : null}

        <fieldset disabled={busy}>
          <legend>{t.premium.adminLifetimeGrant}</legend>
          <div className="mapping-form">
            <div className="field">
              <label htmlFor={`${ids}-search`}>{t.premium.adminLifetimeSearch}</label>
              <input
                id={`${ids}-search`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.premium.adminLifetimeSearchHint}
              />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-user`}>{t.premium.adminLifetimeUser}</label>
              <select
                id={`${ids}-user`}
                value={selectedUserId}
                onChange={(event) => {
                  setSelectedUserId(event.target.value);
                  setManualUserId("");
                  setGranted(false);
                }}
              >
                <option value="">{t.premium.adminLifetimePick}</option>
                {filteredMembers.map((member) => {
                  const row = entitlementByUser.get(member.userId);
                  const active = isPremiumActive(row);
                  const lifetime = isLifetimePremium(row);
                  const suffix = lifetime
                    ? ` · ${t.premium.adminLifetimeBadge}`
                    : active
                      ? ` · ${t.premium.adminActiveBadge}`
                      : "";
                  return (
                    <option key={member.userId} value={member.userId}>
                      {member.label}
                      {suffix}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${ids}-uuid`}>{t.premium.adminLifetimeUserId}</label>
              <input
                id={`${ids}-uuid`}
                className="mono"
                value={manualUserId}
                placeholder={t.premium.adminLifetimeUserIdHint}
                onChange={(event) => {
                  setManualUserId(event.target.value);
                  setGranted(false);
                }}
              />
            </div>
            <button
              className="button button-primary"
              type="button"
              disabled={!grantTargetId || busy}
              onClick={() => void grantLifetime()}
            >
              {t.premium.adminLifetimeGrant}
            </button>
          </div>
          <p className="assumption">{t.premium.adminLifetimeReloadNote}</p>
        </fieldset>

        <h3 className="admin-subhead">{t.premium.adminActiveTitle}</h3>
        {activeEntitlements.length === 0 ? (
          <p className="assumption">{t.premium.adminActiveEmpty}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.premium.adminLifetimeUser}</th>
                  <th>{t.premium.adminActiveStatus}</th>
                  <th>{t.premium.adminExpires}</th>
                </tr>
              </thead>
              <tbody>
                {activeEntitlements.map((row) => (
                  <tr key={row.user_id}>
                    <td data-label={t.premium.adminLifetimeUser}>
                      {memberLabel(row.user_id)}
                      <div className="assumption mono">{row.user_id.slice(0, 8)}…</div>
                    </td>
                    <td data-label={t.premium.adminActiveStatus}>
                      {isLifetimePremium(row) ? t.premium.adminLifetimeBadge : t.premium.adminActiveBadge}
                      <div className="assumption">{row.source}</div>
                    </td>
                    <td data-label={t.premium.adminExpires} className="mono">
                      {isLifetimePremium(row)
                        ? t.premium.adminLifetimeBadge
                        : d(row.expires_at.slice(0, 10))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{t.premium.adminClaims}</h2>
        {claims.length === 0 ? (
          <p className="assumption">{t.premium.adminEmpty}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.premium.claimTxn}</th>
                  <th>{t.premium.adminLifetimeUser}</th>
                  <th>{t.premium.claimNote}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id}>
                    <td className="mono">{claim.paypal_txn_id}</td>
                    <td className="mono">{claim.user_id.slice(0, 8)}…</td>
                    <td>
                      {claim.note || "—"}
                      <div className="assumption">{d(claim.created_at.slice(0, 10))}</div>
                    </td>
                    <td className="actions">
                      <button
                        className="small-button button-primary"
                        type="button"
                        disabled={busy}
                        onClick={() => void reviewClaim(claim, true)}
                      >
                        {t.premium.adminApprove}
                      </button>
                      <button
                        className="small-button button-danger"
                        type="button"
                        disabled={busy}
                        onClick={() => void reviewClaim(claim, false)}
                      >
                        {t.premium.adminReject}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{t.premium.adminGuildRequests}</h2>
        {guildRequests.length === 0 ? (
          <p className="assumption">{t.premium.adminEmpty}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.premium.guildRequestName}</th>
                  <th>{t.premium.guildRequestServer}</th>
                  <th>{t.premium.guildRequestDescription}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {guildRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.name}</td>
                    <td>{request.server_name || "—"}</td>
                    <td>
                      {request.description || "—"}
                      <div className="assumption mono">{request.master_discord_user_id}</div>
                    </td>
                    <td className="actions">
                      <button
                        className="small-button button-primary"
                        type="button"
                        disabled={busy}
                        onClick={() => void reviewGuildRequest(request, true)}
                      >
                        {t.premium.adminApprove}
                      </button>
                      <button
                        className="small-button button-danger"
                        type="button"
                        disabled={busy}
                        onClick={() => void reviewGuildRequest(request, false)}
                      >
                        {t.premium.adminReject}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
