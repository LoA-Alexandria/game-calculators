"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SCHEME_STORAGE_KEY } from "../../lib/site";
import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME, isColorScheme, type ColorScheme } from "../../lib/theme";
import { useLocale } from "./LocaleProvider";
import { createPersistentStore } from "./persistentStore";
import { PaletteIcon } from "./Icons";

const schemeStore = createPersistentStore<ColorScheme>({
  key: SCHEME_STORAGE_KEY,
  serverValue: DEFAULT_COLOR_SCHEME,
  parse: (raw) => (isColorScheme(raw) ? raw : null),
  fallback: () => DEFAULT_COLOR_SCHEME,
});

/**
 * Writes `data-scheme` onto the document element. The Irrigation Planner reads
 * the same storage key, so the embedded planner follows a palette change
 * through the `storage` event.
 */
export function SchemeMenu() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const scheme = useSyncExternalStore(
    schemeStore.subscribe,
    schemeStore.getSnapshot,
    schemeStore.getServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.dataset.scheme = scheme;
  }, [scheme]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (next: ColorScheme) => {
    schemeStore.set(next);
    setOpen(false);
  };

  return (
    <div className="scheme" ref={root}>
      <button
        type="button"
        className="icon-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.shell.scheme}
        title={t.shell.scheme}
        onClick={() => setOpen((value) => !value)}
      >
        <PaletteIcon className="icon" />
      </button>
      {open && (
        <ul className="menu-pop" role="listbox" aria-label={t.shell.scheme}>
          {COLOR_SCHEMES.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                role="option"
                aria-selected={entry.id === scheme}
                className={entry.id === scheme ? "lang-option is-active" : "lang-option"}
                onClick={() => choose(entry.id)}
              >
                <span
                  className="scheme-swatch"
                  style={{ background: entry.swatch }}
                  aria-hidden="true"
                />
                <span>{t.shell.schemes[entry.id]}</span>
                {entry.id === scheme && <span aria-hidden="true" className="lang-check">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
