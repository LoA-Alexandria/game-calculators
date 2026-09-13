"use client";

import { useId, useMemo, useState } from "react";
import type { NewsEntry } from "../../lib/content/news";
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

function snippetFor(
  id: string,
  date: string,
  href: string,
  title: string,
  summary: string,
  body: string,
): string {
  const lines = paragraphs(body);
  return [
    `  {`,
    `    id: ${JSON.stringify(id)},`,
    `    date: ${JSON.stringify(date)},`,
    ...(href ? [`    href: ${JSON.stringify(href)},`] : []),
    `    title: (t) => t.newsEntries.${id}.title,`,
    `    summary: (t) => t.newsEntries.${id}.summary,`,
    `    body: (t) => t.newsEntries.${id}.body,`,
    `  },`,
    ``,
    `// every dictionary — under newsEntries`,
    `    ${id}: {`,
    `      title: ${JSON.stringify(title)},`,
    `      summary: ${JSON.stringify(summary)},`,
    `      body: [`,
    ...lines.map((line) => `        ${JSON.stringify(line)},`),
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
  const ids = useId();
  const editing = target?.action === "edit" ? target.entry : null;
  const removing = target?.action === "remove" ? target.entry : null;
  const [title, setTitle] = useState(editing ? editing.title(t) : "");
  const [summary, setSummary] = useState(editing ? editing.summary(t) : "");
  const [body, setBody] = useState(editing ? editing.body(t).join("\n\n") : "");
  const [date, setDate] = useState(editing ? editing.date : new Date().toISOString().slice(0, 10));
  const [href, setHref] = useState(editing ? editing.href ?? "" : "");
  const [copied, setCopied] = useState(false);

  const id = editing?.id ?? removing?.id ?? camel(title);
  const output = useMemo(() => {
    if (removing) {
      return [
        `Remove news ${JSON.stringify(removing.id)} (${removing.title(t)})`,
        ``,
        `- Delete the object with that id from NEWS in lib/content/news.ts`,
        `- Delete newsEntries.${removing.id} from lib/i18n/dictionaries/en.ts, de.ts, and fr.ts`,
      ].join("\n");
    }
    const row = snippetFor(id, date, href, title, summary, body);
    if (editing) {
      return [`// lib/content/news.ts — replace the existing row with this id`, row].join("\n");
    }
    return [`// lib/content/news.ts — add at the top of NEWS`, row].join("\n");
  }, [removing, editing, id, date, href, title, summary, body, t]);

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
        <div className="field">
          <label htmlFor={`${ids}-title`}>{t.newsEditor.fieldTitle}</label>
          <input id={`${ids}-title`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-summary`}>
            {t.newsEditor.fieldSummary} <span className="label-note">{t.newsEditor.fieldSummaryNote}</span>
          </label>
          <input id={`${ids}-summary`} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-body`}>
            {t.newsEditor.fieldBody} <span className="label-note">{t.newsEditor.fieldBodyNote}</span>
          </label>
          <textarea id={`${ids}-body`} rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
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
        {title || body ? (
          <article className="entry-card" style={{ boxShadow: "none" }}>
            <div className="entry-meta"><time dateTime={date}>{d(date)}</time></div>
            {title && <h3>{title}</h3>}
            {paragraphs(body).map((line, index) => <p key={index}>{line}</p>)}
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
