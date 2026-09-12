"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  fill,
  getDictionary,
  intlTag,
  isLocale,
  negotiateLocale,
  type Dictionary,
  type Locale,
} from "../../lib/i18n";
import { LOCALE_STORAGE_KEY } from "../../lib/site";
import { createPersistentStore } from "./persistentStore";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** The active dictionary. */
  t: Dictionary;
  /** A dictionary string with `{placeholders}` filled in. */
  tf: (template: string, values: Record<string, string | number>) => string;
  /** Number formatted for the active language. */
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** ISO date string formatted for the active language. */
  d: (iso: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const localeStore = createPersistentStore<Locale>({
  key: LOCALE_STORAGE_KEY,
  serverValue: DEFAULT_LOCALE,
  parse: (raw) => (isLocale(raw) ? raw : null),
  fallback: () => negotiateLocale(navigator.languages ?? [navigator.language]),
});

/**
 * The site is a static export, so the pre-rendered HTML always carries the
 * default language and the stored choice is applied as soon as React hydrates.
 * That means one frame of English before a stored German or French page
 * settles; it is the trade-off for keeping a single set of URLs.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    localeStore.getServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.lang = intlTag(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => localeStore.set(next), []);

  const value = useMemo<LocaleContextValue>(() => {
    const dictionary = getDictionary(locale);
    const tag = intlTag(locale);
    return {
      locale,
      setLocale,
      t: dictionary,
      tf: fill,
      n: (input, options) => new Intl.NumberFormat(tag, options).format(input),
      d: (iso) =>
        new Intl.DateTimeFormat(tag, { year: "numeric", month: "long", day: "numeric" }).format(
          new Date(iso),
        ),
    };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside <LocaleProvider>.");
  return value;
}

/**
 * Sets the browser tab title from the active dictionary. Per-page `metadata`
 * exports are not available here because the pages are client components.
 */
export function useDocumentTitle(title: string) {
  const { t } = useLocale();
  useEffect(() => {
    document.title = `${title} · ${t.shell.brand}`;
  }, [title, t.shell.brand]);
}
