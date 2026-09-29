export type ShareCategory = "news" | "guide" | "event";

export type ShareFields = {
  category: unknown;
  title: unknown;
  summary: unknown;
  link: unknown;
};

const CATEGORY_LABELS: Record<ShareCategory, string> = {
  news: "News",
  guide: "Guide",
  event: "Event",
};

const CATEGORY_COLORS: Record<ShareCategory, number> = {
  news: 0xd18a3f,
  guide: 0x3b9a79,
  event: 0x428ac5,
};

export function validShareFields(fields: ShareFields): fields is {
  category: ShareCategory;
  title: string;
  summary: string;
  link: string;
} {
  if (fields.category !== "news" && fields.category !== "guide" && fields.category !== "event") return false;
  if (typeof fields.title !== "string" || fields.title.trim().length < 1 || fields.title.trim().length > 120) return false;
  if (typeof fields.summary !== "string" || fields.summary.trim().length < 1 || fields.summary.trim().length > 900) return false;
  if (typeof fields.link !== "string" || fields.link.length > 300) return false;
  try {
    const link = new URL(fields.link);
    return link.protocol === "https:" && link.hostname === "loa-alexandria.github.io" && link.pathname.startsWith("/game-calculators/");
  } catch {
    return false;
  }
}

export function contentShareMessage(category: ShareCategory, title: string, summary: string, link: string) {
  return {
    content: "",
    embeds: [{
      title: `${CATEGORY_LABELS[category]} · ${title.trim()}`,
      description: summary.trim(),
      url: link,
      color: CATEGORY_COLORS[category],
      footer: { text: "Pop Epoch · News, Guides & Events" },
    }],
    allowed_mentions: { parse: [] },
  };
}

export function hasContentSharePermission(permissions: unknown): boolean {
  if (typeof permissions !== "string" || !/^\d+$/.test(permissions)) return false;
  return (BigInt(permissions) & 8192n) === 8192n;
}
