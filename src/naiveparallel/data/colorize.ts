import { scaleLinear } from "d3-scale";
import type { DataObj, NaiveParallelConfig, ParallelAxis } from "../types";
import { axisValue } from "./accessors";

/** Stroke used when no axis drives colorizing or a row has no value. */
export const FALLBACK_COLOR = "steelblue";

/**
 * Builds a row-colorizing function from an axis:
 * numerical → a continuous blue-to-red hue ramp across the axis domain;
 * ordinal → the axis' per-value colors. A null axis yields the fallback.
 */
export function buildColorizer(axis: ParallelAxis | null): (row: DataObj) => string {
  if (axis === null) return () => FALLBACK_COLOR;

  if (axis.kind === "numerical") {
    const t = scaleLinear().domain(axis.domain).range([0, 1]).clamp(true);
    return (row) => {
      const value = axisValue(axis, row);
      if (typeof value !== "number") return FALLBACK_COLOR;
      // hue 240 (blue, low) -> 0 (red, high)
      return `hsl(${Math.round(240 - 240 * t(value))}, 70%, 50%)`;
    };
  }

  return (row) => {
    const value = axisValue(axis, row);
    if (typeof value !== "string") return FALLBACK_COLOR;
    return axis.colors[value] ?? FALLBACK_COLOR;
  };
}

/**
 * Resolves which axis currently drives row colorizing: the locked axis when
 * colorizeMode is "locked", otherwise following the selected axis, otherwise
 * the default identity axis at position [0].
 */
export function resolveColorizeAxis(config: NaiveParallelConfig): ParallelAxis | null {
  const byId = (id: string | null) => config.axes.find((a) => a.id === id) ?? null;
  if (config.colorizeMode === "locked" && config.colorizeAxisId) {
    return byId(config.colorizeAxisId);
  }
  return byId(config.selectedAxisId) ?? config.axes[0] ?? null;
}
