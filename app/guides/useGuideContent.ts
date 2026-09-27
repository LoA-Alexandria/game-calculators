"use client";

import { useEffect, useState } from "react";
import {
  applyOverride,
  overrideFrom,
  type GuideContentRow,
  type GuideOverride,
} from "../../lib/content/guide-overrides";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import type { Locale } from "../../lib/i18n";

/**
 * The published text somebody has written for this guide on the site, if any.
 *
 * The guide renders from the build first and this arrives after, so a slow or
 * absent database costs nothing but the edit. Failures are swallowed on
 * purpose: a reader who cannot reach Supabase should still get the guide.
 */
export function useGuideOverride(guideId: string, locale: Locale): GuideOverride | null {
  const supabase = getSupabaseBrowserClient();
  const [override, setOverride] = useState<GuideOverride | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const { data, error } = await supabase
        .from("guide_content")
        .select("guide_id,locale,payload")
        .eq("guide_id", guideId)
        .eq("locale", locale)
        .maybeSingle();
      if (gone || error || !data) return;
      const row = data as GuideContentRow;
      setOverride(row.payload ?? null);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, guideId, locale]);

  return override;
}

/** The guide as the page should show it: the build, with any published edit on top. */
export function withOverride<T extends object>(base: T, override: GuideOverride | null): T {
  return override ? applyOverride(base, override) : base;
}

export type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * Writes one language's draft. The payload carries only what differs from the
 * committed text, so a guide nobody has edited leaves no row behind.
 */
export async function saveGuideDraft(
  guideId: string,
  locale: Locale,
  base: object,
  edited: object,
  userId: string,
): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No connection.";
  const payload = overrideFrom(base, edited);
  if (Object.keys(payload).length === 0) {
    const { error } = await supabase.from("guide_drafts").delete().match({ guide_id: guideId, locale });
    return error ? error.message : null;
  }
  const { error } = await supabase.from("guide_drafts").upsert(
    { guide_id: guideId, locale, payload, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: "guide_id,locale" },
  );
  return error ? error.message : null;
}

/** Moves a draft into the published text. The database checks the role. */
export async function publishGuide(guideId: string, locale: Locale): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No connection.";
  const { error } = await supabase.rpc("publish_guide", { p_guide_id: guideId, p_locale: locale });
  return error ? error.message : null;
}
