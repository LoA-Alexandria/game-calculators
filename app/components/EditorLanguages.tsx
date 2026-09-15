"use client";

import { useId, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_CODES,
  dictionaryFile,
  localeMeta,
  toLocale,
  type Locale,
} from "../../lib/i18n";
import { blankTranslations, type Translations } from "../../lib/i18n/translations";
import { EDITOR_ALL_LANGUAGES_STORAGE_KEY } from "../../lib/site";
import { CheckIcon, CopyIcon } from "./Icons";
import { useLocale } from "./LocaleProvider";
import { createPersistentStore } from "./persistentStore";

/**
 * Shared language controls for every editor. Languages come from the registry
 * in `lib/i18n`, so a language added there gets a field, a label, and an export
 * block everywhere without touching the editors.
 */

const allLanguagesStore = createPersistentStore<boolean>({
  key: EDITOR_ALL_LANGUAGES_STORAGE_KEY,
  serverValue: false,
  parse: (raw) => (raw === "true" ? true : raw === "false" ? false : null),
  fallback: () => false,
});

/**
 * The languages an editor shows. By default only the reader's language;
 * `withDefault` adds English first for editors whose data file holds English.
 * "Edit all languages" is one setting for all editors.
 */
export function useEditorLanguages({ withDefault = false }: { withDefault?: boolean } = {}) {
  const { locale } = useLocale();
  const language = toLocale(locale);
  const all = useSyncExternalStore(allLanguagesStore.subscribe, allLanguagesStore.getSnapshot, allLanguagesStore.getServerSnapshot);
  const languages: Locale[] = all
    ? [...LOCALE_CODES]
    : [...new Set<Locale>(withDefault ? [DEFAULT_LOCALE, language] : [language])];
  return { language, languages, all, setAll: (value: boolean) => allLanguagesStore.set(value) };
}

export function AllLanguagesToggle() {
  const { t } = useLocale();
  const { all, setAll } = useEditorLanguages();
  return (
    <label className="tier-edit-check editor-languages-toggle">
      <input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} />
      {t.editorLanguages.allLanguages}
    </label>
  );
}

/**
 * One text in several languages. A language without its own text shows the
 * English text as a placeholder, which is also what readers see until someone
 * translates it.
 */
export function TranslatedField({
  label,
  hint,
  multiline,
  rows = 2,
  languages,
  get,
  set,
  fallback,
}: {
  label: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  languages: readonly Locale[];
  get: (locale: Locale) => string;
  set: (locale: Locale, value: string) => void;
  /** The English text when it is not one of `languages`' own values (for example, from a data file). */
  fallback?: string;
}) {
  const { t } = useLocale();
  const id = useId();
  const english = fallback ?? get(DEFAULT_LOCALE);
  const several = languages.length > 1;
  return (
    <div className="field layout-text-field translated-field">
      <label htmlFor={`${id}-${languages[0]}`}>{label}</label>
      {languages.map((code) => {
        const value = get(code);
        const missing = code !== DEFAULT_LOCALE && !value.trim() && Boolean(english.trim());
        const meta = localeMeta(code);
        const props = {
          id: `${id}-${code}`,
          value,
          placeholder: missing ? english : undefined,
          "aria-label": several ? `${label} (${meta.label})` : undefined,
          "aria-describedby": missing ? `${id}-${code}-missing` : undefined,
          onChange: (event: { target: { value: string } }) => set(code, event.target.value),
        };
        return (
          <div className={missing ? "layout-lang-input is-missing" : "layout-lang-input"} key={code}>
            {several ? <span className="layout-lang" title={meta.label}>{meta.short}</span> : null}
            {multiline ? <textarea rows={rows} {...props} /> : <input {...props} />}
            {missing ? <span className="visually-hidden" id={`${id}-${code}-missing`}>{t.editorLanguages.missing}</span> : null}
          </div>
        );
      })}
      {hint ? <p className="tier-small">{hint}</p> : null}
    </div>
  );
}

/**
 * The wording of a text that is already picked, behind a button so the form
 * stays short. It changes the text everywhere its key is used.
 */
export function WordingEditor({
  languages,
  current,
  onChange,
  multiline,
  rows,
}: {
  languages: readonly Locale[];
  current: Translations;
  onChange: (locale: Locale, value: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="text-button" onClick={() => setOpen(true)}>
        {t.editorLanguages.editWording}
      </button>
    );
  }
  return (
    <div className="wording-editor">
      <TranslatedField
        label={t.editorLanguages.wordingLabel}
        hint={t.editorLanguages.wordingHint}
        multiline={multiline}
        rows={rows}
        languages={languages}
        get={(locale) => current[locale] ?? ""}
        set={onChange}
      />
      <button type="button" className="text-button" onClick={() => setOpen(false)}>{t.editorLanguages.doneWording}</button>
    </div>
  );
}

/** Text that the dictionaries do not have yet, typed once for every language. */
export function NewTextForm({ onAdd, onCancel }: { onAdd: (text: Translations) => void; onCancel: () => void }) {
  const { t } = useLocale();
  const copy = t.editorLanguages;
  const id = useId();
  const [value, setValue] = useState<Translations>(blankTranslations);
  return (
    <div className="tier-edit-newtext">
      <p className="tier-edit-newtext-title">{copy.newTextTitle}</p>
      {LOCALES.map((entry) => (
        <div className="field" key={entry.code}>
          <label htmlFor={`${id}-${entry.code}`}>
            {entry.label}
            {entry.code === DEFAULT_LOCALE ? <span className="label-note"> · {copy.required}</span> : null}
          </label>
          <input
            id={`${id}-${entry.code}`}
            value={value[entry.code]}
            onChange={(event) => setValue((current) => ({ ...current, [entry.code]: event.target.value }))}
          />
        </div>
      ))}
      <p className="tier-small">{copy.newTextHint}</p>
      <div className="tier-edit-row-actions">
        <button className="small-button" type="button" disabled={!value[DEFAULT_LOCALE].trim()} onClick={() => onAdd(value)}>
          <CheckIcon className="icon icon-sm" />
          {copy.newTextAdd}
        </button>
        <button className="small-button" type="button" onClick={onCancel}>{copy.cancel}</button>
      </div>
    </div>
  );
}

/** One copyable block per dictionary; languages without a block are skipped. */
export function DictionaryBlocks({
  blocks,
  title,
  lede,
  rows = 4,
}: {
  blocks: Partial<Record<Locale, string>>;
  title?: string;
  lede?: string;
  rows?: number;
}) {
  const { t } = useLocale();
  const [copied, setCopied] = useState<Locale | null>(null);
  const present = LOCALE_CODES.filter((code) => blocks[code]);
  if (present.length === 0) return null;
  const copy = (code: Locale) =>
    navigator.clipboard?.writeText(blocks[code] ?? "").then(() => setCopied(code), () => { /* clipboard blocked */ });
  return (
    <div className="tier-export-block">
      {title ? <h3>{title}</h3> : null}
      {lede ? <p className="tier-small">{lede}</p> : null}
      {present.map((code) => (
        <div key={code} className="tier-export-snippet">
          <div className="tier-export-head">
            <code>{dictionaryFile(code)}</code>
            <button className="small-button" type="button" onClick={() => void copy(code)}>
              {copied === code ? <CheckIcon className="icon icon-sm" /> : <CopyIcon className="icon icon-sm" />}
              {copied === code ? t.editorLanguages.copied : t.editorLanguages.copy}
            </button>
          </div>
          <textarea readOnly value={blocks[code]} rows={rows} spellCheck={false} aria-label={dictionaryFile(code)} />
        </div>
      ))}
    </div>
  );
}
