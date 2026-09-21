"use client";

import { useEffect, useId, useRef } from "react";
import { sanitizeGuildHtml } from "../../lib/content/guild-rich-text";
import { useLocale } from "../components/LocaleProvider";

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

function runCommand(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function wrapSize(sizeClass: "guild-rt-sm" | "guild-rt-lg" | "") {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const span = document.createElement("span");
  if (sizeClass) span.className = sizeClass;
  try {
    range.surroundContents(span);
  } catch {
    // Selection spans partial nodes — fall back to a simple size command.
    if (sizeClass === "guild-rt-sm") runCommand("fontSize", "2");
    else if (sizeClass === "guild-rt-lg") runCommand("fontSize", "5");
    else runCommand("removeFormat");
  }
}

export function GuildRichTextEditor({ id, label, value, onChange, disabled }: Props) {
  const { t } = useLocale();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML === value) return;
    el.innerHTML = value || "";
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = sanitizeGuildHtml(el.innerHTML);
    // Normalize font tags from execCommand into our size classes.
    const cleaned = html
      .replace(/<font[^>]*size\s*=\s*["']?2["']?[^>]*>([\s\S]*?)<\/font>/gi, '<span class="guild-rt-sm">$1</span>')
      .replace(/<font[^>]*size\s*=\s*["']?5["']?[^>]*>([\s\S]*?)<\/font>/gi, '<span class="guild-rt-lg">$1</span>')
      .replace(/<\/?font[^>]*>/gi, "");
    const next = sanitizeGuildHtml(cleaned);
    if (next === lastEmitted.current) return;
    lastEmitted.current = next;
    onChange(next);
  };

  return (
    <div className="guild-rt">
      <label htmlFor={fieldId}>{label}</label>
      <div className="guild-rt-toolbar" role="toolbar" aria-label={t.guilds.richToolbar}>
        <button type="button" className="guild-rt-btn" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => { runCommand("bold"); emit(); }} title={t.guilds.richBold}>
          <strong>B</strong>
        </button>
        <button type="button" className="guild-rt-btn" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => { runCommand("italic"); emit(); }} title={t.guilds.richItalic}>
          <em>I</em>
        </button>
        <button type="button" className="guild-rt-btn" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => { runCommand("underline"); emit(); }} title={t.guilds.richUnderline}>
          <span className="guild-rt-u">U</span>
        </button>
        <span className="guild-rt-sep" aria-hidden="true" />
        <button type="button" className="guild-rt-btn" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => { wrapSize("guild-rt-sm"); emit(); }} title={t.guilds.richSmall}>
          A−
        </button>
        <button type="button" className="guild-rt-btn" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => { wrapSize(""); emit(); }} title={t.guilds.richNormal}>
          A
        </button>
        <button type="button" className="guild-rt-btn" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => { wrapSize("guild-rt-lg"); emit(); }} title={t.guilds.richLarge}>
          A+
        </button>
        <span className="guild-rt-sep" aria-hidden="true" />
        <button type="button" className="guild-rt-btn" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => { runCommand("insertUnorderedList"); emit(); }} title={t.guilds.richList}>
          •≡
        </button>
      </div>
      <div
        id={fieldId}
        ref={ref}
        className="guild-rt-editor"
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
      />
    </div>
  );
}

export function GuildRichTextView({ html }: { html: string }) {
  if (!html) return null;
  return <div className="guild-rt-view" dangerouslySetInnerHTML={{ __html: html }} />;
}
