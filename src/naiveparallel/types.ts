/**
 * Core type model for @untra/naiveparallel.
 *
 * A NaiveParallel ingests `data: T[]` (any array of objects — the same shape a
 * naivetable accepts), infers a set of ParallelAxes from the data columns, and
 * provides derived state via React Context to its compound children.
 */

/** Any object that is string indexed — the row shape, shared with naivetable. */
export interface DataObj {
  [index: string]: any;
}

/** A dot-separated path into a row object, e.g. `"stats.hp"` or `"name.en"`. */
export type Path = string;

export type AxisKind = "numerical" | "ordinal";

interface AxisBase {
  /** Stable identity for this axis (the path, by default). */
  id: string;
  /** Path into each row used to collect this axis' value. */
  path: Path;
  /** Display label (defaults to the path). */
  label: string;
  /** Hidden axes stay in the model but do not render; toggleable from ParallelControl. */
  hidden: boolean;
}

/** An axis over number values. Brushable / filterable to a [min, max] range. */
export interface NumericalAxis extends AxisBase {
  kind: "numerical";
  /** The [min, max] extent the axis fits when shown. */
  domain: [number, number];
  /** True when every observed value is an integer. */
  allIntegers: boolean;
  /** True when every observed value is >= 0. */
  allPositive: boolean;
}

/**
 * An axis over a discrete value set. Values are individually toggleable.
 * Ordinals can derive from string, boolean, or number values; strings pass
 * through `mapping` to reduce a large value space to an ordinal-acceptable one.
 */
export interface OrdinalAxis extends AxisBase {
  kind: "ordinal";
  /** The distinct (post-mapping) values, ordered low to high. */
  values: string[];
  /** values.length — an ordinal axis cannot render when this exceeds MAX_ORDINAL (64). */
  cardinality: number;
  /** Color associated with each value (assigned by value index when not configured). */
  colors: Record<string, string>;
  /** The primitive the values derived from. */
  source: "string" | "boolean" | "number";
  /**
   * Reduces the raw string space to an ordinal-acceptable one. When a string
   * axis exceeds MAX_ORDINAL and no mapping is configured, this defaults to
   * `(s) => s[0]` (first character).
   */
  mapping?: (s: string) => string;
  /** False when cardinality still exceeds MAX_ORDINAL after mapping (too messy to render). */
  renderable: boolean;
}

export type ParallelAxis = NumericalAxis | OrdinalAxis;

/** An ordinal axis with more distinct values than this cannot render. */
export const MAX_ORDINAL = 64;

/**
 * Row colorizing follows the selected axis by default, or can be locked to a
 * specific axis from the controls.
 */
export type ColorizeMode = "follow" | "locked";

/**
 * The configuration NaiveParallel accepts (and derives when not provided):
 * the axes to show, ordered — axes[0] is the default "identity" numerical
 * axis — plus how to colorize the rows.
 */
export interface NaiveParallelConfig {
  axes: ParallelAxis[];
  /** The axis reported by ParallelColumn and highlighted on the chart. */
  selectedAxisId: string | null;
  /** The axis colorizing is locked to (only meaningful when colorizeMode is "locked"). */
  colorizeAxisId: string | null;
  colorizeMode: ColorizeMode;
}

/** Per-path overrides applied during axis inference. */
export interface AxisOverride {
  kind?: AxisKind;
  label?: string;
  hidden?: boolean;
  /** String value-space reducer (ordinal axes). */
  mapping?: (s: string) => string;
  /** Per-value colors, keyed by value or listed by value index. */
  colors?: Record<string, string> | string[];
  /** Explicit numerical domain. */
  domain?: [number, number];
  /** Explicit low-to-high ordinal value ordering. */
  values?: string[];
}

/** Options for axis inference / config derivation. */
export interface InferAxesOptions {
  overrides?: Record<Path, AxisOverride>;
  /** Ordinal cardinality cap; defaults to MAX_ORDINAL (64). */
  maxOrdinal?: number;
  /** Rows sampled for leaf-path discovery; defaults to 100. */
  sampleSize?: number;
  /** Categorical palette cycled for ordinal value colors. */
  palette?: string[];
}

// ---------------------------------------------------------------------------
// filters

/** A brushed range on a numerical axis. */
export interface NumericFilter {
  kind: "numeric";
  min: number;
  max: number;
}

/** The individually-toggled values of an ordinal axis. */
export interface OrdinalFilter {
  kind: "ordinal";
  enabled: Set<string>;
}

export type AxisFilter = NumericFilter | OrdinalFilter;

/** Active filters keyed by axis id. Absent/undefined means unfiltered. */
export type FilterState = Record<string, AxisFilter | undefined>;

// ---------------------------------------------------------------------------
// statistics

/**
 * The six stats of a numerical axis, recomputed live over the filtered data.
 * Each renders on the chart axis in its conventional color (STAT_COLORS).
 */
export interface NumericalStats {
  kind: "numerical";
  /** Red (half thickness) — maximum / upper filter bound of the active data. */
  max: number;
  /** Cyan — arithmetic mean. */
  mean: number;
  /** Green — median. */
  median: number;
  /** Magenta — standard deviation; renders as dotted lines at median−σ and median+σ. */
  stddev: number;
  /** Yellow — 25th percentile (IQR bracket low). */
  q1: number;
  /** Yellow — 75th percentile (IQR bracket high). */
  q3: number;
  /** Blue (half thickness) — minimum / lower filter bound of the active data. */
  min: number;
  /** Rows contributing to these stats. */
  count: number;
}

/** The three stats of an ordinal axis. */
export interface OrdinalStats {
  kind: "ordinal";
  /** Most frequent value. */
  mode: string;
  /** 50th percentile value (ordinals are ordered low-to-high, so always orderable). */
  median: string | null;
  /** Dispersion index — category entropy, normalized to [0, 1]. */
  dispersion: number;
  /** Occurrence count per value. */
  counts: Record<string, number>;
  /** Rows contributing to these stats. */
  count: number;
}

export type ColumnStats = NumericalStats | OrdinalStats;

/**
 * The conventional colors the chart uses for the stat markers.
 * max/min draw at half thickness; stddev draws as dotted lines at
 * median−σ and median+σ; mean (numerical) and mode (ordinal) share cyan.
 */
export const STAT_COLORS = {
  max: "red",
  min: "blue",
  median: "green",
  mean: "cyan",
  mode: "cyan",
  iqr: "yellow",
  stddev: "magenta",
} as const;

// ---------------------------------------------------------------------------
// context

/**
 * Everything NaiveParallel derives from the data, provided via context to the
 * compound children (ParallelControl, ParallelRow, ParallelColumn,
 * ParallelChart) and to implementor components through useNaiveParallel().
 * This value only changes when a filter / axis / selection commits — never
 * mid-gesture or on hover.
 */
export interface NaiveParallelData<T extends DataObj = DataObj> {
  /** The rows (input data with null/undefined entries removed). */
  data: T[];
  /** Convenience alias of config.axes. */
  axes: ParallelAxis[];
  config: NaiveParallelConfig;
  filters: FilterState;
  /** The rows currently passing every active filter. */
  filteredData: T[];
  /** The axis selected for ParallelColumn reporting (null when none). */
  selectedAxis: ParallelAxis | null;
  /** Live stats of the selected axis over filteredData. */
  selectedStats: ColumnStats | null;
  /** The axis currently driving row colorizing. */
  colorizeAxis: ParallelAxis | null;
  /** Resolved row colorizer. */
  colorOf: (row: T) => string;

  // ---- commit-time updaters ----
  setFilter: (axisId: string, filter: AxisFilter | undefined) => void;
  /** Toggles a single ordinal value on/off (starting from all-enabled). */
  toggleOrdinalValue: (axisId: string, value: string) => void;
  /** Unhides a known axis, or infers and appends a new one from a data path. */
  addAxis: (path: Path) => void;
  removeAxis: (axisId: string) => void;
  setAxisHidden: (axisId: string, hidden: boolean) => void;
  reorderAxes: (orderedIds: string[]) => void;
  selectAxis: (axisId: string | null) => void;
  setColorize: (axisId: string | null, mode: ColorizeMode) => void;
}

/**
 * High-frequency interaction state (hover / row selection), kept in a
 * separate context so chart-wide consumers do not re-render on hover.
 */
export interface NaiveParallelInteraction<T extends DataObj = DataObj> {
  hoveredRow: T | null;
  selectedRow: T | null;
  setHovered: (row: T | null) => void;
  setSelected: (row: T | null) => void;
}
