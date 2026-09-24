"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DAWN_OF_ROME_MAP,
  isRomeTile,
  romeHexPolygon,
  romeTiles,
  type DawnTone,
} from "../../lib/content/dawn-of-rome-map";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";

type SiegeScope =
  | { kind: "guild"; guildId: string }
  | { kind: "alliance"; allianceId: string };

type HexRow = { q: number; r: number; tone: number };

/**
 * The territory layer of the Dawn of Rome map: every printed hex is a tile an
 * officer can colour. Painted tiles are the only ones stored, so a board that
 * nobody has touched costs nothing.
 *
 * Tapping a tile that already wears the chosen colour clears it, which is the
 * quickest way to correct a stroke.
 */
export function GuildRomeTerritory({
  scope,
  dayIndex,
  canPaint,
  tone,
  erasing,
}: {
  scope: SiegeScope;
  dayIndex: number;
  canPaint: boolean;
  tone: DawnTone;
  erasing: boolean;
}) {
  const { t } = useLocale();
  const supabase = getSupabaseBrowserClient();
  const shared = scope.kind === "alliance";
  const owner = shared ? scope.allianceId : scope.guildId;

  const source = useMemo(
    () =>
      shared
        ? {
            table: "guild_alliance_hexes",
            key: { alliance_id: owner } as Record<string, string>,
            conflict: "alliance_id,day_index,q,r",
          }
        : {
            table: "guild_event_hexes",
            key: { guild_id: owner, event_id: "dawn-of-rome" } as Record<string, string>,
            conflict: "guild_id,event_id,day_index,q,r",
          },
    [shared, owner],
  );

  const [painted, setPainted] = useState<HexRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const { data, error: loadError } = await supabase
        .from(source.table)
        .select("q, r, tone")
        .match({ ...source.key, day_index: dayIndex });
      if (gone) return;
      if (loadError) setError(loadError.message);
      else setPainted(((data ?? []) as HexRow[]).filter((row) => isRomeTile(row.q, row.r)));
    })();
    return () => {
      gone = true;
    };
  }, [supabase, source, dayIndex]);

  const toneAt = (col: number, row: number) =>
    painted.find((entry) => entry.q === col && entry.r === row)?.tone ?? 0;

  const paint = async (col: number, row: number) => {
    if (!supabase || !canPaint || busy) return;
    const current = toneAt(col, row);
    const clear = erasing || current === tone;
    setBusy(true);
    setError("");
    if (clear) {
      if (current === 0) {
        setBusy(false);
        return;
      }
      const { error: deleteError } = await supabase
        .from(source.table)
        .delete()
        .match({ ...source.key, day_index: dayIndex, q: col, r: row });
      if (deleteError) setError(deleteError.message);
      else setPainted((rows) => rows.filter((entry) => !(entry.q === col && entry.r === row)));
    } else {
      const { error: saveError } = await supabase.from(source.table).upsert(
        {
          ...source.key,
          day_index: dayIndex,
          q: col,
          r: row,
          tone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: source.conflict },
      );
      if (saveError) setError(saveError.message);
      else {
        setPainted((rows) => [
          ...rows.filter((entry) => !(entry.q === col && entry.r === row)),
          { q: col, r: row, tone },
        ]);
      }
    }
    setBusy(false);
  };

  return (
    <>
      {error ? (
        <p className="result-error siege-hex-error" role="alert">
          {error}
        </p>
      ) : null}

      <svg
        className="siege-hex-layer"
        viewBox={`0 0 ${DAWN_OF_ROME_MAP.width} ${DAWN_OF_ROME_MAP.height}`}
        preserveAspectRatio="none"
        role="group"
        aria-label={t.guilds.hexLayerLabel}
        data-paint={canPaint ? "on" : "off"}
      >
        {romeTiles().map(({ col, row }) => {
          const worn = toneAt(col, row);
          return (
            <polygon
              key={`${col},${row}`}
              className="siege-hex"
              points={romeHexPolygon(col, row)}
              data-tone={worn || undefined}
              onClick={canPaint ? () => void paint(col, row) : undefined}
            />
          );
        })}
      </svg>
    </>
  );
}
