import {
  deriveConfig,
  type ColorizeMode,
  type DataObj,
  type InferAxesOptions,
  type NaiveParallelConfig,
  type StatMarkersConfig,
} from "../../naiveparallel";

export interface PresetOptions {
  inferOptions?: InferAxesOptions;
  /** Leading axis-id order; unlisted axes keep their relative order after. */
  order?: string[];
  /** Axis ids to hide; a trailing `*` matches a prefix (e.g. "name.*"). */
  hide?: string[];
  /** The initially selected axis (defaults to the derived identity axis). */
  select?: string;
  /** Lock row colorizing to this axis. */
  colorizeLock?: string;
  /**
   * Row-colorizing strategy:
   *  - "mapping" (default): the per-axis color ramp, following the selected
   *    axis or locked to `colorizeLock`.
   *  - "components": the first three visible numerical axes mapped onto RGB.
   *  - "distinguish": a unique, stable per-row color from one column
   *    (`colorizeLock`, else the selected axis) — a debugging colorizer.
   */
  colorize?: "mapping" | "components" | "distinguish";
  /** Chart-level stat-marker visibility/colors for the selected axis. */
  stats?: StatMarkersConfig;
}

const matches = (id: string, pattern: string) =>
  pattern.endsWith("*") ? id.startsWith(pattern.slice(0, -1)) : id === pattern;

/**
 * Builds a tasteful preset NaiveParallelConfig: derives axes from the rows
 * (with inference overrides), then applies ordering, hiding, selection, and
 * a colorize lock. Pure post-processing of the library's own config model.
 */
export function presetConfig(rows: DataObj[], options: PresetOptions = {}): NaiveParallelConfig {
  const { inferOptions, order = [], hide = [], select, colorizeLock, colorize, stats } = options;
  const derived = deriveConfig(rows, inferOptions);

  const rank = new Map(order.map((id, i) => [id, i]));
  const axes = derived.axes
    .map((axis) =>
      hide.some((pattern) => matches(axis.id, pattern)) ? { ...axis, hidden: true } : axis
    )
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));

  // "mapping" (or omitted) keeps the per-axis ramp: locked when a colorizeLock
  // is named, else follow. "components" ignores any lock; "distinguish" treats
  // the lock as the column to distinguish (else the selected axis).
  const colorizeMode: ColorizeMode =
    colorize === "components"
      ? "components"
      : colorize === "distinguish"
        ? "distinguish"
        : colorizeLock
          ? "locked"
          : "follow";

  return {
    axes,
    selectedAxisId: select ?? derived.selectedAxisId,
    colorizeAxisId: colorize === "components" ? null : (colorizeLock ?? null),
    colorizeMode,
    statMarkers: stats,
  };
}
