"use client";

import {
  GUIDE_MEDIA_BUCKET,
  UPLOADED_PREFIX,
  pictureStamp,
  uploadedPath,
} from "../../lib/content/guide-media";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

/**
 * Puts the pictures an export carries into the bucket, and says what each one
 * is now called. Uploads come before the data is saved, so an entry never
 * points at a picture that is not there yet.
 */
export async function uploadPictures(
  folder: string,
  uploads: readonly { file: string; data: string }[],
): Promise<{ renamed: Map<string, string>; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  const renamed = new Map<string, string>();
  if (!supabase) return { renamed, error: "No connection." };
  const stamp = pictureStamp();
  for (const upload of uploads) {
    const path = uploadedPath(folder, upload.file, stamp);
    const blob = await (await fetch(upload.data)).blob();
    const { error } = await supabase.storage
      .from(GUIDE_MEDIA_BUCKET)
      .upload(path.slice(UPLOADED_PREFIX.length), blob, { contentType: blob.type || "image/webp", upsert: true });
    if (error) return { renamed, error: error.message };
    renamed.set(upload.file, path);
  }
  return { renamed, error: null };
}

/** The same data, with every uploaded picture under its new name. */
export function withUploadedPictures<T>(data: T, renamed: ReadonlyMap<string, string>): T {
  if (renamed.size === 0) return data;
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return renamed.get(value) ?? value;
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    }
    return value;
  };
  return walk(data) as T;
}

/** Writes a data draft. The editor has already checked the shape. */
export async function saveDataDraft(
  kind: string,
  payload: unknown,
  userId: string,
): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No connection.";
  const { error } = await supabase.from("guide_data_drafts").upsert(
    { guide_id: kind, payload, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: "guide_id" },
  );
  return error ? error.message : null;
}

/** Moves a data draft into the published data. The database checks the role. */
export async function publishData(kind: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No connection.";
  const { error } = await supabase.rpc("publish_guide_data", { p_guide_id: kind });
  return error ? error.message : null;
}
