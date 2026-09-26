"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { useAuth } from "../../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PremiumGate } from "../../components/PremiumGate";

const PLANNER_STORAGE_KEYS = [
  "popepoch-theme",
  "popepoch-scheme",
  "irrigation_planner_v1",
  "irrigation_planner_mode_v1",
  "irrigation_planner_types_v1",
  "irrigation_prod_v1",
  "irrigation_tab_v1",
];

function embeddedPlannerUrl(url: string) {
  const result = new URL(url);
  result.searchParams.set("embed", "1");
  return result.toString();
}

function isExpectedPlannerUrl(value: string) {
  try {
    const url = new URL(value);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;
    return url.origin === new URL(supabaseUrl).origin &&
      url.pathname.endsWith("/premium-tools/irrigation-planner/index.html");
  } catch {
    return false;
  }
}

export default function IrrigationPlannerPage() {
  const { t } = useLocale();
  const { session } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const [plannerResult, setPlannerResult] = useState<{
    key: string;
    url?: string;
    error?: string;
  } | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const plannerFrame = useRef<HTMLIFrameElement | null>(null);
  const requestKey = `${session?.userId ?? "signed-out"}:${session?.premium ? "premium" : "locked"}:${reloadKey}`;
  const currentResult = plannerResult?.key === requestKey ? plannerResult : null;
  const plannerUrl = currentResult?.url ?? null;
  const plannerReady = readyKey === requestKey;
  const plannerError = currentResult?.error ?? (session?.premium && !supabase
    ? "Supabase is not configured for this deployment."
    : "");
  const loading = Boolean(session?.premium && supabase && !currentResult);

  useDocumentTitle(t.tools.irrigation.name);

  useEffect(() => {
    let cancelled = false;
    if (!session?.premium || !supabase) return;

    void supabase.functions.invoke<{ url?: string }>("premium-irrigation-planner")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || typeof data?.url !== "string" || !isExpectedPlannerUrl(data.url)) {
          setPlannerResult({ key: requestKey, error: "The Premium planner could not be loaded. Please try again." });
          return;
        }
        setPlannerResult({ key: requestKey, url: data.url });
      })
      .catch(() => {
        if (!cancelled) setPlannerResult({ key: requestKey, error: "The Premium planner could not be loaded. Please try again." });
      });

    return () => { cancelled = true; };
  }, [requestKey, session?.premium, supabase]);

  useEffect(() => {
    if (!plannerUrl) return;
    const plannerOrigin = new URL(plannerUrl).origin;
    function handlePlannerMessage(event: MessageEvent) {
      if (event.origin !== plannerOrigin || event.source !== plannerFrame.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.type !== "popepoch:planner-state" || !message.storage || typeof message.storage !== "object") return;

      let total = 0;
      for (const key of PLANNER_STORAGE_KEYS) {
        // The host app is authoritative for the reader's theme and palette.
        if (key === "popepoch-theme" || key === "popepoch-scheme") continue;
        const value = message.storage[key];
        if (typeof value !== "string" || value.length > 100000) continue;
        total += value.length;
        if (total > 200000) break;
        try { window.localStorage.setItem(key, value); } catch { break; }
      }
      setReadyKey(requestKey);

      // Theme changes made in the app while the planner is open are reflected
      // on the next planner heartbeat, even though localStorage is cross-origin.
      plannerFrame.current?.contentWindow?.postMessage({
        type: "popepoch:planner-theme",
        theme: window.localStorage.getItem("popepoch-theme"),
        scheme: window.localStorage.getItem("popepoch-scheme"),
      }, plannerOrigin);
    }
    window.addEventListener("message", handlePlannerMessage);
    return () => window.removeEventListener("message", handlePlannerMessage);
  }, [plannerUrl, requestKey]);

  return (
    <div className="planner-page">
      <div className="planner-bar">
        <Link className="back-link" href="/simulations/">
          <span aria-hidden="true">←</span> {t.nav.simulations}
        </Link>
        <div className="planner-title">
          <h1>{t.tools.irrigation.name}</h1>
          <span className="pill">{t.irrigation.eyebrow}</span>
        </div>
        <span className="spacer" />
        {session?.premium && plannerUrl && plannerReady ? (
          <a className="small-button" href={plannerUrl} target="_blank" rel="noreferrer">
            {t.irrigation.openFullScreen} <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>

      <PremiumGate>
        {session?.premium && plannerUrl ? (
          <iframe
            ref={plannerFrame}
            className="planner-frame"
            src={embeddedPlannerUrl(plannerUrl)}
            title={t.irrigation.frameTitle}
            onLoad={(event) => {
              if (!plannerUrl) return;
              const state: Record<string, string> = {};
              for (const key of PLANNER_STORAGE_KEYS) {
                const value = window.localStorage.getItem(key);
                if (value !== null) state[key] = value;
              }
              event.currentTarget.contentWindow?.postMessage({
                type: "popepoch:planner-bootstrap",
                storage: state,
              }, new URL(plannerUrl).origin);
            }}
          />
        ) : session?.premium && loading ? (
          <p className="assumption" role="status">Loading Premium planner…</p>
        ) : session?.premium && plannerError ? (
          <div className="result-error" role="alert">
            <p>{plannerError}</p>
            <button className="small-button" type="button" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="planner-notes">
          <p className="assumption">{t.irrigation.model}</p>
          <p className="assumption">{t.irrigation.levels}</p>
          <p className="assumption">{t.irrigation.storage}</p>
          <p className="assumption">{t.irrigation.languageNote}</p>
        </div>
      </PremiumGate>
    </div>
  );
}
