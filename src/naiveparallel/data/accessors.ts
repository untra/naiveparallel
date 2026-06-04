import type { DataObj, OrdinalAxis, ParallelAxis, Path } from "../types";

/** Returns a function that reads the value at a dot-path within a row. */
export function pathAccessor(path: Path): (row: DataObj) => unknown {
  const segments = path.split(".");
  return (row: DataObj) => {
    let value: unknown = row;
    for (const segment of segments) {
      if (value == null || typeof value !== "object") return undefined;
      value = (value as DataObj)[segment];
    }
    return value;
  };
}

/** True for the scalar leaf types an axis can derive from. */
export function isScalar(value: unknown): value is number | string | boolean {
  const t = typeof value;
  return t === "number" || t === "string" || t === "boolean";
}

function isPlainObject(value: unknown): value is DataObj {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Discovers the dot-paths to every scalar leaf across a sample of rows,
 * in stable first-encounter (depth-first) order. Arrays and non-plain
 * objects are skipped; null rows are ignored.
 */
export function discoverLeafPaths(rows: ReadonlyArray<DataObj | null | undefined>, sampleSize = 100): Path[] {
  const paths: Path[] = [];
  const seen = new Set<Path>();

  const visit = (value: unknown, prefix: string) => {
    if (isScalar(value)) {
      if (!seen.has(prefix)) {
        seen.add(prefix);
        paths.push(prefix);
      }
      return;
    }
    if (isPlainObject(value)) {
      for (const key of Object.keys(value)) {
        visit(value[key], prefix === "" ? key : `${prefix}.${key}`);
      }
    }
    // arrays, functions, dates, null: not axis material
  };

  let sampled = 0;
  for (const row of rows) {
    if (row == null) continue;
    if (sampled >= sampleSize) break;
    sampled += 1;
    visit(row, "");
  }
  return paths;
}

/** Collects the non-null scalar values at a path across rows. */
export function collectValues(
  rows: ReadonlyArray<DataObj | null | undefined>,
  path: Path
): Array<number | string | boolean> {
  const accessor = pathAccessor(path);
  const values: Array<number | string | boolean> = [];
  for (const row of rows) {
    if (row == null) continue;
    const value = accessor(row);
    if (isScalar(value)) values.push(value);
  }
  return values;
}

/** Applies an ordinal axis' mapping to a raw value, yielding its ordinal value. */
export function ordinalValueOf(axis: OrdinalAxis, raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw);
  return axis.mapping ? axis.mapping(s) : s;
}

/**
 * Reads a row's value for an axis: a number for numerical axes, the mapped
 * string for ordinal axes, or null when missing/mistyped.
 */
export function axisValue(axis: ParallelAxis, row: DataObj): number | string | null {
  const raw = pathAccessor(axis.path)(row);
  if (raw == null) return null;
  if (axis.kind === "numerical") {
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  }
  return ordinalValueOf(axis, raw);
}
