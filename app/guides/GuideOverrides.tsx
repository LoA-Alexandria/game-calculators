"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { committedData, resolveData } from "../../lib/content/guide-data";
import { applyOverride, type GuideOverride } from "../../lib/content/guide-overrides";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { toLocale } from "../../lib/i18n";
import { useLocale } from "../components/LocaleProvider";

/**
 * Everything published on the site, fetched once for the whole page.
 *
 * A guide page used to resolve only its own overrides, which meant a page that
 * borrows another guide's data — Cryptid layout reads the bestiary — showed
 * the committed version while the bestiary's own page showed the published
 * one. Two pages, two answers, from one edit. Holding it here means a page can
 * ask for any guide's data or texts, not only its own.
 *
 * Both queries are allowed to fail quietly. The build is the base, and a
 * reader who cannot reach Supabase should still get the guide.
 */
type Overrides = {
  data: Map<string, unknown>;
  texts: Map<string, GuideOverride>;
};

const EMPTY: Overrides = { data: new Map(), texts: new Map() };
const GuideOverridesContext = createContext<Overrides>(EMPTY);

export function GuideOverridesProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const { locale } = useLocale();
  const [overrides, setOverrides] = useState<Overrides>(EMPTY);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const [dataRows, textRows] = await Promise.all([
        supabase.from("guide_data").select("guide_id,payload"),
        supabase.from("guide_content").select("guide_id,locale,payload").eq("locale", toLocale(locale)),
      ]);
      if (gone) return;
      const data = new Map<string, unknown>();
      for (const row of (dataRows.data ?? []) as { guide_id: string; payload: unknown }[]) {
        data.set(row.guide_id, row.payload);
      }
      const texts = new Map<string, GuideOverride>();
      for (const row of (textRows.data ?? []) as { guide_id: string; payload: GuideOverride | null }[]) {
        if (row.payload) texts.set(row.guide_id, row.payload);
      }
      if (data.size > 0 || texts.size > 0) setOverrides({ data, texts });
    })();
    return () => {
      gone = true;
    };
  }, [supabase, locale]);

  return <GuideOverridesContext.Provider value={overrides}>{children}</GuideOverridesContext.Provider>;
}

/**
 * A data file as the page should use it: the build, or a published replacement
 * that looks like the file it replaces.
 */
export function useGuideData<T>(name: string): T {
  const { data } = useContext(GuideOverridesContext);
  return useMemo(() => resolveData(name, data.get(name)) as T, [data, name]);
}

/** A guide's dictionary entry with anything published on top of it. */
export function useGuideEntry<T extends object>(guideId: string, base: T): T {
  const { texts } = useContext(GuideOverridesContext);
  return useMemo(() => {
    const override = texts.get(guideId);
    return override ? applyOverride(base, override) : base;
  }, [texts, guideId, base]);
}

/** For pages that only need to know whether a file has been replaced. */
export function useCommittedData<T>(name: string): T {
  return committedData(name) as T;
}
