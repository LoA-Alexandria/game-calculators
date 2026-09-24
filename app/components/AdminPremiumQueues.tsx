"use client";

import { useEffect, useState } from "react";
import { nextPremiumExpiry } from "../../lib/content/premium";
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

/**
 * Admin queue for PayPal Premium claims and guild-create requests.
 * Approving a claim extends `premium_entitlements` by 30 days.
 */
export function AdminPremiumQueues({ reloadToken, onChanged }: { reloadToken: number; onChanged: () => void }) {
  const { t, d } = useLocale();
  const { session } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [guildRequests, setGuildRequests] = useState<GuildRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const [claimRows, guildRows] = await Promise.all([
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
      ]);
      if (gone) return;
      if (claimRows.error) setError(claimRows.error.message);
      else setClaims((claimRows.data ?? []) as Claim[]);
      if (guildRows.error) setError(guildRows.error.message);
      else setGuildRequests((guildRows.data ?? []) as GuildRequest[]);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, reloadToken]);

  const reviewClaim = async (claim: Claim, approve: boolean) => {
    if (!supabase || !session) return;
    setBusy(true);
    setError("");
    const reviewedAt = new Date().toISOString();
    if (approve) {
      const existing = await supabase
        .from("premium_entitlements")
        .select("expires_at, starts_at")
        .eq("user_id", claim.user_id)
        .maybeSingle();
      if (existing.error) {
        setError(existing.error.message);
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

  return (
    <>
      <section className="panel">
        <h2>{t.premium.adminClaims}</h2>
        {error ? <p className="sign-in-error">{error}</p> : null}
        {claims.length === 0 ? (
          <p className="assumption">{t.premium.adminEmpty}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.premium.claimTxn}</th>
                  <th>User</th>
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
        <h2>{t.premium.guildRequestTitle}</h2>
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
