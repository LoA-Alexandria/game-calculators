"use client";

import { useId, useMemo, useState } from "react";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PermissionGate } from "../../components/SignInGate";
import { BackLink, PageHead } from "../../components/Ui";
import { CheckIcon, CopyIcon, InfoIcon } from "../../components/Icons";

function camel(value: string): string {
  const parts = value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).slice(0, 4);
  if (parts.length === 0) return "newEntry";
  return parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}

function paragraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

export default function NewNewsPage() {
  const { t } = useLocale();
  useDocumentTitle(t.newsEditor.title);
  return (
    <PermissionGate permission="news.write">
      <NewsEditor />
    </PermissionGate>
  );
}

function NewsEditor() {
  const { t, d } = useLocale();
  const ids = useId();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [href, setHref] = useState("");
  const [copied, setCopied] = useState(false);

  const id = camel(title);
  const output = useMemo(() => {
    const lines = paragraphs(body);
    return [
      `// lib/content/news.ts — add at the top of NEWS`,
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
  }, [id, date, href, title, summary, body]);

  return (
    <>
      <BackLink href="/news/" label={t.nav.news} />
      <PageHead eyebrow={t.nav.news} title={t.newsEditor.title} lede={t.newsEditor.lede} />

      <div className="notice notice-info">
        <InfoIcon className="icon" />
        <div><p>{t.newsEditor.outputNote}</p></div>
      </div>

      <div className="editor-layout" style={{ marginTop: 18 }}>
        <section className="panel">
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
        </section>

        <div className="editor-sticky">
          <section className="panel">
            <h2>{t.editor.preview}</h2>
            {title || body ? (
              <article className="entry-card" style={{ boxShadow: "none" }}>
                <div className="entry-meta"><time dateTime={date}>{d(date)}</time></div>
                {title && <h3>{title}</h3>}
                {paragraphs(body).map((line, index) => <p key={index}>{line}</p>)}
              </article>
            ) : (
              <p className="assumption" style={{ margin: 0 }}>{t.editor.previewEmpty}</p>
            )}
          </section>

          <section className="panel">
            <h2>{t.newsEditor.output}</h2>
            <textarea className="code-out" readOnly value={output} />
            <div className="form-actions">
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
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
