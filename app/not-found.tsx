"use client";

import Link from "next/link";
import { asset } from "../lib/site";
import { useDocumentTitle, useLocale } from "./components/LocaleProvider";

/**
 * The page for an address that leads nowhere. A static export turns this into
 * `404.html`, which is what GitHub Pages serves for an unknown path.
 */
export default function NotFound() {
  const { t } = useLocale();
  useDocumentTitle(t.notFound.title);

  return (
    <div className="not-found">
      {/* A static export cannot optimise images; the drawing is a small WebP. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="not-found-art"
        src={asset("/banners/not-found.webp")}
        alt=""
        width={400}
        height={348}
        decoding="async"
      />
      <h1>{t.notFound.title}</h1>
      <p className="lede">{t.notFound.lede}</p>
      <p className="not-found-actions">
        <Link className="button button-primary" href="/">
          {t.notFound.home}
        </Link>
        <Link className="button" href="/calculators/">
          {t.nav.calculators}
        </Link>
        <Link className="button" href="/guides/">
          {t.nav.guides}
        </Link>
      </p>
    </div>
  );
}
