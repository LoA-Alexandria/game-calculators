"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DAWN_OF_ROME_MAP,
  isRomeClickable,
  isRomeTile,
  romeHexPolygon,
  romePaintTargets,
  romeTileKind,
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
 * The territory layer of the Dawn of Rome map. Officers colour clickable tiles:
 * plain hexes one at a time, blue structures as a whole group. Red and anything
 * past the yellow board edge ignore taps. Only painted tiles are stored.
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
      else
        setPainted(
          ((data ?? []) as HexRow[]).filter(
            (row) => isRomeTile(row.q, row.r) && isRomeClickable(row.q, row.r),
          ),
        );
    })();
    return () => {
      gone = true;
    };
  }, [supabase, source, dayIndex]);

  const toneAt = (col: number, row: number) =>
    painted.find((entry) => entry.q === col && entry.r === row)?.tone ?? 0;

  const paint = async (col: number, row: number) => {
    if (!supabase || !canPaint || busy || !isRomeClickable(col, row)) return;
    const targets = romePaintTargets(col, row);
    if (targets.length === 0) return;
    const current = toneAt(col, row);
    const clear = erasing || current === tone;
    setBusy(true);
    setError("");
    if (clear) {
      if (current === 0) {
        setBusy(false);
        return;
      }
      // Delete each target hex; `.or` filter syntax varies by client version.
      let deleteError: { message: string } | null = null;
      for (const tile of targets) {
        const { error: err } = await supabase
          .from(source.table)
          .delete()
          .match({ ...source.key, day_index: dayIndex, q: tile.col, r: tile.row });
        if (err) {
          deleteError = err;
          break;
        }
      }
      if (deleteError) setError(deleteError.message);
      else {
        const drop = new Set(targets.map((tile) => `${tile.col},${tile.row}`));
        setPainted((rows) => rows.filter((entry) => !drop.has(`${entry.q},${entry.r}`)));
      }
    } else {
      const rows = targets.map((tile) => ({
        ...source.key,
        day_index: dayIndex,
        q: tile.col,
        r: tile.row,
        tone,
        updated_at: new Date().toISOString(),
      }));
      const { error: saveError } = await supabase.from(source.table).upsert(rows, {
        onConflict: source.conflict,
      });
      if (saveError) setError(saveError.message);
      else {
        const drop = new Set(targets.map((tile) => `${tile.col},${tile.row}`));
        setPainted((existing) => [
          ...existing.filter((entry) => !drop.has(`${entry.q},${entry.r}`)),
          ...targets.map((tile) => ({ q: tile.col, r: tile.row, tone })),
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
          const kind = romeTileKind(col, row);
          if (kind === "outside") return null;
          const worn = toneAt(col, row);
          const clickable = kind === "plain" || kind === "structure";
          return (
            <polygon
              key={`${col},${row}`}
              className="siege-hex"
              points={romeHexPolygon(col, row)}
              data-tone={worn || undefined}
              data-kind={kind}
              onClick={canPaint && clickable ? () => void paint(col, row) : undefined}
            />
          );
        })}
      </svg>
    </>
  );
}
