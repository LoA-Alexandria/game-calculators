"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { GUIDE_DRAFT_STORAGE_KEY } from "../../../lib/site";
import { useDocumentTitle, useLocale } from "../../components/LocaleProvider";
import { PermissionGate } from "../../components/SignInGate";
import { BackLink, PageHead } from "../../components/Ui";
import {
  AlertIcon,
  CheckIcon,
  CopyIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "../../components/Icons";

/** The payload shape a future `POST /api/guides` should accept. */
type GuideDraft = {
  slug: string;
  title: string;
  summary: string;
  intro: string;
  sections: { heading: string; body: string }[];
  note: string;
  images: { name: string; size: number; type: string }[];
};

const EMPTY: GuideDraft = {
  slug: "",
  title: "",
  summary: "",
  intro: "",
  sections: [{ heading: "", body: "" }],
  note: "",
  images: [],
};

/** A picked file plus the object URL used to preview it. */
type PickedImage = { id: string; file: File; url: string };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function paragraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

export default function NewGuidePage() {
  const { t } = useLocale();
  useDocumentTitle(t.editor.title);
  return (
    <PermissionGate permission="guides.draft">
      <GuideEditor />
    </PermissionGate>
  );
}

function GuideEditor() {
  const { t, tf } = useLocale();
  const ids = useId();
  const [draft, setDraft] = useState<GuideDraft>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Object URLs are a manual allocation. Removing one image revokes its URL
   * straight away; this releases whatever is left when the page unmounts.
   * The list is read through a ref so the cleanup does not re-run — and revoke
   * URLs still on screen — every time an image is added.
   */
  const liveImages = useRef(images);
  useEffect(() => { liveImages.current = images; }, [images]);
  useEffect(() => () => { for (const image of liveImages.current) URL.revokeObjectURL(image.url); }, []);

  const slug = slugTouched ? draft.slug : slugify(draft.title);

  const payload = useMemo(
    () =>
      JSON.stringify(
        {
          ...draft,
          slug,
          sections: draft.sections
            .filter((section) => section.heading.trim() || section.body.trim())
            .map((section) => ({ heading: section.heading, body: paragraphs(section.body) })),
          images: images.map((image) => ({
            name: image.file.name,
            size: image.file.size,
            type: image.file.type,
          })),
        },
        null,
        2,
      ),
    [draft, slug, images],
  );

  const update = <K extends keyof GuideDraft>(key: K, value: GuideDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const updateSection = (index: number, key: "heading" | "body", value: string) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, itemIndex) =>
        itemIndex === index ? { ...section, [key]: value } : section,
      ),
    }));

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({ id: `${file.name}-${file.lastModified}-${file.size}`, file, url: URL.createObjectURL(file) }));
    setImages((current) => [...current, ...picked.filter((entry) => !current.some((item) => item.id === entry.id))]);
  };

  const removeImage = (id: string) =>
    setImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((image) => image.id !== id);
    });

  const saveDraft = () => {
    try {
      localStorage.setItem(GUIDE_DRAFT_STORAGE_KEY, payload);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch { /* storage unavailable */ }
  };

  /**
   * A saved draft is the export payload, where each section's body is an array
   * of paragraphs. The form edits one textarea per section, so they are joined
   * back with a blank line between them.
   */
  const loadDraft = () => {
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    try {
      const raw = localStorage.getItem(GUIDE_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return;
      const saved = parsed as Record<string, unknown>;
      const sections = (Array.isArray(saved.sections) ? saved.sections : []).map((entry) => {
        const record = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
        return {
          heading: text(record.heading),
          body: Array.isArray(record.body) ? record.body.map(text).join("\n\n") : text(record.body),
        };
      });
      setDraft({
        slug: text(saved.slug),
        title: text(saved.title),
        summary: text(saved.summary),
        intro: text(saved.intro),
        note: text(saved.note),
        sections: sections.length > 0 ? sections : EMPTY.sections,
        images: [],
      });
      setSlugTouched(true);
    } catch { /* unreadable draft */ }
  };

  const copyPayload = () => {
    navigator.clipboard?.writeText(payload).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => { /* clipboard blocked */ },
    );
  };

  return (
    <>
      <BackLink href="/guides/" label={t.nav.guides} />
      <PageHead eyebrow={t.nav.guides} title={t.editor.title} lede={t.editor.lede} />

      <div className="notice notice-warn">
        <AlertIcon className="icon" />
        <div>
          <strong>{t.editor.noServerTitle}</strong>
          <p>{t.editor.noServerBody}</p>
        </div>
      </div>

      <div className="editor-layout" style={{ marginTop: 18 }}>
        <div>
          <section className="panel">
            <div className="field">
              <label htmlFor={`${ids}-title`}>{t.editor.fieldTitle}</label>
              <input
                id={`${ids}-title`}
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-slug`}>
                {t.editor.fieldSlug} <span className="label-note">{t.editor.fieldSlugNote}</span>
              </label>
              <input
                id={`${ids}-slug`}
                className="mono"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  update("slug", slugify(event.target.value));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-summary`}>
                {t.editor.fieldSummary} <span className="label-note">{t.editor.fieldSummaryNote}</span>
              </label>
              <input
                id={`${ids}-summary`}
                value={draft.summary}
                onChange={(event) => update("summary", event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`${ids}-intro`}>{t.editor.fieldIntro}</label>
              <textarea
                id={`${ids}-intro`}
                value={draft.intro}
                onChange={(event) => update("intro", event.target.value)}
              />
            </div>
          </section>

          <section className="panel">
            <h2>{t.editor.sections}</h2>
            {draft.sections.map((section, index) => (
              <div className="section-block" key={index}>
                <div className="section-block-head">
                  <span>{tf(t.editor.sectionNumber, { n: index + 1 })}</span>
                  <button
                    className="small-button button-danger"
                    type="button"
                    disabled={draft.sections.length <= 1}
                    onClick={() =>
                      update("sections", draft.sections.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    <TrashIcon className="icon icon-sm" />
                    {t.editor.removeSection}
                  </button>
                </div>
                <div className="field">
                  <label htmlFor={`${ids}-h-${index}`}>{t.editor.sectionHeading}</label>
                  <input
                    id={`${ids}-h-${index}`}
                    value={section.heading}
                    onChange={(event) => updateSection(index, "heading", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${ids}-b-${index}`}>
                    {t.editor.sectionBody} <span className="label-note">{t.editor.sectionBodyNote}</span>
                  </label>
                  <textarea
                    id={`${ids}-b-${index}`}
                    value={section.body}
                    onChange={(event) => updateSection(index, "body", event.target.value)}
                  />
                </div>
              </div>
            ))}
            <div className="form-actions">
              <button
                className="button"
                type="button"
                onClick={() => update("sections", [...draft.sections, { heading: "", body: "" }])}
              >
                <PlusIcon className="icon" />
                {t.editor.addSection}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="field">
              <label htmlFor={`${ids}-note`}>{t.editor.fieldNote}</label>
              <textarea
                id={`${ids}-note`}
                value={draft.note}
                onChange={(event) => update("note", event.target.value)}
              />
            </div>
          </section>

          <section className="panel">
            <h2>{t.editor.images}</h2>
            <p>{t.editor.imagesLede}</p>
            <button
              type="button"
              className={dragging ? "dropzone is-over" : "dropzone"}
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(event.dataTransfer.files);
              }}
            >
              <UploadIcon className="icon" />
              <span>{t.editor.dropzone}</span>
              <span className="label-note">{t.editor.dropzoneNote}</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            {images.length > 0 && (
              <div className="media-grid">
                {images.map((image) => (
                  <figure className="media-item" key={image.id}>
                    {/* a local blob preview, so next/image would add nothing */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt="" />
                    <figcaption>{image.file.name}</figcaption>
                    <button
                      type="button"
                      aria-label={`${t.editor.removeImage}: ${image.file.name}`}
                      onClick={() => removeImage(image.id)}
                    >
                      <TrashIcon className="icon icon-sm" />
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="editor-sticky">
          <section className="panel">
            <h2>{t.editor.preview}</h2>
            {draft.title || draft.intro ? (
              <article className="article">
                {draft.title && <h3 style={{ fontSize: "1.3rem" }}>{draft.title}</h3>}
                {draft.intro && <p className="intro">{draft.intro}</p>}
                {draft.sections.map((section, index) => (
                  <section key={index}>
                    {section.heading && <h2>{section.heading}</h2>}
                    {paragraphs(section.body).map((text, textIndex) => (
                      <p key={textIndex}>{text}</p>
                    ))}
                  </section>
                ))}
                {images.map((image) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={image.id} src={image.url} alt="" />
                ))}
                {draft.note && <p className="callout">{draft.note}</p>}
              </article>
            ) : (
              <p className="assumption" style={{ marginTop: 0 }}>{t.editor.previewEmpty}</p>
            )}
          </section>

          <section className="panel">
            <h2>{t.editor.payload}</h2>
            <p>{t.editor.payloadLede}</p>
            <textarea className="code-out" readOnly value={payload} />
            <div className="form-actions">
              <button className="button button-primary" type="button" onClick={copyPayload}>
                {copied ? <CheckIcon className="icon" /> : <CopyIcon className="icon" />}
                {copied ? t.editor.copied : t.editor.copy}
              </button>
              <button className="button" type="button" onClick={saveDraft}>
                {saved ? t.editor.draftSaved : t.editor.saveDraft}
              </button>
              <button className="button" type="button" onClick={loadDraft}>
                {t.editor.loadDraft}
              </button>
            </div>
            <p className="assumption">{t.editor.translationNote}</p>
          </section>
        </div>
      </div>
    </>
  );
}
