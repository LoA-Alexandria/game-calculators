"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { blankTranslations, type Translations } from "../../lib/i18n/translations";
import { sectionById } from "../../lib/navigation";
import {
  contentDictionaryBlocks,
  contentIdFromSlug,
  contentSiteInstructions,
  emptyContentBlock,
  safeContentUrl,
  slugifyContent,
  type ContentBlock,
  type ContentBlockType,
  type ContentBuilderDraft,
  type ContentKind,
} from "../../lib/content/content-builder";
import { guidePresentation } from "../../lib/content/guide-meta";
import { HEROES, heroPortrait } from "../../lib/content/heroes";
import { GODDESSES, goddessPortrait } from "../../lib/content/goddesses";
import { HeroPortrait } from "../components/HeroPortrait";
import { useAuth } from "../components/AuthProvider";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { RichContentText } from "../components/RichContentText";
import { CheckIcon, CopyIcon, PlusIcon, TrashIcon, ChevronIcon } from "../components/Icons";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead } from "../components/Ui";
import { asset, BASE_PATH } from "../../lib/site";

const STORAGE_KEY = "popepoch-content-builder-draft";
const BLOCK_TYPES: ContentBlockType[] = ["paragraph", "heading", "hero", "goddess", "arrow", "image", "coreLink", "callout"];
const CORE_LINKS = sectionById("guides").items.filter((item) => item.categoryId === "coreElements");
const IMAGE_OPTIONS = [...new Set([
  ...CORE_LINKS.flatMap((item) => item.icon ? [item.icon] : []),
  ...guidePresentation("heroes").art, ...guidePresentation("goddesses").art, ...guidePresentation("collection").art,
  ...guidePresentation("goddessTheater").art, ...guidePresentation("cryptides").art,
])];

function emptyDraft(): ContentBuilderDraft {
  return {
    kind: "news", slug: "", date: new Date().toISOString().slice(0, 10), categoryId: "coreElements", image: "",
    title: blankTranslations(), summary: blankTranslations(), intro: blankTranslations(), note: blankTranslations(),
    blocks: [emptyContentBlock("paragraph")],
  };
}

export function ContentBuilder() {
  const { t } = useLocale();
  const { allows } = useAuth();
  const { languages, language } = useEditorLanguages({ withDefault: true });
  const words = t.contentBuilder;
  const [draft, setDraft] = useState<ContentBuilderDraft>(() => ({
    ...emptyDraft(),
    kind: allows("news.write") ? "news" : allows("guides.draft") ? "guide" : "news",
  }));
  const [slugTouched, setSlugTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  useDocumentTitle(words.title);

  const permittedKinds = useMemo(() => [
    ...(allows("news.write") ? ["news" as const] : []),
    ...(allows("guides.draft") ? ["guide" as const, "event" as const] : []),
  ], [allows]);
  const slug = slugTouched ? draft.slug : slugifyContent(draft.title.en);
  const completeDraft = useMemo(() => ({ ...draft, slug }), [draft, slug]);
  const id = contentIdFromSlug(slug || draft.title.en);
  const dictionaryBlocks = useMemo(() => contentDictionaryBlocks(completeDraft), [completeDraft]);
  const siteInstructions = useMemo(() => contentSiteInstructions(completeDraft), [completeDraft]);
  const exportText = useMemo(() => [...Object.values(dictionaryBlocks), siteInstructions].filter(Boolean).join("\n\n"), [dictionaryBlocks, siteInstructions]);
  const previewTitle = draft.title[language] || draft.title.en;
  const previewSummary = draft.summary[language] || draft.summary.en;
  const previewIntro = draft.intro[language] || draft.intro.en;
  const previewNote = draft.note[language] || draft.note.en;
  const valid = permittedKinds.includes(draft.kind) && Boolean(draft.title.en.trim() && draft.summary.en.trim());

  const setText = (key: "title" | "summary" | "intro" | "note", locale: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: { ...current[key], [locale]: value } as Translations }));
  };
  const setBlock = (index: number, patch: Partial<ContentBlock>) => setDraft((current) => ({
    ...current,
    blocks: current.blocks.map((block, at) => at === index ? { ...block, ...patch } : block),
  }));
  const moveBlock = (index: number, by: number) => setDraft((current) => {
    const target = index + by;
    if (target < 0 || target >= current.blocks.length) return current;
    const blocks = [...current.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    return { ...current, blocks };
  });
  const addBlock = (type: ContentBlockType) => setDraft((current) => ({ ...current, blocks: [...current.blocks, emptyContentBlock(type)] }));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard is unavailable */ }
  };
  const saveDraft = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completeDraft));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch { /* local storage is unavailable */ }
  };
  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const value = JSON.parse(raw) as ContentBuilderDraft;
      if (!value || !["news", "guide", "event"].includes(value.kind) || !permittedKinds.includes(value.kind) || !Array.isArray(value.blocks)) return;
      setDraft({ ...emptyDraft(), ...value, blocks: value.blocks.map((block) => ({ ...emptyContentBlock(block.type), ...block })) });
      setSlugTouched(true);
    } catch { /* ignore malformed local drafts */ }
  };

  if (permittedKinds.length === 0) {
    return <div className="auth-screen"><div className="auth-card"><h1>{t.auth.noAccess}</h1><p>{t.auth.needSignIn}</p></div></div>;
  }

  const changeKind = (kind: ContentKind) => setDraft((current) => ({ ...current, kind }));

  return (
    <div className="content-builder-page">
      <PageHead eyebrow={words.navLabel} title={words.title} lede={words.lede} />
      <div className="notice notice-info content-builder-notice"><span aria-hidden="true">✦</span><p>{words.staticNote}</p></div>

      <section className="content-builder-kind" aria-labelledby="content-builder-kind-title">
        <h2 id="content-builder-kind-title">{words.chooseKind}</h2>
        <div className="content-builder-kind-options" role="group" aria-label={words.chooseKind}>
          {permittedKinds.map((kind) => (
            <button key={kind} type="button" className={draft.kind === kind ? "content-kind-card is-selected" : "content-kind-card"} aria-pressed={draft.kind === kind} onClick={() => changeKind(kind)}>
              <span className="content-kind-icon" aria-hidden="true">{kind === "news" ? "✦" : kind === "guide" ? "▤" : "◷"}</span>
              <strong>{words.kinds[kind]}</strong>
              <span>{kind === "news" ? t.navDescriptions.news : kind === "guide" ? t.navDescriptions.guides : t.navDescriptions.events}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="content-builder-grid">
        <div className="content-builder-form">
          <section className="panel content-builder-panel">
            <div className="content-builder-section-title"><span>01</span><div><h2>{words.kinds[draft.kind]}</h2><p>{words.formLede}</p></div></div>
            <div className="form-actions editor-languages-bar"><AllLanguagesToggle /></div>
            <TranslatedField label={words.fieldTitle} languages={languages} get={(locale) => draft.title[locale]} set={(locale, value) => setText("title", locale, value)} />
            <TranslatedField label={words.fieldSummary} multiline rows={2} languages={languages} get={(locale) => draft.summary[locale]} set={(locale, value) => setText("summary", locale, value)} />
            {draft.kind !== "news" ? <TranslatedField label={words.fieldIntro} multiline rows={3} languages={languages} get={(locale) => draft.intro[locale]} set={(locale, value) => setText("intro", locale, value)} /> : null}
            <div className="input-row">
              <div className="field">
                <label htmlFor="content-builder-slug">{words.fieldSlug}<span className="label-note"> · {words.slugNote}</span></label>
                <input id="content-builder-slug" value={slug} onChange={(event) => { setSlugTouched(true); setDraft((current) => ({ ...current, slug: slugifyContent(event.target.value) })); }} />
                <p className="tier-small">/{draft.kind === "event" ? "events" : "guides"}/{slug || "…"}/ · ID: <code>{id}</code></p>
              </div>
              {draft.kind === "news" ? <div className="field"><label htmlFor="content-builder-date">{words.fieldDate}</label><input id="content-builder-date" type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></div> : null}
            </div>
            {draft.kind === "guide" ? <div className="field"><label htmlFor="content-builder-category">{words.fieldCategory}</label><select id="content-builder-category" value={draft.categoryId} onChange={(event) => setDraft((current) => ({ ...current, categoryId: event.target.value }))}>{Object.keys(t.guideCategories).map((category) => <option key={category} value={category}>{t.guideCategories[category as keyof typeof t.guideCategories]}</option>)}</select></div> : null}
            {draft.kind !== "news" ? <ImagePicker value={draft.image} onChange={(image) => setDraft((current) => ({ ...current, image }))} label={words.fieldCover} /> : null}
          </section>

          <section className="panel content-builder-panel">
            <div className="content-builder-section-title"><span>02</span><div><h2>{words.blocks}</h2><p>{words.blocksLede}</p></div></div>
            {draft.blocks.map((block, index) => (
              <article className="content-builder-block" key={index}>
                <header className="content-builder-block-head">
                  <strong>{words.blockTypes[block.type]}</strong>
                  <div className="content-builder-block-actions">
                    <button type="button" className="icon-button" aria-label={words.moveUp} title={words.moveUp} disabled={index === 0} onClick={() => moveBlock(index, -1)}><ChevronIcon className="icon icon-sm text-guide-up" /></button>
                    <button type="button" className="icon-button" aria-label={words.moveDown} title={words.moveDown} disabled={index === draft.blocks.length - 1} onClick={() => moveBlock(index, 1)}><ChevronIcon className="icon icon-sm text-guide-down" /></button>
                    <button type="button" className="icon-button button-danger" aria-label={words.remove} title={words.remove} disabled={draft.blocks.length < 2} onClick={() => setDraft((current) => ({ ...current, blocks: current.blocks.filter((_, at) => at !== index) }))}><TrashIcon className="icon icon-sm" /></button>
                  </div>
                </header>
                {block.type === "hero" || block.type === "goddess" ? <CoreCharacterPicker block={block} index={index} onChange={(entityId) => setBlock(index, { entityId })} label={words.fieldCharacter} /> : block.type === "arrow" ? <div className="field"><label htmlFor={`content-builder-arrow-${index}`}>{words.fieldArrowDirection}</label><select id={`content-builder-arrow-${index}`} value={block.direction ?? "right"} onChange={(event) => setBlock(index, { direction: event.target.value as ContentBlock["direction"] })}><option value="right">{words.arrowDirections.right} →</option><option value="down">{words.arrowDirections.down} ↓</option><option value="left">{words.arrowDirections.left} ←</option></select></div> : block.type === "image" ? <>
                  <ImagePicker value={block.src} onChange={(src) => setBlock(index, { src })} label={words.fieldImage} />
                  <TranslatedField label={words.fieldAlt} languages={languages} get={(locale) => block.alt[locale]} set={(locale, value) => setBlock(index, { alt: { ...block.alt, [locale]: value } })} />
                </> : block.type === "coreLink" ? <>
                  <div className="field"><label htmlFor={`content-builder-link-${index}`}>{words.fieldCoreLink}</label><select id={`content-builder-link-${index}`} value={block.href} onChange={(event) => setBlock(index, { href: event.target.value })}><option value="">—</option>{CORE_LINKS.map((item) => <option key={item.href} value={item.href}>{item.label(t)}</option>)}</select>{CORE_LINKS.length === 0 ? <p className="tier-small">{words.emptyCore}</p> : null}</div>
                  <TranslatedField label={words.fieldText} languages={languages} get={(locale) => block.text[locale]} set={(locale, value) => setBlock(index, { text: { ...block.text, [locale]: value } })} />
                </> : <TranslatedField label={words.fieldText} multiline rows={block.type === "paragraph" ? 4 : 2} languages={languages} get={(locale) => block.text[locale]} set={(locale, value) => setBlock(index, { text: { ...block.text, [locale]: value } })} />}
              </article>
            ))}
            <div className="content-builder-add-blocks">{BLOCK_TYPES.map((type) => <button key={type} className="small-button" type="button" onClick={() => addBlock(type)}><PlusIcon className="icon icon-sm" />{words.blockTypes[type]}</button>)}</div>
            {draft.kind !== "news" ? <TranslatedField label={t.editor.fieldNote} multiline rows={2} languages={languages} get={(locale) => draft.note[locale]} set={(locale, value) => setText("note", locale, value)} /> : null}
          </section>
        </div>

        <aside className="content-builder-side">
          <section className="panel content-builder-preview">
            <div className="content-builder-section-title"><span>03</span><div><h2>{words.preview}</h2><p>{language.toUpperCase()}</p></div></div>
            {previewTitle || previewSummary ? <article className="entry-card content-builder-preview-card">
              {draft.image && safeContentUrl(draft.image) ? <Image className="content-builder-cover" src={imageSrc(draft.image)} alt="" width={1200} height={700} unoptimized /> : null}
              {draft.kind === "news" ? <time className="entry-meta" dateTime={draft.date}>{draft.date}</time> : <span className="guide-chip">{words.kinds[draft.kind]}</span>}
              <h2>{previewTitle || "…"}</h2>
              {previewSummary ? <p className="guide-head-lede">{previewSummary}</p> : null}
              {previewIntro ? <p className="intro">{previewIntro}</p> : null}
              <div className="content-builder-preview-body">{draft.blocks.map((block, index) => <PreviewBlock key={index} block={block} locale={language} t={t} />)}</div>
              {previewNote ? <p className="callout">{previewNote}</p> : null}
            </article> : <p className="assumption">{words.previewEmpty}</p>}
          </section>
          <section className="panel content-builder-export">
            <div className="content-builder-section-title"><span>04</span><div><h2>{words.export}</h2><p>{words.exportLede}</p></div></div>
            {!valid ? <p className="result-error" role="status">{words.invalid}</p> : null}
            <DictionaryBlocks blocks={dictionaryBlocks} rows={7} />
            <details className="content-builder-instructions"><summary>{t.editor.output}</summary><textarea className="code-out" readOnly value={siteInstructions} /></details>
            <div className="form-actions content-builder-actions">
              <button type="button" className="button button-primary" disabled={!valid} onClick={() => void copy()}>{copied ? <CheckIcon className="icon" /> : <CopyIcon className="icon" />}{copied ? words.copied : words.copy}</button>
              <button type="button" className="button" onClick={saveDraft}>{saved ? <CheckIcon className="icon" /> : null}{saved ? words.savedDraft : words.saveDraft}</button>
              <button type="button" className="button" onClick={loadDraft}>{t.editor.loadDraft}</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ImagePicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const { t } = useLocale();
  const options = t.contentBuilder;
  return <div className="content-builder-image-picker">
    <div className="field"><label>{label}</label><select aria-label={label} value={IMAGE_OPTIONS.includes(value) ? value : value ? "custom" : ""} onChange={(event) => onChange(event.target.value === "custom" ? value : event.target.value)}><option value="">{options.noImage}</option>{IMAGE_OPTIONS.map((path) => <option key={path} value={path}>{path.split("/").at(-1)}</option>)}{value && !IMAGE_OPTIONS.includes(value) ? <option value="custom">{options.fieldImage}</option> : null}</select><input aria-label={options.fieldImage} value={value} onChange={(event) => onChange(event.target.value)} placeholder="/heroes/… or https://…" /></div>
    {value && safeContentUrl(value) ? <Image className="content-builder-image-preview" src={imageSrc(value)} alt="" width={400} height={260} unoptimized /> : null}
  </div>;
}

function imageSrc(value: string) {
  if (/^https:\/\//i.test(value) || (BASE_PATH && value.startsWith(`${BASE_PATH}/`))) return value;
  return asset(value);
}

function PreviewBlock({ block, locale, t }: { block: ContentBlock; locale: string; t: ReturnType<typeof useLocale>["t"] }) {
  const text = block.text[locale as keyof Translations] || block.text.en;
  if (block.type === "image") return block.src && safeContentUrl(block.src) ? <RichContentText text={`![${block.alt[locale as keyof Translations] || block.alt.en}](${block.src})`} /> : null;
  if (block.type === "coreLink") {
    const label = text || CORE_LINKS.find((item) => item.href === block.href)?.label(t) || "Core guide";
    return block.href ? <RichContentText text={`[${label}](${block.href})`} /> : null;
  }
  if (block.type === "hero" || block.type === "goddess") return block.entityId ? <RichContentText text={`[[${block.type}:${block.entityId}]]`} /> : null;
  if (block.type === "arrow") return <RichContentText text={`[[arrow:${block.direction ?? "right"}]]`} />;
  if (!text.trim()) return null;
  const markdown = block.type === "heading" ? `## ${text}` : block.type === "callout" ? `> ${text}` : text;
  return <RichContentText text={markdown} />;
}

function CoreCharacterPicker({ block, index, onChange, label }: { block: ContentBlock; index: number; onChange: (id: string) => void; label: string }) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const people = block.type === "hero" ? HEROES : GODDESSES;
  const filteredPeople = people.filter((person) => person.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selected = people.find((person) => person.id === block.entityId);
  const portrait = selected ? (block.type === "hero" ? heroPortrait(selected.name) : goddessPortrait(selected.name)) : null;
  return <div className="content-builder-character-picker">
    <div className="field"><label htmlFor={`content-builder-character-search-${index}`}>{label}</label><input id={`content-builder-character-search-${index}`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.contentBuilder.searchCharacters} /><select aria-label={t.contentBuilder.chooseCharacter} value={block.entityId} onChange={(event) => onChange(event.target.value)}><option value="">{t.contentBuilder.chooseCharacter}</option>{filteredPeople.map((person) => <option key={person.id} value={person.id}>{person.rarity} · {person.name}</option>)}</select></div>
    {selected ? <div className="content-builder-character-selection"><HeroPortrait name={selected.name} rarity={selected.rarity} src={portrait} className="hero-portrait-small" /><span><strong>{selected.name}</strong><small>{selected.rarity} · {block.type === "hero" ? t.contentBuilder.coreHero : t.contentBuilder.coreGoddess}</small></span></div> : <p className="tier-small">{wordsForCharacter(block.type, t.contentBuilder)}</p>}
  </div>;
}

function wordsForCharacter(type: ContentBlock["type"], words: ReturnType<typeof useLocale>["t"]["contentBuilder"]) {
  return type === "hero" ? words.selectHeroFromCore : words.selectGoddessFromCore;
}
