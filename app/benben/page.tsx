"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { asset } from "../../lib/site";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import { DiscordIcon } from "../components/Icons";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { BackLink, PageHead } from "../components/Ui";

type CareAction = "feed" | "polish" | "play" | "rest";
type BenbenState = { fed: number; happy: number; polished: number; rested: number; total_actions: number; community_streak: number; actions_left: number };
type CareEntry = { id: number; caretaker_name: string; action: CareAction; created_at: string };
const ICON: Record<CareAction, string> = { feed: "🍇", polish: "✨", play: "🎲", rest: "🌙" };
const LOCAL_PREVIEW = process.env.NODE_ENV === "development";
const LOCAL_KEY = "benben-local-preview";
const LOCAL_START: BenbenState = { fed: 72, happy: 76, polished: 68, rested: 80, total_actions: 0, community_streak: 1, actions_left: 3 };

export default function BenbenPage() {
  const { t, tf, d } = useLocale();
  const { session, signIn } = useAuth();
  const [pet, setPet] = useState<BenbenState | null>(null);
  const [recent, setRecent] = useState<CareEntry[]>([]);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<CareAction | null>(null);
  const [copied, setCopied] = useState(false);
  useDocumentTitle(t.benben.title);

  const refresh = useCallback(async () => {
    if (LOCAL_PREVIEW) {
      try {
        const saved = window.localStorage.getItem(LOCAL_KEY);
        setPet(saved ? JSON.parse(saved) as BenbenState : LOCAL_START);
      } catch { setPet(LOCAL_START); }
      setError("");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError(t.benben.unavailable); return; }
    const [stateResult, logResult] = await Promise.all([
      supabase.rpc("get_benben_state"),
      supabase.from("benben_actions").select("id, caretaker_name, action, created_at").order("created_at", { ascending: false }).limit(8),
    ]);
    if (stateResult.error || logResult.error) { setError(t.benben.unavailable); return; }
    setPet(stateResult.data as BenbenState);
    setRecent((logResult.data ?? []) as CareEntry[]);
    setError("");
  }, [t.benben.unavailable]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    if (LOCAL_PREVIEW) return () => window.clearTimeout(initialRefresh);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return () => window.clearTimeout(initialRefresh);
    const channel = supabase.channel("benben-community")
      .on("postgres_changes", { event: "*", schema: "public", table: "benben_state" }, () => void refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "benben_actions" }, () => void refresh())
      .subscribe();
    return () => { window.clearTimeout(initialRefresh); void supabase.removeChannel(channel); };
  }, [refresh]);

  const actions = useMemo(() => [
    ["feed", t.benben.feed], ["polish", t.benben.polish], ["play", t.benben.play], ["rest", t.benben.rest],
  ] as const, [t]);

  const care = async (action: CareAction) => {
    if (LOCAL_PREVIEW) {
      if (!pet || pet.actions_left === 0 || acting) return;
      setActing(action);
      const next = { ...pet, total_actions: pet.total_actions + 1, actions_left: pet.actions_left - 1 };
      if (action === "feed") { next.fed = Math.min(100, next.fed + 14); next.rested = Math.min(100, next.rested + 2); }
      if (action === "polish") { next.polished = Math.min(100, next.polished + 15); next.happy = Math.min(100, next.happy + 2); }
      if (action === "play") { next.happy = Math.min(100, next.happy + 14); next.rested = Math.max(0, next.rested - 4); next.fed = Math.max(0, next.fed - 2); }
      if (action === "rest") { next.rested = Math.min(100, next.rested + 15); next.fed = Math.max(0, next.fed - 2); }
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      setPet(next);
      setRecent((current) => [{ id: Date.now(), caretaker_name: "Local caretaker", action, created_at: new Date().toISOString() }, ...current].slice(0, 8));
      window.setTimeout(() => setActing(null), 500);
      return;
    }
    if (!session) { await signIn(); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase || acting) return;
    setActing(action);
    const result = await supabase.rpc("care_for_benben", { p_action: action });
    if (result.error) setError(result.error.message.includes("Daily care limit") ? t.benben.noActions : result.error.message);
    else { setPet(result.data as BenbenState); await refresh(); }
    setActing(null);
  };

  const average = pet ? Math.round((pet.fed + pet.happy + pet.polished + pet.rested) / 4) : 0;
  const mood = average >= 85 ? "Radiant" : average >= 65 ? "Content" : average >= 40 ? "Worried" : "Gloomy";
  const stats = pet ? [[t.benben.fed, pet.fed, "🍇"], [t.benben.happy, pet.happy, "💛"], [t.benben.polished, pet.polished, "✨"], [t.benben.rested, pet.rested, "🌙"]] as const : [];

  const share = async () => {
    if (!pet) return;
    const bar = (value: number) => `${"■".repeat(Math.round(value / 20))}${"□".repeat(5 - Math.round(value / 20))}`;
    const text = [`Benben — ${mood} 🪨`, `🍇 ${bar(pet.fed)}  ✨ ${bar(pet.polished)}`, `💛 ${bar(pet.happy)}  🌙 ${bar(pet.rested)}`, `🔥 ${pet.community_streak} day community streak`, "https://loa-alexandria.github.io/game-calculators/benben/"].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true); window.setTimeout(() => setCopied(false), 2200);
  };

  return <>
    <BackLink href="/simulations/" label={t.nav.simulations} />
    <PageHead eyebrow={t.benben.greeting} title={t.benben.title} lede={t.benben.lede} />
    <div className="benben-stage">
      <section className="benben-character-card" aria-label="Benben">
        <div className="benben-sun" aria-hidden="true" />
        <Image className={acting ? "benben-image is-bopping" : "benben-image"} src={asset("/benben.png")} width={1240} height={1240} alt="Benben, the communal stone pyramid" priority />
        <div className="benben-mood"><span>{average >= 65 ? "◕‿◕" : "◕︵◕"}</span> {mood}</div>
      </section>
      <section className="benben-care-card">
        {pet && <>
          <div className="benben-stats">{stats.map(([label, value, emoji]) => <div className="benben-stat" key={label}><div><span>{emoji} {label}</span><strong>{value}%</strong></div><div className="benben-meter"><span style={{ width: `${value}%` }} /></div></div>)}</div>
          <div className="benben-community-numbers"><div><strong>{pet.community_streak}</strong><span>🔥 {t.benben.streak} · {t.benben.days}</span></div><div><strong>{pet.total_actions}</strong><span>🤲 {t.benben.careCount}</span></div></div>
          <p className="benben-action-note">{LOCAL_PREVIEW || session ? (pet.actions_left > 0 ? tf(t.benben.actionsLeft, { count: pet.actions_left }) : t.benben.noActions) : t.benben.signInNote}</p>
          <div className="benben-actions">{actions.map(([action, label]) => <button className="button benben-action" type="button" key={action} disabled={Boolean(acting) || Boolean((LOCAL_PREVIEW || session) && pet.actions_left === 0)} onClick={() => void care(action)}><span>{ICON[action]}</span>{acting === action ? "…" : label}</button>)}</div>
          {!LOCAL_PREVIEW && !session && <button className="button button-primary benben-signin" type="button" onClick={() => void signIn()}><DiscordIcon className="icon" /> {t.auth.signIn}</button>}
          <button className="button benben-share" type="button" onClick={() => void share()}>{copied ? t.benben.copied : t.benben.share}</button>
        </>}
        {error && <div className="notice notice-warn" role="alert"><p>{error}</p></div>}
      </section>
    </div>
    <section className="benben-recent panel"><h2>{t.benben.recent}</h2>{recent.length ? <ul>{recent.map((entry) => <li key={entry.id}><span className="benben-log-icon">{ICON[entry.action]}</span><span><strong>{entry.caretaker_name}</strong> · {actions.find(([key]) => key === entry.action)?.[1]}</span><time dateTime={entry.created_at}>{d(entry.created_at)}</time></li>)}</ul> : <p>{t.benben.empty}</p>}</section>
  </>;
}
