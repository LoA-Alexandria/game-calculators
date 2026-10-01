"use client";
import Image from "next/image";
import Link from "next/link";
import { NEWS } from "../../lib/content/news";
import { asset, BASE_PATH } from "../../lib/site";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { RichContentText } from "../components/RichContentText";
import styles from "./news.module.css";
export default function NewsArticle({ id }: { id: string }) {
  const { t, d } = useLocale();
  const entry = NEWS.find((item) => item.id === id)!;
  useDocumentTitle(entry.title(t));
  return <div className={styles.reader}>
    <Link className={styles.back} href="/news/">← {t.common.backTo} {t.news.title}</Link>
    <article>
      <header className={styles.articleHead}>
        <time className={styles.date} dateTime={entry.date}>{d(entry.date)}</time>
        <h1>{entry.title(t)}</h1><p>{entry.summary(t)}</p>
      </header>
      {entry.image && <Image className={styles.cover} src={entry.image.startsWith("https://") || (BASE_PATH && entry.image.startsWith(`${BASE_PATH}/`)) ? entry.image : asset(entry.image)} alt="" width={1200} height={700} unoptimized />}
      <div className={styles.body}>{entry.body(t).map((paragraph, index) => <RichContentText key={index} text={paragraph} />)}</div>
      <footer className={styles.footer}>
        {entry.href && <Link className="button button-primary" href={entry.href}>{t.common.open} →</Link>}
        <Link className="small-button" href="/news/">{t.common.backTo} {t.news.title}</Link>
      </footer>
    </article>
  </div>;
}
