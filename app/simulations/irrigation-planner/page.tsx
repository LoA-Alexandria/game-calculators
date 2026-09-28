"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PLANNER_STORAGE_KEYS, prepareSandboxedPlannerHtml } from "../../../lib/irrigation-planner-sandbox";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { useAuth } from "../../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PremiumGate } from "../../components/PremiumGate";

export default function IrrigationPlannerPage() {
  const { t } = useLocale();
  const { session } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const [plannerResult, setPlannerResult] = useState<{
    key: string;
    html?: string;
    nonce?: string;
    error?: string;
  } | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const plannerFrame = useRef<HTMLIFrameElement | null>(null);
  const requestKey = `${session?.userId ?? "signed-out"}:${session?.premium ? "premium" : "locked"}:${reloadKey}`;
  const currentResult = plannerResult?.key === requestKey ? plannerResult : null;
  const plannerHtml = currentResult?.html ?? null;
  const plannerNonce = currentResult?.nonce ?? null;
  const plannerReady = readyKey === requestKey;
  const plannerError = currentResult?.error ?? (session?.premium && !supabase
    ? "Supabase is not configured for this deployment."
    : "");
  const loading = Boolean(session?.premium && supabase && !currentResult);

  useDocumentTitle(t.tools.irrigation.name);

  useEffect(() => {
    let cancelled = false;
    if (!session?.premium || !supabase) return;

    void supabase.functions.invoke<{ html?: string }>("premium-irrigation-planner")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || typeof data?.html !== "string" || data.html.length > 1_000_000) {
          setPlannerResult({ key: requestKey, error: "The Premium planner could not be loaded. Please try again." });
          return;
        }
        try {
          const state: Record<string, string> = {};
          for (const key of PLANNER_STORAGE_KEYS) {
            const value = window.localStorage.getItem(key);
            if (value !== null) state[key] = value;
          }
          const nonce = crypto.randomUUID();
          const html = prepareSandboxedPlannerHtml(data.html, state, window.location.origin, nonce);
          setPlannerResult({ key: requestKey, html, nonce });
        } catch {
          setPlannerResult({ key: requestKey, error: "The Premium planner could not be loaded. Please try again." });
        }
      })
      .catch(() => {
        if (!cancelled) setPlannerResult({ key: requestKey, error: "The Premium planner could not be loaded. Please try again." });
      });

    return () => { cancelled = true; };
  }, [requestKey, session?.premium, supabase]);

  useEffect(() => {
    if (!plannerHtml || !plannerNonce) return;
    function handlePlannerMessage(event: MessageEvent) {
      if (event.origin !== "null" || event.source !== plannerFrame.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.type !== "popepoch:planner-state" || message.nonce !== plannerNonce ||
          !message.storage || typeof message.storage !== "object") return;

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
      // on the next planner heartbeat inside the opaque-origin sandbox.
      plannerFrame.current?.contentWindow?.postMessage({
        type: "popepoch:planner-theme",
        theme: window.localStorage.getItem("popepoch-theme"),
        scheme: window.localStorage.getItem("popepoch-scheme"),
      }, "*");
    }
    window.addEventListener("message", handlePlannerMessage);
    return () => window.removeEventListener("message", handlePlannerMessage);
  }, [plannerHtml, plannerNonce, requestKey]);

  return (
    <div className="planner-page">
      <div className="planner-topline">
        <Link className="back-link" href="/simulations/">
          <span aria-hidden="true">←</span> {t.nav.simulations}
        </Link>
        <span className="pill">{t.irrigation.eyebrow}</span>
      </div>

      <header className="planner-hero">
        <div className="planner-hero-copy">
          <span className="planner-kicker">{t.irrigation.eyebrow}</span>
          <h1>{t.tools.irrigation.name}</h1>
          <p>{t.irrigation.intro}</p>
          <div className="planner-tags" aria-label={t.irrigation.quickStartTitle}>
            {[t.irrigation.tagSolver, t.irrigation.tagTiers, t.irrigation.tagWorkers, t.irrigation.tagIo].map((tag) => (
              <span className="planner-tag" key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="planner-hero-mark" aria-hidden="true"><span>640</span><small>WATER</small></div>
      </header>

      <section className="planner-quickstart" aria-labelledby="planner-quickstart-title">
        <h2 id="planner-quickstart-title">{t.irrigation.quickStartTitle}</h2>
        <ol>
          <li><span>1</span><div><strong>{t.irrigation.stepBuildingsTitle}</strong><p>{t.irrigation.stepBuildings}</p></div></li>
          <li><span>2</span><div><strong>{t.irrigation.stepPlaceTitle}</strong><p>{t.irrigation.stepPlace}</p></div></li>
          <li><span>3</span><div><strong>{t.irrigation.stepOptimizeTitle}</strong><p>{t.irrigation.stepOptimize}</p></div></li>
        </ol>
      </section>

      <section className="planner-workspace" aria-labelledby="planner-workspace-title">
        <div className="planner-workspace-head">
          <div>
            <h2 id="planner-workspace-title">{t.irrigation.workspaceTitle}</h2>
            <p>{t.irrigation.workspaceHint}</p>
          </div>
          {session?.premium && plannerHtml && plannerReady ? (
            <button className="small-button" type="button" onClick={() => { void plannerFrame.current?.requestFullscreen(); }}>
              {t.irrigation.openFullScreen} <span aria-hidden="true">↗</span>
            </button>
          ) : null}
        </div>

      <PremiumGate>
        {session?.premium && plannerHtml ? (
          <div className="planner-frame-shell">
            <iframe
              ref={plannerFrame}
              className="planner-frame"
              srcDoc={plannerHtml}
              sandbox="allow-scripts"
              title={t.irrigation.frameTitle}
              onLoad={(event) => {
                if (!plannerNonce) return;
                event.currentTarget.contentWindow?.postMessage({
                  type: "popepoch:planner-ping",
                  nonce: plannerNonce,
                }, "*");
              }}
            />
          </div>
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

        <details className="planner-notes">
          <summary>{t.irrigation.detailsTitle}</summary>
          <div className="planner-notes-grid">
            <p className="assumption">{t.irrigation.model}</p>
            <p className="assumption">{t.irrigation.levels}</p>
            <p className="assumption">{t.irrigation.storage}</p>
            <p className="assumption">{t.irrigation.languageNote}</p>
          </div>
        </details>
      </PremiumGate>
      </section>
    </div>
  );
}
