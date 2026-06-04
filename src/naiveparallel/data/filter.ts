import type { DataObj, FilterState, ParallelAxis } from "../types";
import { axisValue } from "./accessors";

/**
 * Builds a predicate that is true when a row passes every active filter:
 * numerical values must sit within the brushed [min, max]; ordinal values
 * must be individually enabled. Rows with missing values fail active filters.
 */
export function makeFilterPredicate(
  axes: ReadonlyArray<ParallelAxis>,
  filters: FilterState
): (row: DataObj) => boolean {
  const active = axes
    .map((axis) => ({ axis, filter: filters[axis.id] }))
    .filter((entry) => entry.filter !== undefined);

  if (active.length === 0) return () => true;

  return (row: DataObj) => {
    for (const { axis, filter } of active) {
      const value = axisValue(axis, row);
      if (filter!.kind === "numeric") {
        if (typeof value !== "number") return false;
        if (value < filter!.min || value > filter!.max) return false;
      } else {
        if (typeof value !== "string") return false;
        if (!filter!.enabled.has(value)) return false;
      }
    }
    return true;
  };
}

/** Applies the active filters, returning the rows that pass. */
export function applyFilters<T extends DataObj>(
  data: ReadonlyArray<T>,
  axes: ReadonlyArray<ParallelAxis>,
  filters: FilterState
): T[] {
  const predicate = makeFilterPredicate(axes, filters);
  return data.filter(predicate);
}
