"use client";

import { useEffect, useMemo, useState } from "react";
import { LOCALE_CODES, dictionaryFile } from "../../lib/i18n";
import { blankTranslations, type Translations } from "../../lib/i18n/translations";
import {
  changedLocales,
  parseTextGuideDraft,
  textGuideBlocks,
  textGuideDraft,
  textGuideStorageKey,
  type TextGuideCatalog,
  type TextGuideDraft,
} from "../../lib/content/text-guide-editor";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "./EditorLanguages";
import { ChevronIcon, CloseIcon, InfoIcon, PlusIcon, TrashIcon } from "./Icons";
import { useLocale } from "./LocaleProvider";

/**
 * The edit mode of a guide that is only text: an event guide, or a guide such
 * as Ads / Buy. It edits every field of the entry in every language, keeps the
 * draft in this browser, and hands the draft to the page so the page itself is
 * the preview. What it gives back is one dictionary block per language that
 * changed; committing those is what publishes the change.
 */
export function TextGuideEditor({
  catalog,
  id,
  onDraft,
  onClose,
}: {
  catalog: TextGuideCatalog;
  id: string;
  /** Receives the draft whenever it changes, so the page can show it. */
  onDraft: (draft: TextGuideDraft) => void;
  onClose: () => void;
}) {
  const { t, tf } = useLocale();
  const words = t.textGuideEditor;
  const { languages } = useEditorLanguages({ withDefault: true });
  const storageKey = textGuideStorageKey(catalog, id);
  const published = useMemo(() => textGuideDraft(catalog, id), [catalog, id]);
  // The editor only mounts after a click, so reading storage here never runs on the server.
  const [draft, setDraft] = useState<TextGuideDraft>(() => {
    try {
      return parseTextGuideDraft(localStorage.getItem(storageKey), published) ?? published;
    } catch {
      return published;
    }
  });
  const changed = useMemo(() => changedLocales(catalog, id, draft), [catalog, id, draft]);
  const blocks = useMemo(() => textGuideBlocks(catalog, id, draft), [catalog, id, draft]);

  useEffect(() => {
    onDraft(draft);
    try {
      if (changed.length > 0) localStorage.setItem(storageKey, JSON.stringify(draft));
      else localStorage.removeItem(storageKey);
    } catch {
      /* storage unavailable: the draft lives as long as the tab */
    }
  }, [draft, changed, storageKey, onDraft]);

  const fieldLabel = (key: string): string => {
    const own: Record<string, string> = {
      title: t.editor.fieldTitle,
      summary: `${t.editor.fieldSummary} · ${t.editor.fieldSummaryNote}`,
      intro: t.editor.fieldIntro,
      note: t.editor.fieldNote,
    };
    return own[key] ?? (words.fields as Record<string, string>)[key] ?? key;
  };
  const long = (key: string) => key === "intro" || key === "note" || /Lede$/.test(key);

  const setField = (key: string, locale: string, value: string) =>
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.key === key ? { ...field, text: { ...field.text, [locale]: value } } : field)),
    }));
  const setSection = (index: number, part: "heading" | "body", locale: string, value: string) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, at) =>
        at === index ? { ...section, [part]: { ...section[part], [locale]: value } as Translations } : section,
      ),
    }));
  const setAlt = (index: number, locale: string, value: string) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, at) =>
        at === index && section.image ? { ...section, image: { ...section.image, alt: { ...section.image.alt, [locale]: value } } } : section,
      ),
    }));
  const moveSection = (index: number, step: number) =>
    setDraft((current) => {
      const target = index + step;
      if (target < 0 || target >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, sections };
    });

  return (
    <section className="panel text-guide-editor" id="text-guide-editor">
      <div className="text-guide-editor-head">
        <div>
          <h2>{words.title}</h2>
          <p>{words.lede}</p>
        </div>
        <button type="button" className="icon-button" aria-label={words.close} title={words.close} onClick={onClose}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>

      <div className="form-actions editor-languages-bar">
        <AllLanguagesToggle />
        <span className="text-guide-editor-state" aria-live="polite">
          {changed.length > 0 ? tf(words.changedIn, { languages: changed.map((code) => code.toUpperCase()).join(", ") }) : words.unchanged}
        </span>
        <button
          type="button"
          className="button"
          disabled={changed.length === 0}
          onClick={() => setDraft(textGuideDraft(catalog, id))}
        >
          {words.reset}
        </button>
      </div>

      <div className="text-guide-editor-grid">
        <div className="text-guide-editor-form">
          <section className="panel">
            {draft.fields.map((field) => (
              <TranslatedField
                key={field.key}
                label={fieldLabel(field.key)}
                multiline={long(field.key)}
                rows={long(field.key) ? 3 : 2}
                languages={languages}
                get={(locale) => field.text[locale]}
                set={(locale, value) => setField(field.key, locale, value)}
              />
            ))}
          </section>

          <section className="panel">
            <h3>{t.editor.sections}</h3>
            {draft.sections.map((section, index) => (
              <div className="section-block" key={index}>
                <div className="section-block-head">
                  <span>{tf(t.editor.sectionNumber, { n: index + 1 })}</span>
                  <div className="text-guide-editor-moves">
                    <button type="button" className="icon-button" aria-label={words.moveUp} title={words.moveUp} disabled={index === 0} onClick={() => moveSection(index, -1)}>
                      <ChevronIcon className="icon icon-sm text-guide-up" />
                    </button>
                    <button type="button" className="icon-button" aria-label={words.moveDown} title={words.moveDown} disabled={index === draft.sections.length - 1} onClick={() => moveSection(index, 1)}>
                      <ChevronIcon className="icon icon-sm text-guide-down" />
                    </button>
                    <button
                      type="button"
                      className="small-button button-danger"
                      onClick={() => setDraft((current) => ({ ...current, sections: current.sections.filter((_, at) => at !== index) }))}
                    >
                      <TrashIcon className="icon icon-sm" />
                      {t.editor.removeSection}
                    </button>
                  </div>
                </div>
                <TranslatedField
                  label={t.editor.sectionHeading}
                  languages={languages}
                  get={(locale) => section.heading[locale]}
                  set={(locale, value) => setSection(index, "heading", locale, value)}
                />
                <TranslatedField
                  label={`${t.editor.sectionBody} · ${t.editor.sectionBodyNote}`}
                  multiline
                  rows={6}
                  languages={languages}
                  get={(locale) => section.body[locale]}
                  set={(locale, value) => setSection(index, "body", locale, value)}
                />
                {section.image ? (
                  <TranslatedField
                    label={words.pictureAlt}
                    note={words.pictureNote}
                    multiline
                    languages={languages}
                    get={(locale) => section.image?.alt[locale] ?? ""}
                    set={(locale, value) => setAlt(index, locale, value)}
                  />
                ) : null}
              </div>
            ))}
            <div className="form-actions">
              <button
                type="button"
                className="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    sections: [...current.sections, { heading: blankTranslations(), body: blankTranslations() }],
                  }))
                }
              >
                <PlusIcon className="icon" />
                {t.editor.addSection}
              </button>
            </div>
          </section>
        </div>

        <aside className="text-guide-editor-out">
          <div className="notice notice-info">
            <InfoIcon className="icon" />
            <p>{words.previewNote}</p>
          </div>
          {changed.length > 0 ? (
            <DictionaryBlocks
              blocks={blocks}
              title={words.exportTitle}
              lede={tf(words.exportLede, { entry: `${catalog}.${id}` })}
              rows={10}
            />
          ) : (
            <p className="tier-small">{words.exportEmpty}</p>
          )}
          <p className="tier-small">
            {tf(words.files, { files: LOCALE_CODES.map((code) => dictionaryFile(code)).join(", ") })}
          </p>
        </aside>
      </div>
    </section>
  );
}
