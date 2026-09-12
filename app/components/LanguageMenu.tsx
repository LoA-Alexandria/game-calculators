"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, type Locale } from "../../lib/i18n";
import { useLocale } from "./LocaleProvider";
import { GlobeIcon } from "./Icons";

export function LanguageMenu() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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

  const current = LOCALES.find((entry) => entry.code === locale) ?? LOCALES[0];

  const choose = (next: Locale) => {
    setLocale(next);
    setOpen(false);
  };

  return (
    <div className="lang" ref={root}>
      <button
        type="button"
        className="icon-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.shell.language}
        title={t.shell.language}
        onClick={() => setOpen((value) => !value)}
      >
        <GlobeIcon className="icon" />
        <span className="lang-code">{current.short}</span>
      </button>
      {open && (
        <ul className="menu-pop" role="listbox" aria-label={t.shell.language}>
          {LOCALES.map((entry) => (
            <li key={entry.code}>
              <button
                type="button"
                role="option"
                aria-selected={entry.code === locale}
                className={entry.code === locale ? "lang-option is-active" : "lang-option"}
                onClick={() => choose(entry.code)}
              >
                <span className="lang-short">{entry.short}</span>
                <span>{entry.label}</span>
                {entry.code === locale && <span aria-hidden="true" className="lang-check">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
