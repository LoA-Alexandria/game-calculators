"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Dictionary } from "../../lib/i18n";
import {
  camelToKebab,
  guideCategoryId,
  guideHref,
  kebabToCamel,
  type GuideCategoryId,
  type GuideEntryId,
} from "../../lib/content/guides";
import { GUIDE_DRAFT_STORAGE_KEY } from "../../lib/site";
import { useLocale } from "../components/LocaleProvider";
import { BackLink, PageHead } from "../components/Ui";
import {
  AlertIcon,
  CheckIcon,
  CopyIcon,
  InfoIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "../components/Icons";

export type GuideEditorTarget = { id: GuideEntryId; action: "edit" | "remove" };

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

function draftFromEntry(
  id: GuideEntryId,
  t: Dictionary,
): Pick<GuideDraft, "slug" | "title" | "summary" | "intro" | "sections" | "note"> {
  const guide = t.guideEntries[id];
  return {
    slug: camelToKebab(id),
    title: guide.title,
    summary: guide.summary,
    intro: guide.intro,
    sections: guide.sections.map((section) => ({
      heading: section.heading,
      body: section.body.join("\n\n"),
    })),
    note: guide.note,
  };
}

function snippetFor(
  id: string,
  slug: string,
  categoryId: string,
  title: string,
  summary: string,
  intro: string,
  sections: { heading: string; body: string }[],
  note: string,
): string {
  const sectionBlocks = sections
    .filter((section) => section.heading.trim() || section.body.trim())
    .map((section) => {
      const body = paragraphs(section.body)
        .map((line) => `            ${JSON.stringify(line)},`)
        .join("\n");
      return [
        `        {`,
        `          heading: ${JSON.stringify(section.heading)},`,
        `          body: [`,
        body,
        `          ],`,
        `        },`,
      ].join("\n");
    })
    .join("\n");

  return [
    `// lib/i18n/dictionaries — under guideEntries (every language)`,
    `    ${id}: {`,
    `      title: ${JSON.stringify(title)},`,
    `      summary: ${JSON.stringify(summary)},`,
    `      intro: ${JSON.stringify(intro)},`,
    `      sections: [`,
    sectionBlocks,
    `      ],`,
    `      note: ${JSON.stringify(note)},`,
    `    },`,
    ``,
    `// lib/navigation.ts — guides.items`,
    `      {`,
    `        href: ${JSON.stringify(guideHref(id))},`,
    `        label: (t) => t.guideEntries.${id}.title,`,
    `        description: (t) => t.guideEntries.${id}.summary,`,
    `        badge: (t) => t.guideCategories.${categoryId},`,
    `        categoryId: ${JSON.stringify(categoryId)},`,
    `      },`,
    ``,
    `// app/guides/${slug}/page.tsx`,
    `// Copy app/guides/water-supply/page.tsx and pass id ${JSON.stringify(id)} to GuideArticle.`,
  ].join("\n");
}

/**
 * New, edit, and remove all print a snippet to commit. A static site cannot
 * store the change itself; the snippet is what makes it visible to everyone.
 */
export function GuideEditor({
  target = null,
  onClose,
  showHead = true,
}: {
  target?: GuideEditorTarget | null;
  onClose?: () => void;
  showHead?: boolean;
}) {
  const { t, tf } = useLocale();
  const ids = useId();
  const editing = target?.action === "edit" ? target.id : null;
  const removing = target?.action === "remove" ? target.id : null;
  const seeded = editing || removing ? draftFromEntry((editing ?? removing) as GuideEntryId, t) : EMPTY;
  const [draft, setDraft] = useState<GuideDraft>({ ...EMPTY, ...seeded, images: [] });
  const [slugTouched, setSlugTouched] = useState(Boolean(editing || removing));
  const [categoryId, setCategoryId] = useState<GuideCategoryId>(
    editing || removing
      ? guideCategoryId(guideHref((editing ?? removing) as string), t.guideCategories)
      : "layouts",
  );
  const [images, setImages] = useState<PickedImage[]>([]);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const liveImages = useRef(images);
  useEffect(() => { liveImages.current = images; }, [images]);
  useEffect(() => () => { for (const image of liveImages.current) URL.revokeObjectURL(image.url); }, []);

  const slug = editing || removing
    ? camelToKebab((editing ?? removing) as string)
    : slugTouched
      ? draft.slug
      : slugify(draft.title);
  const id = editing ?? removing ?? (kebabToCamel(slug) || "newGuide");

  const payload = useMemo(
    () =>
      JSON.stringify(
        {
          ...draft,
          slug,
          categoryId,
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
    [draft, slug, categoryId, images],
  );

  const output = useMemo(() => {
    if (removing) {
      return [
        `Remove guide ${JSON.stringify(removing)} (${t.guideEntries[removing].title})`,
        ``,
        `- Delete the object with that id from guideEntries in en.ts, de.ts, and fr.ts`,
        `- Delete the matching item from guides.items in lib/navigation.ts`,
        `- Delete app/guides/${camelToKebab(removing)}/`,
      ].join("\n");
    }
    const row = snippetFor(
      id,
      slug,
      categoryId,
      draft.title,
      draft.summary,
      draft.intro,
      draft.sections,
      draft.note,
    );
    if (editing) {
      return [`// Replace the existing guide with this id. Do not add a second copy.`, row].join("\n");
    }
    return [`// Add this guide, then create the page file as noted at the bottom.`, row].join("\n");
  }, [removing, editing, id, slug, categoryId, draft, t]);

  const heading = removing ? t.editor.removeTitle : editing ? t.editor.editTitle : t.editor.title;
  const lede = removing ? t.editor.removeLede : editing ? t.editor.editLede : t.editor.lede;
  const note = removing ? t.editor.removeNote : editing ? t.editor.replaceNote : t.editor.outputNote;

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
      const targetImage = current.find((image) => image.id === id);
      if (targetImage) URL.revokeObjectURL(targetImage.url);
      return current.filter((image) => image.id !== id);
    });

  const saveDraft = () => {
    try {
      localStorage.setItem(GUIDE_DRAFT_STORAGE_KEY, payload);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch { /* storage unavailable */ }
  };

  const loadDraft = () => {
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    try {
      const raw = localStorage.getItem(GUIDE_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return;
      const savedDraft = parsed as Record<string, unknown>;
      const sections = (Array.isArray(savedDraft.sections) ? savedDraft.sections : []).map((entry) => {
        const record = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
        return {
          heading: text(record.heading),
          body: Array.isArray(record.body) ? record.body.map(text).join("\n\n") : text(record.body),
        };
      });
      setDraft({
        slug: text(savedDraft.slug),
        title: text(savedDraft.title),
        summary: text(savedDraft.summary),
        intro: text(savedDraft.intro),
        note: text(savedDraft.note),
        sections: sections.length > 0 ? sections : EMPTY.sections,
        images: [],
      });
      const savedCategory = text(savedDraft.categoryId);
      if (savedCategory && Object.hasOwn(t.guideCategories, savedCategory)) {
        setCategoryId(savedCategory as GuideCategoryId);
      }
      setSlugTouched(true);
    } catch { /* unreadable draft */ }
  };

  const copyOutput = () => {
    navigator.clipboard?.writeText(output).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => { /* clipboard blocked */ },
    );
  };

  const copy = (
    <button
      className="button button-primary"
      type="button"
      onClick={copyOutput}
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

  const categories = Object.keys(t.guideCategories) as GuideCategoryId[];

  const form = removing ? (
    <>
      <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{t.editor.removeOutput}</h3>
      <textarea className="code-out" readOnly value={output} />
      <div className="form-actions">
        {copy}
        {onClose && (
          <button className="button" type="button" onClick={onClose}>{t.editor.cancel}</button>
        )}
      </div>
    </>
  ) : (
    <div className="editor-layout">
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
              disabled={Boolean(editing)}
              onChange={(event) => {
                setSlugTouched(true);
                update("slug", slugify(event.target.value));
              }}
            />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-category`}>{t.editor.fieldCategory}</label>
            <select
              id={`${ids}-category`}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value as GuideCategoryId)}
            >
              {categories.map((key) => (
                <option key={key} value={key}>{t.guideCategories[key]}</option>
              ))}
            </select>
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

        {!editing && (
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
        )}
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
          <h2>{t.editor.output}</h2>
          <p>{t.editor.outputLede}</p>
          <textarea className="code-out" readOnly value={output} />
          <div className="form-actions">
            {copy}
            {onClose && (
              <button className="button" type="button" onClick={onClose}>{t.editor.cancel}</button>
            )}
            {!editing && (
              <>
                <button className="button" type="button" onClick={saveDraft}>
                  {saved ? t.editor.draftSaved : t.editor.saveDraft}
                </button>
                <button className="button" type="button" onClick={loadDraft}>
                  {t.editor.loadDraft}
                </button>
              </>
            )}
          </div>
          <p className="assumption">{t.editor.translationNote}</p>
        </section>
      </div>
    </div>
  );

  if (showHead) {
    return (
      <div id="guide-editor">
        <BackLink href="/guides/" label={t.nav.guides} />
        <PageHead eyebrow={t.nav.guides} title={heading} lede={lede} />
        {removing ? notice : (
          <div className="notice notice-warn" style={{ marginBottom: 18 }}>
            <AlertIcon className="icon" />
            <div>
              <strong>{t.editor.noServerTitle}</strong>
              <p>{t.editor.noServerBody}</p>
            </div>
          </div>
        )}
        {removing ? null : notice}
        {form}
      </div>
    );
  }

  return (
    <section className="panel" id="guide-editor" style={{ marginTop: 24 }}>
      <h2>{heading}</h2>
      <p>{lede}</p>
      {notice}
      {form}
    </section>
  );
}
