import { deviation, max, mean, median, min, quantile } from "d3-array";
import type { DataObj, NumericalStats, OrdinalAxis, OrdinalStats, ParallelAxis } from "../types";
import { axisValue } from "./accessors";

/**
 * The six stats of a numerical axis — min/max bounds, mean, median, ±1σ and
 * IQR — over the values currently passing the filters.
 * Returns null when no values are available.
 */
export function numericalStats(values: number[]): NumericalStats | null {
  if (values.length === 0) return null;
  return {
    kind: "numerical",
    max: max(values) ?? NaN,
    mean: mean(values) ?? NaN,
    median: median(values) ?? NaN,
    stddev: values.length > 1 ? (deviation(values) ?? 0) : 0,
    q1: quantile(values, 0.25) ?? NaN,
    q3: quantile(values, 0.75) ?? NaN,
    min: min(values) ?? NaN,
    count: values.length,
  };
}

/**
 * The three stats of an ordinal axis: mode (most frequent), median (50th
 * percentile along the axis' low-to-high ordering), and dispersion index
 * (Shannon entropy of the category distribution, normalized to [0, 1]).
 * Returns null when no values are available.
 */
export function ordinalStats(values: string[], ordering: string[]): OrdinalStats | null {
  if (values.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }

  let mode = values[0];
  for (const [value, count] of Object.entries(counts)) {
    if (count > counts[mode]) mode = value;
  }

  // median: the value at the midpoint of the ordered expansion
  const rank = new Map(ordering.map((v, i) => [v, i]));
  const ordered = [...values].sort(
    (a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity)
  );
  const median = ordered[Math.floor((ordered.length - 1) / 2)] ?? null;

  // dispersion: normalized Shannon entropy of the empirical distribution
  const categories = Object.keys(counts);
  let dispersion = 0;
  if (categories.length > 1) {
    const n = values.length;
    let entropy = 0;
    for (const category of categories) {
      const p = counts[category] / n;
      entropy -= p * Math.log(p);
    }
    dispersion = entropy / Math.log(categories.length);
  }

  return { kind: "ordinal", mode, median, dispersion, counts, count: values.length };
}

/** Computes the stats for an axis over a set of (already filtered) rows. */
export function columnStats(axis: ParallelAxis, rows: ReadonlyArray<DataObj>) {
  if (axis.kind === "numerical") {
    const values: number[] = [];
    for (const row of rows) {
      const v = axisValue(axis, row);
      if (typeof v === "number") values.push(v);
    }
    return numericalStats(values);
  }
  const values: string[] = [];
  for (const row of rows) {
    const v = axisValue(axis as OrdinalAxis, row);
    if (typeof v === "string") values.push(v);
  }
  return ordinalStats(values, axis.values);
}
