"use client";

import { useEffect, useId, useState } from "react";
import { isDiscordUserId } from "../../lib/content/guilds";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";

type OwnRequest = {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
};

/** Premium perk: one guild-create request while entitlement is active. */
export function GuildCreateRequestPanel() {
  const { t } = useLocale();
  const { session } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const [own, setOwn] = useState<OwnRequest | null>(null);
  const [name, setName] = useState("");
  const [server, setServer] = useState("");
  const [description, setDescription] = useState("");
  const [masterId, setMasterId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!supabase || !session) return;
    let gone = false;
    void (async () => {
      const { data, error: loadError } = await supabase
        .from("guild_create_requests")
        .select("id, name, status")
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

  if (!session) return null;

  if (!session.premium && !own) {
    return (
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>{t.premium.guildRequestTitle}</h2>
        <p>{t.premium.guildRequestNeedPremium}</p>
      </section>
    );
  }

  if (own?.status === "pending") {
    return (
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>{t.premium.guildRequestTitle}</h2>
        <p>{t.premium.guildRequestPending}</p>
        <p className="assumption">{own.name}</p>
      </section>
    );
  }

  if (own?.status === "approved") {
    return (
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>{t.premium.guildRequestTitle}</h2>
        <p>{t.premium.guildRequestApproved}</p>
        <p className="assumption">{own.name}</p>
      </section>
    );
  }

  if (!session.premium) return null;

  const submit = async () => {
    if (!supabase) return;
    if (!name.trim() || !isDiscordUserId(masterId)) {
      setError(t.premium.guildRequestMasterId);
      return;
    }
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase.from("guild_create_requests").insert({
      user_id: session.userId,
      name: name.trim(),
      server_name: server.trim(),
      description: description.trim(),
      master_discord_user_id: masterId.trim(),
      status: "pending",
    });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    setServer("");
    setDescription("");
    setMasterId("");
    setReloadToken((value) => value + 1);
  };

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h2>{t.premium.guildRequestTitle}</h2>
      <p>{t.premium.guildRequestLede}</p>
      <form
        className="premium-claim-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={`${ids}-name`}>
          <span>{t.premium.guildRequestName}</span>
          <input id={`${ids}-name`} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
        </label>
        <label htmlFor={`${ids}-server`}>
          <span>{t.premium.guildRequestServer}</span>
          <input id={`${ids}-server`} value={server} onChange={(e) => setServer(e.target.value)} maxLength={80} />
        </label>
        <label htmlFor={`${ids}-desc`}>
          <span>{t.premium.guildRequestDescription}</span>
          <input id={`${ids}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </label>
        <label htmlFor={`${ids}-master`}>
          <span>{t.premium.guildRequestMasterId}</span>
          <input
            id={`${ids}-master`}
            className="mono"
            value={masterId}
            onChange={(e) => setMasterId(e.target.value)}
            inputMode="numeric"
            required
          />
        </label>
        {error ? (
          <p className="sign-in-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button button-primary" type="submit" disabled={busy}>
          {t.premium.guildRequestSubmit}
        </button>
      </form>
    </section>
  );
}
