import { notFound } from "next/navigation";
import { NEWS } from "../../../lib/content/news";
import NewsArticle from "../NewsArticle";
export function generateStaticParams() { return NEWS.map(({ id }) => ({ id })); }
export const dynamicParams = false;
export default async function NewsArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!NEWS.some((entry) => entry.id === id)) notFound();
  return <NewsArticle id={id} />;
}
