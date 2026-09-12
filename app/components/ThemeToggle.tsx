"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "../../lib/site";
import { useLocale } from "./LocaleProvider";
import { createPersistentStore } from "./persistentStore";
import { MoonIcon, SunIcon } from "./Icons";

type Theme = "light" | "dark";

const themeStore = createPersistentStore<Theme>({
  key: THEME_STORAGE_KEY,
  // The exported HTML is built light; the inline script in the root layout has
  // already corrected the painted colours before React gets here.
  serverValue: "light",
  parse: (raw) => (raw === "light" || raw === "dark" ? raw : null),
  fallback: () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
});

/**
 * Writes `data-theme` onto the document element and mirrors an explicit choice
 * into localStorage. The vendored Irrigation Planner reads the same key, so the
 * embedded planner follows the site theme through the `storage` event.
 *
 * Nothing is stored until the reader actually picks a theme, so a browser left
 * on its system preference keeps following it.
 */
export function ThemeToggle() {
  const { t } = useLocale();
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? t.shell.themeToDark : t.shell.themeToLight;

  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={() => themeStore.set(next)}
    >
      {theme === "dark" ? <SunIcon className="icon" /> : <MoonIcon className="icon" />}
    </button>
  );
}
