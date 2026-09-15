"use client";

/**
 * Marks a source nobody can reach right now, or one whose event is only
 * suspected. The word carries the meaning; the colour only repeats it.
 */
export function ObtainMark({
  missable,
  unconfirmed,
  missableLabel,
  unconfirmedLabel,
}: {
  missable?: boolean;
  unconfirmed?: boolean;
  missableLabel: string;
  unconfirmedLabel: string;
}) {
  if (missable) return <span className="obtain-mark is-missable">{missableLabel}</span>;
  if (unconfirmed) return <span className="obtain-mark">{unconfirmedLabel}</span>;
  return null;
}
