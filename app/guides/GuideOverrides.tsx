"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { committedData, resolveData } from "../../lib/content/guide-data";
import { applyOverride, mergeTexts, type GuideOverride } from "../../lib/content/guide-overrides";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { getDictionary, mapLocales, toLocale, type Locale } from "../../lib/i18n";
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
  /** Keyed `guideId:locale`, because an editor writes every language at once. */
  texts: Map<string, GuideOverride>;
};

const textKey = (guideId: string, locale: string) => `${guideId}:${locale}`;

const EMPTY: Overrides = { data: new Map(), texts: new Map() };
const GuideOverridesContext = createContext<Overrides>(EMPTY);

export function GuideOverridesProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [overrides, setOverrides] = useState<Overrides>(EMPTY);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const [dataRows, textRows] = await Promise.all([
        supabase.from("guide_data").select("guide_id,payload"),
        // Every language, not just the one being read: an editor edits all
        // three at once and has to start from what is published in each.
        supabase.from("guide_content").select("guide_id,locale,payload"),
      ]);
      if (gone) return;
      const data = new Map<string, unknown>();
      for (const row of (dataRows.data ?? []) as { guide_id: string; payload: unknown }[]) {
        data.set(row.guide_id, row.payload);
      }
      const texts = new Map<string, GuideOverride>();
      for (const row of (textRows.data ?? []) as { guide_id: string; locale: string; payload: GuideOverride | null }[]) {
        if (row.payload) texts.set(textKey(row.guide_id, row.locale), row.payload);
      }
      if (data.size > 0 || texts.size > 0) setOverrides({ data, texts });
    })();
    return () => {
      gone = true;
    };
  }, [supabase]);

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

/** A guide's dictionary entry, in the reader's language, with any edit on top. */
export function useGuideEntry<T extends object>(guideId: string, base: T): T {
  const { texts } = useContext(GuideOverridesContext);
  const { locale } = useLocale();
  return useMemo(() => {
    const override = texts.get(textKey(guideId, toLocale(locale)));
    return override ? applyOverride(base, override) : base;
  }, [texts, guideId, base, locale]);
}

/**
 * One field of a guide's entry in every language, as an editor needs it: the
 * published text where there is one, the built text otherwise.
 *
 * Without this an editor opens on the committed names while the site shows the
 * published ones, and the next save quietly puts the old names back.
 */
export function usePublishedTexts<T>(guideId: string | undefined, field: string | undefined): Record<Locale, T> {
  const { texts } = useContext(GuideOverridesContext);
  return useMemo(() => {
    return mapLocales((locale) => {
      const entry = getDictionary(locale).guideEntries as Record<string, Record<string, unknown>>;
      const committed = guideId ? entry[guideId]?.[field ?? ""] : undefined;
      if (!guideId || !field) return committed as T;
      const override = texts.get(textKey(guideId, locale));
      const published = override ? (override as Record<string, unknown>)[field] : undefined;
      // Laid over the committed names, not in place of them: a payload carries
      // only what was changed, and an editor that lost the rest would save the
      // gaps.
      return (published === undefined ? committed : mergeTexts(committed, published)) as T;
    });
  }, [texts, guideId, field]);
}

/**
 * A guide's published payload in every language, as an editor needs it before
 * it writes: what it saves has to keep the fields it does not own.
 */
export function usePublishedOverrides(guideId: string | undefined): Record<Locale, GuideOverride | null> {
  const { texts } = useContext(GuideOverridesContext);
  return useMemo(() => {
    if (!guideId) return mapLocales(() => null);
    return mapLocales((locale) => texts.get(textKey(guideId, locale)) ?? null);
  }, [texts, guideId]);
}

/** For pages that only need to know whether a file has been replaced. */
export function useCommittedData<T>(name: string): T {
  return committedData(name) as T;
}
