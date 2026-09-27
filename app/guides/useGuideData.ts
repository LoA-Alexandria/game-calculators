"use client";

import { useEffect, useState } from "react";
import { committedData, resolveData, type GuideDataKind } from "../../lib/content/guide-data";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

/**
 * The structured data a guide should use: the file baked into the build, or a
 * replacement published on the site once it has arrived and been checked.
 *
 * The committed file is what renders first and what stands if anything goes
 * wrong — a failed request, a slow one, or a payload that does not fit the
 * shape. The guide never waits on the database and never renders half a
 * roster.
 */
export function useGuideData<T>(kind: GuideDataKind): T {
  const supabase = getSupabaseBrowserClient();
  const [data, setData] = useState<T>(() => committedData(kind) as T);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const { data: row, error } = await supabase
        .from("guide_data")
        .select("payload")
        .eq("guide_id", kind)
        .maybeSingle();
      if (gone || error || !row) return;
      const resolved = resolveData(kind, (row as { payload: unknown }).payload) as T;
      // Only re-render when the published data is actually in use; a payload
      // that failed the check resolves back to the object already in state.
      if (resolved !== committedData(kind)) setData(resolved);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, kind]);

  return data;
}

/** Writes a data draft. The editor has already checked the shape. */
export async function saveDataDraft(
  kind: GuideDataKind,
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
export async function publishData(kind: GuideDataKind): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No connection.";
  const { error } = await supabase.rpc("publish_guide_data", { p_guide_id: kind });
  return error ? error.message : null;
}
