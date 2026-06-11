import {
  deriveConfig,
  type DataObj,
  type InferAxesOptions,
  type NaiveParallelConfig,
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
  /** Map the first three visible numerical axes onto RGB channels instead. */
  colorize?: "components";
}

const matches = (id: string, pattern: string) =>
  pattern.endsWith("*") ? id.startsWith(pattern.slice(0, -1)) : id === pattern;

/**
 * Builds a tasteful preset NaiveParallelConfig: derives axes from the rows
 * (with inference overrides), then applies ordering, hiding, selection, and
 * a colorize lock. Pure post-processing of the library's own config model.
 */
export function presetConfig(rows: DataObj[], options: PresetOptions = {}): NaiveParallelConfig {
  const { inferOptions, order = [], hide = [], select, colorizeLock, colorize } = options;
  const derived = deriveConfig(rows, inferOptions);

  const rank = new Map(order.map((id, i) => [id, i]));
  const axes = derived.axes
    .map((axis) =>
      hide.some((pattern) => matches(axis.id, pattern)) ? { ...axis, hidden: true } : axis
    )
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));

  return {
    axes,
    selectedAxisId: select ?? derived.selectedAxisId,
    colorizeAxisId: colorize ? null : (colorizeLock ?? null),
    colorizeMode: colorize ?? (colorizeLock ? "locked" : "follow"),
  };
}
