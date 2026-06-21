import type {
  AxisKind,
  AxisOverride,
  DataObj,
  InferAxesOptions,
  NumericalAxis,
  OrdinalAxis,
  ParallelAxis,
  Path,
  TemporalAxis,
  TemporalMarker,
} from "../types";
import { MAX_ORDINAL } from "../types";
import { collectValues, discoverLeafPaths } from "./accessors";
import { detectTemporalPattern, parseTemporal } from "./temporal";

/** Default string value-space reducer: map to the first character. */
export const firstCharMapping = (s: string): string => s.charAt(0);

/**
 * Golden-angle hue stepping — produces a distinct, stable color for any value
 * index, so even a 64-value ordinal gets usable defaults.
 */
export function defaultPaletteColor(index: number): string {
  return `hsl(${Math.round((index * 137.508) % 360)}, 65%, 50%)`;
}

const URL_PATTERN = /^https?:\/\//;

/** True when a sampled majority of string values look like URLs. */
function looksLikeUrls(values: string[]): boolean {
  if (values.length === 0) return false;
  const sample = values.slice(0, 50);
  const hits = sample.filter((v) => URL_PATTERN.test(v)).length;
  return hits / sample.length >= 0.8;
}

function compareValues(source: OrdinalAxis["source"]): (a: string, b: string) => number {
  if (source === "number") return (a, b) => Number(a) - Number(b);
  return (a, b) => a.localeCompare(b);
}

function resolveColors(
  values: string[],
  override: AxisOverride | undefined,
  palette: string[] | undefined
): Record<string, string> {
  const colors: Record<string, string> = {};
  values.forEach((value, index) => {
    let color: string | undefined;
    if (override?.colors) {
      color = Array.isArray(override.colors) ? override.colors[index] : override.colors[value];
    }
    if (color === undefined && palette) color = palette[index % palette.length];
    colors[value] = color ?? defaultPaletteColor(index);
  });
  return colors;
}

interface InferAxisInput {
  path: Path;
  values: Array<number | string | boolean>;
  override?: AxisOverride;
  maxOrdinal: number;
  palette?: string[];
}

/**
 * Infers a single axis from the observed values at a path.
 * Returns null when there are no scalar values to infer from.
 */
export function inferAxis(input: InferAxisInput): ParallelAxis | null {
  const { path, values, override, maxOrdinal, palette } = input;
  if (values.length === 0) return null;

  const allNumbers = values.every((v) => typeof v === "number" && Number.isFinite(v));
  const allStrings = values.every((v) => typeof v === "string");

  // Temporal resolves first: it yields a numerical axis carrying a marker.
  // String columns auto-detect (every value must match one date pattern);
  // numeric columns only become temporal via an explicit override (epoch-ms).
  let temporal: TemporalMarker | undefined;
  if (override?.kind === "temporal") {
    if (allNumbers) temporal = { pattern: "iso-datetime", source: "number" };
    else if (allStrings) {
      const pattern = detectTemporalPattern(values as string[]);
      if (pattern) temporal = { pattern, source: "string" };
      // forced temporal but unparseable: fall through to ordinal below
    }
  } else if (override?.kind === undefined && allStrings && !allNumbers) {
    const pattern = detectTemporalPattern(values as string[]);
    if (pattern) temporal = { pattern, source: "string" };
  }

  const kind: AxisKind = temporal
    ? "temporal"
    : override?.kind === "temporal"
      ? allNumbers
        ? "numerical"
        : "ordinal"
      : (override?.kind ?? (allNumbers ? "numerical" : "ordinal"));

  const base = {
    id: path,
    path,
    label: override?.label ?? path,
    hidden: override?.hidden ?? false,
  };

  if (kind === "numerical" || kind === "temporal") {
    let numbers: number[];
    if (temporal?.source === "string") {
      numbers = (values as string[])
        .map((v) => parseTemporal(temporal.pattern, v))
        .filter((n): n is number => n !== null);
    } else {
      if (!allNumbers) return null; // cannot force numbers out of non-number data
      numbers = values as number[];
      if (temporal) numbers = numbers.filter((n) => n >= 0); // epoch floor: pre-1970 ms are missing
      if (numbers.length === 0) return null;
    }
    let min = Infinity;
    let max = -Infinity;
    let allIntegers = true;
    for (const n of numbers) {
      if (n < min) min = n;
      if (n > max) max = n;
      if (allIntegers && !Number.isInteger(n)) allIntegers = false;
    }
    const shared = {
      ...base,
      domain: override?.domain ?? ([min, max] as [number, number]),
      allIntegers,
      allPositive: min >= 0,
    };
    if (temporal) {
      const axis: TemporalAxis = { ...shared, kind: "temporal", temporal };
      return axis;
    }
    const axis: NumericalAxis = { ...shared, kind: "numerical" };
    return axis;
  }

  // ordinal: derive from number, boolean, or string values
  const source: OrdinalAxis["source"] = allNumbers
    ? "number"
    : values.every((v) => typeof v === "boolean")
      ? "boolean"
      : "string";

  const stringValues = values.map((v) => String(v));
  let mapping = override?.mapping;
  let distinct = new Set(mapping ? stringValues.map(mapping) : stringValues);
  const urlLike = source === "string" && looksLikeUrls(stringValues);

  if (distinct.size > maxOrdinal && !mapping && source === "string" && !urlLike) {
    // too large a string liminal space for an ordinal — reduce to first character
    mapping = firstCharMapping;
    distinct = new Set(stringValues.map(mapping));
  }

  const orderedValues =
    override?.values ?? Array.from(distinct).sort(compareValues(source));
  const cardinality = orderedValues.length;
  const renderable = cardinality <= maxOrdinal && !urlLike;

  const axis: OrdinalAxis = {
    ...base,
    kind: "ordinal",
    values: orderedValues,
    cardinality,
    colors: resolveColors(orderedValues, override, palette),
    source,
    mapping,
    renderable,
    hidden: override?.hidden ?? (urlLike || !renderable ? true : false),
  };
  return axis;
}

/**
 * Picks the default "identity" numerical axis to occupy position [0] —
 * the axis that drives the default row colorizing. Preference order:
 *  1. a numerical axis named like an identifier (id, index, key, #)
 *  2. an all-integer numerical axis whose values are unique per row (a row id)
 *  3. the first numerical axis
 */
export function selectIdentityAxis(
  axes: ParallelAxis[],
  data: ReadonlyArray<DataObj | null | undefined>
): ParallelAxis | null {
  // Temporal axes are excluded: epoch-ms values are unique integers but a
  // timestamp column is not a row id.
  const numericals = axes.filter((a): a is NumericalAxis => a.kind === "numerical");
  if (numericals.length === 0) return null;

  const named = numericals.find((a) => /^(id|index|key|#)$/i.test(a.label) || /(^|\.)(id|index|key)$/i.test(a.path));
  if (named) return named;

  const rows = data.filter((r) => r != null);
  const unique = numericals.find((a) => {
    if (!a.allIntegers) return false;
    const values = collectValues(rows, a.path);
    return new Set(values).size === values.length && values.length === rows.length;
  });
  if (unique) return unique;

  return numericals[0];
}

/**
 * Infers the full axis list from the data: discovers scalar leaf paths,
 * infers each axis (numbers → numerical; strings/booleans → ordinal), then
 * moves the default identity numerical axis into position [0].
 */
export function inferAxes(
  data: ReadonlyArray<DataObj | null | undefined>,
  options: InferAxesOptions = {}
): ParallelAxis[] {
  const { overrides = {}, maxOrdinal = MAX_ORDINAL, sampleSize = 100, palette } = options;
  const rows = data.filter((r): r is DataObj => r != null);
  const paths = discoverLeafPaths(rows, sampleSize);

  const axes: ParallelAxis[] = [];
  for (const path of paths) {
    const axis = inferAxis({
      path,
      values: collectValues(rows, path),
      override: overrides[path],
      maxOrdinal,
      palette,
    });
    if (axis) axes.push(axis);
  }

  const identity = selectIdentityAxis(axes, rows);
  if (identity) {
    const index = axes.indexOf(identity);
    if (index > 0) {
      axes.splice(index, 1);
      axes.unshift(identity);
    }
  }
  return axes;
}
