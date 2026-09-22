"use client";

import { useId, useMemo, useState } from "react";
import type { NewsEntry } from "../../lib/content/news";
import { DEFAULT_LOCALE, dictionaryFiles, getDictionary, mapLocales, type Locale } from "../../lib/i18n";
import { blankTranslations, textIn, type Translations } from "../../lib/i18n/translations";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { useLocale } from "../components/LocaleProvider";
import { BackLink, PageHead } from "../components/Ui";
import { CheckIcon, CopyIcon, InfoIcon } from "../components/Icons";

export type NewsEditorTarget = { entry: NewsEntry; action: "edit" | "remove" };

function camel(value: string): string {
  const parts = value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).slice(0, 4);
  if (parts.length === 0) return "newEntry";
  return parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}

function paragraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

function rowSnippet(id: string, date: string, href: string): string {
  return [
    `  {`,
    `    id: ${JSON.stringify(id)},`,
    `    date: ${JSON.stringify(date)},`,
    ...(href ? [`    href: ${JSON.stringify(href)},`] : []),
    `    title: (t) => t.newsEntries.${id}.title,`,
    `    summary: (t) => t.newsEntries.${id}.summary,`,
    `    body: (t) => t.newsEntries.${id}.body,`,
    `  },`,
  ].join("\n");
}

/** The `newsEntries` block for one dictionary; empty fields take the English text. */
function entryBlock(id: string, locale: Locale, title: Translations, summary: Translations, body: Translations): string {
  return [
    `// under newsEntries`,
    `    ${id}: {`,
    `      title: ${JSON.stringify(textIn(title, locale))},`,
    `      summary: ${JSON.stringify(textIn(summary, locale))},`,
    `      body: [`,
    ...paragraphs(textIn(body, locale)).map((line) => `        ${JSON.stringify(line)},`),
    `      ],`,
    `    },`,
  ].join("\n");
}

/**
 * New, edit, and remove all print a snippet to commit. A static site cannot
 * store the change itself; the snippet is what makes it visible to everyone.
 */
export function NewsEditor({
  target = null,
  onClose,
  showHead = true,
}: {
  target?: NewsEditorTarget | null;
  onClose?: () => void;
  showHead?: boolean;
}) {
  const { t, d } = useLocale();
  const { language, languages } = useEditorLanguages({ withDefault: true });
  const ids = useId();
  const editing = target?.action === "edit" ? target.entry : null;
  const removing = target?.action === "remove" ? target.entry : null;
  const [title, setTitle] = useState<Translations>(() => (editing ? mapLocales((locale) => editing.title(getDictionary(locale))) : blankTranslations()));
  const [summary, setSummary] = useState<Translations>(() => (editing ? mapLocales((locale) => editing.summary(getDictionary(locale))) : blankTranslations()));
  const [body, setBody] = useState<Translations>(() => (editing ? mapLocales((locale) => editing.body(getDictionary(locale)).join("\n\n")) : blankTranslations()));
  const [date, setDate] = useState(editing ? editing.date : new Date().toISOString().slice(0, 10));
  const [href, setHref] = useState(editing ? editing.href ?? "" : "");
  const [copied, setCopied] = useState(false);

  const id = editing?.id ?? removing?.id ?? camel(title[DEFAULT_LOCALE]);
  const output = useMemo(() => {
    if (removing) {
      return [
        `Remove news ${JSON.stringify(removing.id)} (${removing.title(t)})`,
        ``,
        `- Delete the object with that id from NEWS in lib/content/news.ts`,
        `- Delete newsEntries.${removing.id} from ${dictionaryFiles()}`,
      ].join("\n");
    }
    const row = rowSnippet(id, date, href);
    if (editing) {
      return [`// lib/content/news.ts — replace the existing row with this id`, row].join("\n");
    }
    return [`// lib/content/news.ts — add at the top of NEWS`, row].join("\n");
  }, [removing, editing, id, date, href, t]);
  const blocks = useMemo(
    () => (removing ? {} : mapLocales((locale) => entryBlock(id, locale, title, summary, body))),
    [removing, id, title, summary, body],
  );

  const heading = removing ? t.newsEditor.removeTitle : editing ? t.newsEditor.editTitle : t.newsEditor.title;
  const lede = removing ? t.newsEditor.removeLede : editing ? t.newsEditor.editLede : t.newsEditor.lede;
  const note = removing ? t.newsEditor.removeNote : editing ? t.newsEditor.replaceNote : t.newsEditor.outputNote;

  const copy = (
    <button
      className="button button-primary"
      type="button"
      onClick={() => navigator.clipboard?.writeText(output).then(
        () => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); },
        () => { /* clipboard blocked */ },
      )}
    >
      {copied ? <CheckIcon className="icon" /> : <CopyIcon className="icon" />}
      {copied ? t.editor.copied : t.editor.copy}
    </button>
  );

  const notice = (
    <div className="notice notice-info" style={{ marginBottom: 18 }}>
      <InfoIcon className="icon" />
      <div><p>{note}</p></div>
    </div>
  );

  const previewTitle = textIn(title, language);
  const previewBody = textIn(body, language);

  const form = removing ? (
    <>
      <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{t.newsEditor.removeOutput}</h3>
      <textarea className="code-out" readOnly value={output} />
      <div className="form-actions">
        {copy}
        {onClose && (
          <button className="button" type="button" onClick={onClose}>{t.newsEditor.cancel}</button>
        )}
      </div>
    </>
  ) : (
    <div className="editor-layout">
      <div>
        <div className="form-actions editor-languages-bar">
          <AllLanguagesToggle />
        </div>
        <TranslatedField
          label={t.newsEditor.fieldTitle}
          languages={languages}
          get={(locale) => title[locale]}
          set={(locale, value) => setTitle((current) => ({ ...current, [locale]: value }))}
        />
        <TranslatedField
          label={`${t.newsEditor.fieldSummary} · ${t.newsEditor.fieldSummaryNote}`}
          languages={languages}
          get={(locale) => summary[locale]}
          set={(locale, value) => setSummary((current) => ({ ...current, [locale]: value }))}
        />
        <TranslatedField
          label={`${t.newsEditor.fieldBody} · ${t.newsEditor.fieldBodyNote}`}
          multiline
          rows={8}
          languages={languages}
          get={(locale) => body[locale]}
          set={(locale, value) => setBody((current) => ({ ...current, [locale]: value }))}
        />
        <div className="input-row">
          <div className="field">
            <label htmlFor={`${ids}-date`}>{t.newsEditor.fieldDate}</label>
            <input id={`${ids}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-href`}>
              {t.newsEditor.fieldLink} <span className="label-note">{t.newsEditor.fieldLinkNote}</span>
            </label>
            <input id={`${ids}-href`} value={href} onChange={(e) => setHref(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="editor-sticky">
        <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{t.editor.preview}</h3>
        {previewTitle || previewBody ? (
          <article className="entry-card" style={{ boxShadow: "none" }}>
            <div className="entry-meta"><time dateTime={date}>{d(date)}</time></div>
            {previewTitle && <h3>{previewTitle}</h3>}
            {paragraphs(previewBody).map((line, index) => <p key={index}>{line}</p>)}
          </article>
        ) : (
          <p className="assumption" style={{ margin: 0 }}>{t.editor.previewEmpty}</p>
        )}

        <h3 style={{ fontSize: "1rem", margin: "18px 0 8px" }}>{t.newsEditor.output}</h3>
        <textarea className="code-out" readOnly value={output} />
        <div className="form-actions">
          {copy}
          {onClose && (
            <button className="button" type="button" onClick={onClose}>{t.newsEditor.cancel}</button>
          )}
        </div>
        <DictionaryBlocks blocks={blocks} title={t.editorLanguages.exportBlocks} lede={t.editorLanguages.exportBlocksLede} rows={6} />
      </div>
    </div>
  );

  if (showHead) {
    return (
      <div id="news-editor">
        <BackLink href="/news/" label={t.nav.news} />
        <PageHead eyebrow={t.nav.news} title={heading} lede={lede} />
        {notice}
        {form}
      </div>
    );
  }

  return (
    <section className="panel" id="news-editor" style={{ marginTop: 24 }}>
      <h2>{heading}</h2>
      <p>{lede}</p>
      {notice}
      {form}
    </section>
  );
}
