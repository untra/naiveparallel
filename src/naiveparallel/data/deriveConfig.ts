import type { DataObj, InferAxesOptions, NaiveParallelConfig } from "../types";
import { inferAxes } from "./inferAxes";

/**
 * Derives a full NaiveParallelConfig from the data when none is provided:
 * inferred axes (identity numerical axis at [0]), selection on that identity
 * axis, and colorizing following the selection. With no numerical axis at all
 * (an all-ordinal dataset) nothing is selected and rows colorize by the first
 * axis via resolveColorizeAxis's fallback.
 */
export function deriveConfig(
  data: ReadonlyArray<DataObj | null | undefined>,
  options: InferAxesOptions = {}
): NaiveParallelConfig {
  const axes = inferAxes(data, options);
  const identity = axes[0]?.kind === "numerical" ? axes[0] : null;
  return {
    axes,
    selectedAxisId: identity?.id ?? null,
    colorizeAxisId: null,
    colorizeMode: "follow",
  };
}
