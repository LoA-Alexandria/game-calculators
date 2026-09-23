"use client";

import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import {
  DAWN_OF_ROME_MAP,
  DAWN_OF_ROME_SETTLEMENTS,
  dawnHexPolygon,
  dawnOwnerKind,
  dawnPixelToHex,
  type DawnOwnerKind,
} from "../../lib/content/dawn-of-rome-map";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";

type SiegeScope =
  | { kind: "guild"; guildId: string }
  | { kind: "alliance"; allianceId: string };

type HexRow = { q: number; r: number; owner_guild_id: string };
type SettlementRow = { settlement_id: string; owner_guild_id: string | null };

export type HexBrush = "ours" | "ally" | "clear";

/**
 * Paintable hex layer and capturable white-label settlements for Dawn of Rome.
 * Lives under the village markers; officers paint with the brush toolbar.
 */
export function GuildRomeTerritory({
  scope,
  dayIndex,
  canOfficer,
  guildId,
  partnerGuildId = null,
  brush,
  locked = false,
}: {
  scope: SiegeScope;
  dayIndex: number;
  canOfficer: boolean;
  guildId: string;
  partnerGuildId?: string | null;
  brush: HexBrush;
  locked?: boolean;
}) {
  const { t, tf } = useLocale();
  const supabase = getSupabaseBrowserClient();
  const shared = scope.kind === "alliance";
  const owner = shared ? scope.allianceId : scope.guildId;

  const tables = useMemo(
    () =>
      shared
        ? {
            hex: "guild_alliance_hexes",
            settlement: "guild_alliance_settlements",
            key: { alliance_id: owner } as Record<string, string>,
            hexConflict: "alliance_id,day_index,q,r",
            settlementConflict: "alliance_id,day_index,settlement_id",
          }
        : {
            hex: "guild_event_hexes",
            settlement: "guild_event_settlements",
            key: { guild_id: owner, event_id: "dawn-of-rome" } as Record<string, string>,
            hexConflict: "guild_id,event_id,day_index,q,r",
            settlementConflict: "guild_id,event_id,day_index,settlement_id",
          },
    [shared, owner],
  );

  const [hexes, setHexes] = useState<HexRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const [hexRes, setRes] = await Promise.all([
        supabase.from(tables.hex).select("q, r, owner_guild_id").match({ ...tables.key, day_index: dayIndex }),
        supabase
          .from(tables.settlement)
          .select("settlement_id, owner_guild_id")
          .match({ ...tables.key, day_index: dayIndex }),
      ]);
      if (gone) return;
      if (hexRes.error) setError(hexRes.error.message);
      else setHexes((hexRes.data ?? []) as HexRow[]);
      if (setRes.error) setError(setRes.error.message);
      else setSettlements((setRes.data ?? []) as SettlementRow[]);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, tables, dayIndex]);

  const paint = canOfficer && !locked && !busy;

  const ownerForBrush = (): string | null => {
    if (brush === "clear") return null;
    if (brush === "ours") return guildId;
    return partnerGuildId;
  };

  const paintHex = async (q: number, r: number) => {
    if (!supabase || !paint) return;
    const nextOwner = ownerForBrush();
    setBusy(true);
    setError("");
    if (nextOwner === null) {
      const { error: delError } = await supabase
        .from(tables.hex)
        .delete()
        .match({ ...tables.key, day_index: dayIndex, q, r });
      if (delError) setError(delError.message);
      else {
        setHexes((rows) => rows.filter((row) => !(row.q === q && row.r === r)));
      }
    } else {
      const { error: upError } = await supabase.from(tables.hex).upsert(
        {
          ...tables.key,
          day_index: dayIndex,
          q,
          r,
          owner_guild_id: nextOwner,
          updated_at: new Date().toISOString(),
        },
        { onConflict: tables.hexConflict },
      );
      if (upError) setError(upError.message);
      else {
        setHexes((rows) => {
          const rest = rows.filter((row) => !(row.q === q && row.r === r));
          return [...rest, { q, r, owner_guild_id: nextOwner }];
        });
      }
    }
    setBusy(false);
  };

  const claimSettlement = async (settlementId: string) => {
    if (!supabase || !paint) return;
    const current = settlements.find((row) => row.settlement_id === settlementId)?.owner_guild_id ?? null;
    const kind = dawnOwnerKind(current, guildId, partnerGuildId);
    // Cycle: neutral → ours → ally (if any) → neutral.
    let next: string | null = guildId;
    if (kind === "ours") next = partnerGuildId ?? null;
    else if (kind === "ally") next = null;

    setBusy(true);
    setError("");
    if (next === null && current === null) {
      setBusy(false);
      return;
    }
    if (next === null) {
      const { error: delError } = await supabase
        .from(tables.settlement)
        .delete()
        .match({ ...tables.key, day_index: dayIndex, settlement_id: settlementId });
      if (delError) setError(delError.message);
      else setSettlements((rows) => rows.filter((row) => row.settlement_id !== settlementId));
    } else {
      const { error: upError } = await supabase.from(tables.settlement).upsert(
        {
          ...tables.key,
          day_index: dayIndex,
          settlement_id: settlementId,
          owner_guild_id: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: tables.settlementConflict },
      );
      if (upError) setError(upError.message);
      else {
        setSettlements((rows) => {
          const rest = rows.filter((row) => row.settlement_id !== settlementId);
          return [...rest, { settlement_id: settlementId, owner_guild_id: next }];
        });
      }
    }
    setBusy(false);
  };

  const onSvgClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!paint) return;
    // Ignore clicks that started on a settlement button (they stopPropagation).
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * DAWN_OF_ROME_MAP.width;
    const py = ((event.clientY - rect.top) / rect.height) * DAWN_OF_ROME_MAP.height;
    const { q, r } = dawnPixelToHex(px, py);
    void paintHex(q, r);
  };

  const stateOf = (ownerGuildId: string | null | undefined): DawnOwnerKind =>
    dawnOwnerKind(ownerGuildId, guildId, partnerGuildId);

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
        aria-hidden={paint ? undefined : true}
        role={paint ? "img" : undefined}
        aria-label={paint ? t.guilds.hexLayerLabel : undefined}
        onClick={onSvgClick}
        style={{ pointerEvents: paint ? "auto" : "none", cursor: paint ? "crosshair" : undefined }}
      >
        {hexes.map((row) => (
          <polygon
            key={`${row.q},${row.r}`}
            points={dawnHexPolygon(row.q, row.r)}
            className="siege-hex"
            data-owner={stateOf(row.owner_guild_id)}
          />
        ))}
      </svg>

      {DAWN_OF_ROME_SETTLEMENTS.map((place) => {
        const ownerId = settlements.find((row) => row.settlement_id === place.id)?.owner_guild_id ?? null;
        const state = stateOf(ownerId);
        return (
          <button
            key={place.id}
            type="button"
            className="siege-settlement"
            data-owner={state}
            style={{ "--village-x": `${place.x}%`, "--village-y": `${place.y}%` } as CSSProperties}
            disabled={!paint}
            aria-label={
              state === "neutral"
                ? tf(t.guilds.settlementNeutral, { name: place.label })
                : state === "ours"
                  ? tf(t.guilds.settlementOurs, { name: place.label })
                  : tf(t.guilds.settlementAlly, { name: place.label })
            }
            onClick={(event) => {
              event.stopPropagation();
              void claimSettlement(place.id);
            }}
          >
            <span className="siege-settlement-dot" />
            <span className="siege-settlement-name">{place.label}</span>
          </button>
        );
      })}
    </>
  );
}
