/**
 * Where a guide picture lives.
 *
 * Two kinds, told apart by the path itself:
 *
 *   `nidhogg.webp`          a file committed under `public/<guide>/`
 *   `up/nidhogg-k3f9.webp`  an object uploaded to the `guide-media` bucket
 *
 * A prefix rather than a scheme, because the shape has to survive the payload
 * check in `guide-data.ts`, which only allows lowercase letters, digits,
 * slashes, dashes, underscores and a `.webp` ending. Anything looser would be
 * a way to point a guide at somebody else's server.
 *
 * The committed pictures are the ones the tests check and the build ships, so
 * nothing here can take a guide offline: an upload that goes missing shows a
 * broken tile, not a broken page.
 */

import { asset } from "../site.ts";

/** Set at build time, like the rest of the Supabase wiring. */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Uploaded pictures carry this prefix; committed ones never do. */
export const UPLOADED_PREFIX = "up/";

export const GUIDE_MEDIA_BUCKET = "guide-media";

export function isUploadedPicture(path: string): boolean {
  return path.startsWith(UPLOADED_PREFIX);
}

/**
 * The address of a guide picture. `folder` is the guide's folder under
 * `public/`, used only for committed files.
 */
export function guidePictureUrl(folder: string, path: string): string {
  const file = path.replace(/^\/+/, "");
  if (!isUploadedPicture(file)) return asset(`/${folder}/${file}`);
  const object = file.slice(UPLOADED_PREFIX.length);
  return `${SUPABASE_URL}/storage/v1/object/public/${GUIDE_MEDIA_BUCKET}/${object}`;
}

/**
 * Where an upload goes, and what the guide entry will then say.
 *
 * The name keeps the place the picture has in the guide — `skills/nidhogg-1`
 * — so the bucket stays readable, and gains a short stamp so replacing a
 * picture does not leave readers looking at the old one out of a cache.
 */
export function uploadedPath(folder: string, file: string, stamp: string): string {
  const clean = file.replace(/\.webp$/i, "").replace(/[^a-z0-9/_-]+/gi, "-").toLowerCase();
  return `${UPLOADED_PREFIX}${folder}/${clean}-${stamp}.webp`;
}

/** A short, lowercase stamp; enough to separate one upload from the next. */
export function pictureStamp(now: number = Date.now()): string {
  return now.toString(36).slice(-6);
}
