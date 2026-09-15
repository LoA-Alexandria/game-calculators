"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  dictionaryFiles,
  getDictionary,
  mapLocales,
  type Locale,
} from "../../lib/i18n";
import { blankTranslations, parseTranslations, textIn, type Translations } from "../../lib/i18n/translations";
import {
  camelToKebab,
  guideCategoryId,
  guideHref,
  kebabToCamel,
  type GuideCategoryId,
  type GuideEntryId,
} from "../../lib/content/guides";
import { GUIDE_DRAFT_STORAGE_KEY } from "../../lib/site";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
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

/** Every text field holds all registered languages; the slug and category are shared. */
type GuideDraft = {
  slug: string;
  title: Translations;
  summary: Translations;
  intro: Translations;
  sections: { heading: Translations; body: Translations }[];
  note: Translations;
};

function emptyDraft(): GuideDraft {
  return {
    slug: "",
    title: blankTranslations(),
    summary: blankTranslations(),
    intro: blankTranslations(),
    sections: [{ heading: blankTranslations(), body: blankTranslations() }],
    note: blankTranslations(),
  };
}

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

/** The guide as every dictionary has it now. */
function draftFromEntry(id: GuideEntryId): GuideDraft {
  const entry = (locale: Locale) => getDictionary(locale).guideEntries[id];
  const sectionCount = Math.max(...LOCALE_CODES.map((locale) => entry(locale).sections.length), 1);
  return {
    slug: camelToKebab(id),
    title: mapLocales((locale) => entry(locale).title),
    summary: mapLocales((locale) => entry(locale).summary),
    intro: mapLocales((locale) => entry(locale).intro),
    sections: Array.from({ length: sectionCount }, (_, index) => ({
      heading: mapLocales((locale) => entry(locale).sections[index]?.heading ?? ""),
      body: mapLocales((locale) => entry(locale).sections[index]?.body.join("\n\n") ?? ""),
    })),
    note: mapLocales((locale) => entry(locale).note),
  };
}

/** The `guideEntries` block for one dictionary; empty fields take the English text. */
function entryBlock(id: string, draft: GuideDraft, locale: Locale): string {
  const sectionBlocks = draft.sections
    .filter((section) => textIn(section.heading, locale) || textIn(section.body, locale))
    .map((section) => {
      const body = paragraphs(textIn(section.body, locale))
        .map((line) => `            ${JSON.stringify(line)},`)
        .join("\n");
      return [
        `        {`,
        `          heading: ${JSON.stringify(textIn(section.heading, locale))},`,
        `          body: [`,
        body,
        `          ],`,
        `        },`,
      ].join("\n");
    })
    .join("\n");

  return [
    `// under guideEntries`,
    `    ${id}: {`,
    `      title: ${JSON.stringify(textIn(draft.title, locale))},`,
    `      summary: ${JSON.stringify(textIn(draft.summary, locale))},`,
    `      intro: ${JSON.stringify(textIn(draft.intro, locale))},`,
    `      sections: [`,
    sectionBlocks,
    `      ],`,
    `      note: ${JSON.stringify(textIn(draft.note, locale))},`,
    `    },`,
  ].join("\n");
}

function navigationSnippet(id: string, slug: string, categoryId: string): string {
  return [
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

/** Reads a saved draft, including one from before texts were kept per language. */
function parseSavedDraft(raw: string): { draft: GuideDraft; categoryId: string } | null {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const translations = (value: unknown): Translations => {
    if (typeof value === "string") return { ...blankTranslations(), [DEFAULT_LOCALE]: value };
    return parseTranslations(value) ?? blankTranslations();
  };
  const bodyText = (value: unknown) => (Array.isArray(value) ? value.map(text).join("\n\n") : value);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const saved = parsed as Record<string, unknown>;
    const sections = (Array.isArray(saved.sections) ? saved.sections : []).map((entry) => {
      const record = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
      const body =
        typeof record.body === "object" && record.body !== null && !Array.isArray(record.body)
          ? mapLocales((locale) => text(bodyText((record.body as Record<string, unknown>)[locale])))
          : translations(bodyText(record.body));
      return { heading: translations(record.heading), body };
    });
    return {
      draft: {
        slug: text(saved.slug),
        title: translations(saved.title),
        summary: translations(saved.summary),
        intro: translations(saved.intro),
        note: translations(saved.note),
        sections: sections.length > 0 ? sections : emptyDraft().sections,
      },
      categoryId: text(saved.categoryId),
    };
  } catch {
    return null;
  }
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
  const { language, languages } = useEditorLanguages({ withDefault: true });
  const ids = useId();
  const editing = target?.action === "edit" ? target.id : null;
  const removing = target?.action === "remove" ? target.id : null;
  const [draft, setDraft] = useState<GuideDraft>(() => (editing || removing ? draftFromEntry((editing ?? removing) as GuideEntryId) : emptyDraft()));
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
      : slugify(draft.title[DEFAULT_LOCALE]);
  const id = editing ?? removing ?? (kebabToCamel(slug) || "newGuide");

  const payload = useMemo(
    () =>
      JSON.stringify(
        {
          ...draft,
          slug,
          categoryId,
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

  const blocks = useMemo(
    () => (removing ? {} : mapLocales((locale) => entryBlock(id, draft, locale))),
    [removing, id, draft],
  );

  const output = useMemo(() => {
    if (removing) {
      return [
        `Remove guide ${JSON.stringify(removing)} (${t.guideEntries[removing].title})`,
        ``,
        `- Delete the object with that id from guideEntries in ${dictionaryFiles()}`,
        `- Delete the matching item from guides.items in lib/navigation.ts`,
        `- Delete app/guides/${camelToKebab(removing)}/`,
      ].join("\n");
    }
    const row = navigationSnippet(id, slug, categoryId);
    if (editing) {
      return [`// The dictionary blocks above replace the guide with this id. The navigation row stays as it is.`, row].join("\n");
    }
    return [`// Add the dictionary blocks above, this navigation row, and the page file.`, row].join("\n");
  }, [removing, editing, id, slug, categoryId, t]);

  const heading = removing ? t.editor.removeTitle : editing ? t.editor.editTitle : t.editor.title;
  const lede = removing ? t.editor.removeLede : editing ? t.editor.editLede : t.editor.lede;
  const note = removing ? t.editor.removeNote : editing ? t.editor.replaceNote : t.editor.outputNote;

  type TextKey = "title" | "summary" | "intro" | "note";
  const updateText = (key: TextKey, locale: Locale, value: string) =>
    setDraft((current) => ({ ...current, [key]: { ...current[key], [locale]: value } }));

  const updateSection = (index: number, key: "heading" | "body", locale: Locale, value: string) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, itemIndex) =>
        itemIndex === index ? { ...section, [key]: { ...section[key], [locale]: value } } : section,
      ),
    }));

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({ id: `${file.name}-${file.lastModified}-${file.size}`, file, url: URL.createObjectURL(file) }));
    setImages((current) => [...current, ...picked.filter((entry) => !current.some((item) => item.id === entry.id))]);
  };

  const removeImage = (imageId: string) =>
    setImages((current) => {
      const targetImage = current.find((image) => image.id === imageId);
      if (targetImage) URL.revokeObjectURL(targetImage.url);
      return current.filter((image) => image.id !== imageId);
    });

  const saveDraft = () => {
    try {
      localStorage.setItem(GUIDE_DRAFT_STORAGE_KEY, payload);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch { /* storage unavailable */ }
  };

  const loadDraft = () => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(GUIDE_DRAFT_STORAGE_KEY); } catch { /* storage unavailable */ }
    const loaded = raw ? parseSavedDraft(raw) : null;
    if (!loaded) return;
    setDraft(loaded.draft);
    if (loaded.categoryId && Object.hasOwn(t.guideCategories, loaded.categoryId)) {
      setCategoryId(loaded.categoryId as GuideCategoryId);
    }
    setSlugTouched(true);
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
  const preview = {
    title: textIn(draft.title, language),
    intro: textIn(draft.intro, language),
    note: textIn(draft.note, language),
  };

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
        <div className="form-actions editor-languages-bar">
          <AllLanguagesToggle />
        </div>
        <section className="panel">
          <TranslatedField
            label={t.editor.fieldTitle}
            languages={languages}
            get={(locale) => draft.title[locale]}
            set={(locale, value) => updateText("title", locale, value)}
          />
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
                setDraft((current) => ({ ...current, slug: slugify(event.target.value) }));
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
          <TranslatedField
            label={`${t.editor.fieldSummary} · ${t.editor.fieldSummaryNote}`}
            languages={languages}
            get={(locale) => draft.summary[locale]}
            set={(locale, value) => updateText("summary", locale, value)}
          />
          <TranslatedField
            label={t.editor.fieldIntro}
            multiline
            rows={4}
            languages={languages}
            get={(locale) => draft.intro[locale]}
            set={(locale, value) => updateText("intro", locale, value)}
          />
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
                    setDraft((current) => ({ ...current, sections: current.sections.filter((_, itemIndex) => itemIndex !== index) }))
                  }
                >
                  <TrashIcon className="icon icon-sm" />
                  {t.editor.removeSection}
                </button>
              </div>
              <TranslatedField
                label={t.editor.sectionHeading}
                languages={languages}
                get={(locale) => section.heading[locale]}
                set={(locale, value) => updateSection(index, "heading", locale, value)}
              />
              <TranslatedField
                label={`${t.editor.sectionBody} · ${t.editor.sectionBodyNote}`}
                multiline
                rows={5}
                languages={languages}
                get={(locale) => section.body[locale]}
                set={(locale, value) => updateSection(index, "body", locale, value)}
              />
            </div>
          ))}
          <div className="form-actions">
            <button
              className="button"
              type="button"
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

        <section className="panel">
          <TranslatedField
            label={t.editor.fieldNote}
            multiline
            rows={3}
            languages={languages}
            get={(locale) => draft.note[locale]}
            set={(locale, value) => updateText("note", locale, value)}
          />
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
          {preview.title || preview.intro ? (
            <article className="article">
              {preview.title && <h3 style={{ fontSize: "1.3rem" }}>{preview.title}</h3>}
              {preview.intro && <p className="intro">{preview.intro}</p>}
              {draft.sections.map((section, index) => (
                <section key={index}>
                  {textIn(section.heading, language) && <h2>{textIn(section.heading, language)}</h2>}
                  {paragraphs(textIn(section.body, language)).map((text, textIndex) => (
                    <p key={textIndex}>{text}</p>
                  ))}
                </section>
              ))}
              {images.map((image) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={image.id} src={image.url} alt="" />
              ))}
              {preview.note && <p className="callout">{preview.note}</p>}
            </article>
          ) : (
            <p className="assumption" style={{ marginTop: 0 }}>{t.editor.previewEmpty}</p>
          )}
        </section>

        <section className="panel">
          <h2>{t.editor.output}</h2>
          <p>{t.editor.outputLede}</p>
          <DictionaryBlocks blocks={blocks} rows={8} />
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
