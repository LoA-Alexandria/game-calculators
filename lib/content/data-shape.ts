/**
 * Whether a payload from the database may stand in for a data file.
 *
 * The rule is: it has to look like the file it replaces. Rather than a
 * hand-written checker per guide — twenty-nine of them, each a place for a
 * typo to hide — the shape is read off the committed file itself. A payload is
 * accepted when every value sits where a value of that kind sits in the file,
 * and refused whole otherwise. Half a roster is worse than the old one.
 *
 * What that buys: the check cannot drift from the file, a new guide needs no
 * new checker, and the thing being enforced is exactly what the renderers
 * already assume, because they were written against that file.
 *
 * Strings that hold a picture in the file are held to the stricter rule in
 * `isSafePicturePath`, because that is the one field an override could use to
 * point a page somewhere it should not go.
 */

export type Shape =
  /** `filled` when the file never leaves this blank, so a payload may not either. */
  | { kind: "string"; picture: boolean; filled: boolean }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "null" }
  /** `stocked` when the file's list has entries, so a payload's may not be bare. */
  | { kind: "array"; item: Shape | null; stocked: boolean }
  | { kind: "object"; fields: Record<string, { shape: Shape; optional: boolean }> }
  /** The file itself is inconsistent here, so nothing can be claimed. */
  | { kind: "mixed" };

/** A picture is a relative path inside the guide's own folder, or an upload. */
const PICTURE = /\.(webp|png|jpe?g)$/i;

export function looksLikePicture(value: string): boolean {
  return PICTURE.test(value);
}

/**
 * A picture the site serves itself. Files differ on the spelling — the
 * bestiary writes `skills/a-1.webp`, the event wiki writes
 * `/events/atlantis.webp` — and both are fine, because both stay on this
 * origin. What is refused is anything that leaves it: a scheme of any sort,
 * a protocol-relative `//host`, and `..` climbing out of the folder.
 */
export function isSafePicturePath(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 160 &&
    !value.includes("..") &&
    !value.includes("//") &&
    !value.includes(":") &&
    /^\/?[a-z0-9][a-z0-9/_.-]*\.(webp|png|jpe?g)$/i.test(value)
  );
}

/** Nothing sensible is deeper or wider than this; past it, refuse. */
const MAX_DEPTH = 12;
const MAX_NODES = 200_000;
const MAX_STRING = 20_000;

export function inferShape(value: unknown, depth = 0): Shape {
  if (depth > MAX_DEPTH) return { kind: "mixed" };
  if (value === null) return { kind: "null" };
  if (typeof value === "string") {
    return { kind: "string", picture: looksLikePicture(value), filled: value.trim().length > 0 };
  }
  if (typeof value === "number") return { kind: "number" };
  if (typeof value === "boolean") return { kind: "boolean" };
  if (Array.isArray(value)) {
    let item: Shape | null = null;
    for (const entry of value) {
      const next = inferShape(entry, depth + 1);
      item = item === null ? next : mergeShapes(item, next);
    }
    return { kind: "array", item, stocked: value.length > 0 };
  }
  if (typeof value === "object") {
    const fields: Record<string, { shape: Shape; optional: boolean }> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      fields[key] = { shape: inferShape(child, depth + 1), optional: false };
    }
    return { kind: "object", fields };
  }
  return { kind: "mixed" };
}

/**
 * One shape covering both. Where a file's rows disagree — a field only some of
 * them have, a value that is a number here and a string there — the merged
 * shape says so rather than picking a side.
 */
export function mergeShapes(a: Shape, b: Shape): Shape {
  if (a.kind !== b.kind) return { kind: "mixed" };
  if (a.kind === "string" && b.kind === "string") {
    // A field is only held to the picture rule when the file always puts a
    // picture there.
    // Held to a rule only where the file is consistent about it.
    return { kind: "string", picture: a.picture && b.picture, filled: a.filled && b.filled };
  }
  if (a.kind === "array" && b.kind === "array") {
    const stocked = a.stocked && b.stocked;
    if (a.item === null) return { ...b, stocked };
    if (b.item === null) return { ...a, stocked };
    return { kind: "array", item: mergeShapes(a.item, b.item), stocked };
  }
  if (a.kind === "object" && b.kind === "object") {
    const fields: Record<string, { shape: Shape; optional: boolean }> = {};
    for (const key of new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])) {
      const left = a.fields[key];
      const right = b.fields[key];
      if (!left) fields[key] = { shape: right.shape, optional: true };
      else if (!right) fields[key] = { shape: left.shape, optional: true };
      else fields[key] = { shape: mergeShapes(left.shape, right.shape), optional: left.optional || right.optional };
    }
    return { kind: "object", fields };
  }
  return a;
}

type Budget = { nodes: number };

function matches(shape: Shape, value: unknown, budget: Budget, depth: number): boolean {
  if (depth > MAX_DEPTH) return false;
  if (++budget.nodes > MAX_NODES) return false;

  switch (shape.kind) {
    case "mixed":
      // The file cannot say what belongs here, so only the simplest values are
      // let through: no structure means nothing to walk into.
      return value === null || ["string", "number", "boolean"].includes(typeof value);
    case "null":
      return value === null;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "string":
      if (typeof value !== "string" || value.length > MAX_STRING) return false;
      // A field the file always fills may not come back blank: an empty name
      // or id reads as a hole in the page rather than an edit.
      if (shape.filled && value.trim().length === 0) return false;
      return shape.picture ? isSafePicturePath(value) : true;
    case "array":
      if (!Array.isArray(value)) return false;
      if (shape.item === null) return value.length === 0;
      // A list the file has entries in should not arrive empty. That is not an
      // edit, it is a guide that lost its contents.
      if (shape.stocked && value.length === 0) return false;
      return value.every((entry) => matches(shape.item as Shape, entry, budget, depth + 1));
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
      const row = value as Record<string, unknown>;
      for (const key of Object.keys(row)) {
        if (!(key in shape.fields)) return false; // a field the file never had
      }
      for (const [key, field] of Object.entries(shape.fields)) {
        if (!(key in row)) {
          if (!field.optional) return false;
          continue;
        }
        if (!matches(field.shape, row[key], budget, depth + 1)) return false;
      }
      return true;
    }
  }
}

/** Whether a payload may stand in for the file it was inferred from. */
export function fitsShape(shape: Shape, value: unknown): boolean {
  return matches(shape, value, { nodes: 0 }, 0);
}

/** Convenience: infer from the committed file and check in one go. */
export function fitsCommitted(committed: unknown, value: unknown): boolean {
  return fitsShape(inferShape(committed), value);
}
