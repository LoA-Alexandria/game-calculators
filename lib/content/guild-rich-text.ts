/**
 * Lightweight HTML allowlist for guild news / planning posts.
 * Masters write with a contenteditable toolbar; members only read sanitized HTML.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "span",
  "div",
]);

const SIZE_CLASS = /\b(guild-rt-sm|guild-rt-lg)\b/;

/** True when the string looks like stored rich HTML rather than plain text. */
export function looksLikeGuildHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value.trim());
}

/**
 * Strip disallowed tags and attributes. Keeps size classes on SPAN only.
 * Works in the browser and in Node tests (no DOMParser required).
 */
export function sanitizeGuildHtml(raw: string): string {
  const input = raw.trim();
  if (!input) return "";

  let html = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|form|svg|math)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  html = html.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    const closing = match.startsWith("</");
    if (closing) return name === "br" ? "" : `</${name}>`;
    if (name === "br") return "<br>";
    if (name === "span") {
      const size = SIZE_CLASS.exec(attrs);
      return size ? `<span class="${size[1]}">` : "<span>";
    }
    return `<${name}>`;
  });

  return html.trim();
}

/** Escape plain text into paragraphs for display. */
export function plainTextToGuildHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function guildPostHtml(body: string): string {
  if (!body.trim()) return "";
  return looksLikeGuildHtml(body) ? sanitizeGuildHtml(body) : plainTextToGuildHtml(body);
}
